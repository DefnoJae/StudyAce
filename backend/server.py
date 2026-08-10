from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form, Header, Query
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "studyace"

# ---------------- Object storage ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------------- Text extraction ----------------
def extract_text(data: bytes, ext: str) -> str:
    ext = ext.lower()
    try:
        if ext == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        if ext == "docx":
            import docx
            d = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in d.paragraphs)
        if ext == "pptx":
            from pptx import Presentation
            prs = Presentation(io.BytesIO(data))
            out = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        out.append(shape.text_frame.text)
            return "\n".join(out)
        if ext in ("txt", "md"):
            return data.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.error(f"extract_text failed: {e}")
    return ""

# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

# ---------------- Models ----------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class CourseInput(BaseModel):
    name: str
    color: Optional[str] = "#8B5CF6"
    description: Optional[str] = ""

class QuizGenInput(BaseModel):
    document_ids: List[str]
    quiz_type: str  # mcq, flashcards, short_answer, fill_blank
    num_questions: int = 10
    title: Optional[str] = None
    topics: Optional[str] = ""
    folder_id: Optional[str] = None

class FolderInput(BaseModel):
    name: str

class QuizUpdateInput(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None

class QuizAttemptInput(BaseModel):
    answers: List[str]

class ChatInput(BaseModel):
    document_ids: List[str] = []
    message: str
    session_id: Optional[str] = None

class StudyPlanInput(BaseModel):
    exam_name: str
    exam_date: str
    daily_hours: float
    topics: str = ""
    timetable: str = ""
    syllabus: str = ""

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# ---------------- LLM ----------------
async def llm_generate(system_message: str, prompt: str, session_id: str = None) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=session_id or str(uuid.uuid4()), system_message=system_message).with_model("gemini", "gemini-3-flash-preview")
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp

def parse_json_block(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.startswith("json"):
            t = t[4:]
    t = t.strip().strip("`").strip()
    start = t.find("{")
    if start == -1:
        start = t.find("[")
    end = max(t.rfind("}"), t.rfind("]"))
    if start != -1 and end != -1:
        t = t[start:end + 1]
    return json.loads(t)

# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"name": data.name, "email": email, "password_hash": hash_password(data.password), "role": "user", "created_at": now_iso(),
           "prefs": {"daily_hours": 2}}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookie(response, create_access_token(uid, email))
    return {"id": uid, "name": data.name, "email": email, "role": "user"}

@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    set_auth_cookie(response, create_access_token(uid, email))
    return {"id": uid, "name": user["name"], "email": email, "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------------- Course routes ----------------
@api_router.post("/courses")
async def create_course(data: CourseInput, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": data.name, "color": data.color,
           "description": data.description, "created_at": now_iso()}
    await db.courses.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/courses")
async def list_courses(user: dict = Depends(get_current_user)):
    courses = await db.courses.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for c in courses:
        c["doc_count"] = await db.documents.count_documents({"course_id": c["id"], "is_deleted": False})
        c["quiz_count"] = await db.quizzes.count_documents({"course_id": c["id"]})
    return courses

@api_router.get("/courses/{course_id}")
async def get_course(course_id: str, user: dict = Depends(get_current_user)):
    c = await db.courses.find_one({"id": course_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(get_current_user)):
    await db.courses.delete_one({"id": course_id, "user_id": user["id"]})
    await db.documents.update_many({"course_id": course_id}, {"$set": {"is_deleted": True}})
    await db.quizzes.delete_many({"course_id": course_id})
    await db.folders.delete_many({"course_id": course_id})
    return {"ok": True}

# ---------------- Document routes ----------------
@api_router.post("/courses/{course_id}/documents")
async def upload_document(course_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id, "user_id": user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    data = await file.read()
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "application/octet-stream")
    text = extract_text(data, ext)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "course_id": course_id,
           "storage_path": result["path"], "original_filename": file.filename,
           "content_type": file.content_type, "ext": ext, "size": result.get("size", len(data)),
           "text": text[:200000], "is_deleted": False, "created_at": now_iso()}
    await db.documents.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "text")}

@api_router.get("/courses/{course_id}/documents")
async def list_documents(course_id: str, user: dict = Depends(get_current_user)):
    docs = await db.documents.find({"course_id": course_id, "user_id": user["id"], "is_deleted": False}, {"_id": 0, "text": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.get("/documents/{doc_id}/text")
async def get_document_text(doc_id: str, user: dict = Depends(get_current_user)):
    d = await db.documents.find_one({"id": doc_id, "user_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"id": d["id"], "filename": d["original_filename"], "text": d.get("text", ""), "ext": d["ext"]}

@api_router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = payload["sub"]
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    d = await db.documents.find_one({"id": doc_id, "user_id": user_id, "is_deleted": False})
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    content, ctype = get_object(d["storage_path"])
    return StarletteResponse(content=content, media_type=d.get("content_type") or ctype,
                             headers={"Content-Disposition": f'inline; filename="{d["original_filename"]}"'})

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    await db.documents.update_one({"id": doc_id, "user_id": user["id"]}, {"$set": {"is_deleted": True}})
    return {"ok": True}

# ---------------- Quiz routes ----------------
QUIZ_INSTRUCTIONS = {
    "mcq": 'Each question object: {"question": str, "options": [4 strings], "answer": str (must exactly match one option), "explanation": str, "source": str (short quote or section reference from the material)}',
    "flashcards": 'Each question object: {"question": str (front/term), "answer": str (back/definition), "explanation": str, "source": str}. Leave options as empty list.',
    "short_answer": 'Each question object: {"question": str, "answer": str (concise ideal answer), "explanation": str, "source": str}. Leave options as empty list.',
    "fill_blank": 'Each question object: {"question": str (sentence with a ____ blank), "answer": str (the word/phrase for the blank), "explanation": str, "source": str}. Leave options as empty list.',
}

@api_router.post("/courses/{course_id}/quizzes/generate")
async def generate_quiz(course_id: str, data: QuizGenInput, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id, "user_id": user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    docs = await db.documents.find({"id": {"$in": data.document_ids}, "user_id": user["id"]}, {"_id": 0}).to_list(100)
    if not docs:
        raise HTTPException(status_code=400, detail="No documents selected")
    material = ""
    for d in docs:
        material += f"\n\n=== {d['original_filename']} ===\n{d.get('text','')[:40000]}"
    material = material[:120000]
    num_q = max(1, min(50, int(data.num_questions)))
    topics_line = f"Focus specifically on these topics: {data.topics}." if data.topics else ""
    system = "You are an expert tutor that creates high-quality study assessments. You always respond with valid JSON only, no markdown."
    prompt = f"""Create a {data.quiz_type} quiz with exactly {num_q} questions from the study material below. {topics_line}
{QUIZ_INSTRUCTIONS.get(data.quiz_type, QUIZ_INSTRUCTIONS['mcq'])}
For every question, 'source' MUST reference which document/section the answer comes from (use the document names given).
Respond ONLY with JSON: {{"questions": [ ...question objects... ]}}

STUDY MATERIAL:
{material}"""
    try:
        raw = await llm_generate(system, prompt)
        parsed = parse_json_block(raw)
        questions = parsed.get("questions", parsed) if isinstance(parsed, dict) else parsed
    except Exception as e:
        logger.error(f"quiz gen failed: {e}")
        raise HTTPException(status_code=500, detail="AI quiz generation failed. Please try again.")
    quiz = {"id": str(uuid.uuid4()), "user_id": user["id"], "course_id": course_id,
            "title": data.title or f"{data.quiz_type.replace('_',' ').title()} Quiz",
            "quiz_type": data.quiz_type, "num_questions": len(questions),
            "document_ids": data.document_ids, "topics": data.topics, "folder_id": data.folder_id,
            "questions": questions, "attempts": [], "best_score": None, "created_at": now_iso()}
    await db.quizzes.insert_one(quiz)
    quiz.pop("_id", None)
    return quiz

@api_router.get("/courses/{course_id}/quizzes")
async def list_quizzes(course_id: str, user: dict = Depends(get_current_user)):
    quizzes = await db.quizzes.find({"course_id": course_id, "user_id": user["id"]}, {"_id": 0, "questions": 0}).sort("created_at", -1).to_list(1000)
    return quizzes

@api_router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    q = await db.quizzes.find_one({"id": quiz_id, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return q

@api_router.patch("/quizzes/{quiz_id}")
async def update_quiz(quiz_id: str, data: QuizUpdateInput, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.quizzes.update_one({"id": quiz_id, "user_id": user["id"]}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"ok": True}

@api_router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    await db.quizzes.delete_one({"id": quiz_id, "user_id": user["id"]})
    return {"ok": True}

# ---------------- Folder (subfolder) routes ----------------
@api_router.post("/courses/{course_id}/folders")
async def create_folder(course_id: str, data: FolderInput, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id, "user_id": user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "course_id": course_id, "name": data.name, "created_at": now_iso()}
    await db.folders.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/courses/{course_id}/folders")
async def list_folders(course_id: str, user: dict = Depends(get_current_user)):
    folders = await db.folders.find({"course_id": course_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for f in folders:
        f["quiz_count"] = await db.quizzes.count_documents({"folder_id": f["id"]})
    return folders

@api_router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user: dict = Depends(get_current_user)):
    await db.folders.delete_one({"id": folder_id, "user_id": user["id"]})
    await db.quizzes.update_many({"folder_id": folder_id, "user_id": user["id"]}, {"$set": {"folder_id": None}})
    return {"ok": True}

def normalize(s: str) -> str:
    return "".join(ch.lower() for ch in (s or "") if ch.isalnum())

@api_router.post("/quizzes/{quiz_id}/attempt")
async def submit_attempt(quiz_id: str, data: QuizAttemptInput, user: dict = Depends(get_current_user)):
    q = await db.quizzes.find_one({"id": quiz_id, "user_id": user["id"]})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = q["questions"]
    results = []
    correct = 0
    for i, ques in enumerate(questions):
        user_ans = data.answers[i] if i < len(data.answers) else ""
        gold = ques.get("answer", "")
        if q["quiz_type"] == "mcq":
            is_correct = normalize(user_ans) == normalize(gold)
        else:
            na, ng = normalize(user_ans), normalize(gold)
            is_correct = bool(na) and (na == ng or (len(ng) > 3 and (na in ng or ng in na)))
        if is_correct:
            correct += 1
        results.append({"question": ques.get("question"), "user_answer": user_ans, "correct_answer": gold,
                        "is_correct": is_correct, "explanation": ques.get("explanation", ""),
                        "source": ques.get("source", ""), "options": ques.get("options", [])})
    score = round(100 * correct / len(questions)) if questions else 0
    attempt = {"score": score, "correct": correct, "total": len(questions), "at": now_iso(),
               "weak": [r["question"] for r in results if not r["is_correct"]]}
    best = q.get("best_score")
    new_best = score if best is None else max(best, score)
    await db.quizzes.update_one({"id": quiz_id}, {"$push": {"attempts": attempt}, "$set": {"best_score": new_best}})
    return {"score": score, "correct": correct, "total": len(questions), "results": results}

# ---------------- Chat routes ----------------
@api_router.post("/courses/{course_id}/chat")
async def chat_with_docs(course_id: str, data: ChatInput, user: dict = Depends(get_current_user)):
    session_id = data.session_id or str(uuid.uuid4())
    context = ""
    if data.document_ids:
        docs = await db.documents.find({"id": {"$in": data.document_ids}, "user_id": user["id"]}, {"_id": 0}).to_list(100)
        for d in docs:
            context += f"\n\n=== {d['original_filename']} ===\n{d.get('text','')[:30000]}"
    history = await db.chat_messages.find({"session_id": session_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(50)
    hist_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:])
    system = "You are StudyAce, a friendly, encouraging AI tutor. Answer using the provided study material. Cite the document name when referencing facts. If the answer isn't in the material, say so and give your best general guidance. Keep answers clear and concise."
    prompt = f"STUDY MATERIAL:{context[:100000] or ' (none selected)'}\n\nCONVERSATION:\n{hist_text}\n\nStudent: {data.message}\nStudyAce:"
    try:
        answer = await llm_generate(system, prompt, session_id)
    except Exception as e:
        logger.error(f"chat failed: {e}")
        raise HTTPException(status_code=500, detail="AI chat failed. Please try again.")
    await db.chat_messages.insert_one({"session_id": session_id, "user_id": user["id"], "course_id": course_id, "role": "user", "content": data.message, "created_at": now_iso()})
    await db.chat_messages.insert_one({"session_id": session_id, "user_id": user["id"], "course_id": course_id, "role": "assistant", "content": answer, "created_at": now_iso()})
    return {"session_id": session_id, "answer": answer}

@api_router.get("/courses/{course_id}/chat/{session_id}")
async def get_chat_history(course_id: str, session_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.chat_messages.find({"session_id": session_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs

# ---------------- Study plan ----------------
@api_router.post("/courses/{course_id}/study-plan")
async def create_study_plan(course_id: str, data: StudyPlanInput, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"id": course_id, "user_id": user["id"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    system = "You are an expert academic study planner. You respond ONLY with valid JSON, no markdown."
    prompt = f"""Create a detailed day-by-day study plan for a student.
Course: {course['name']}
Exam: {data.exam_name} on {data.exam_date}
Available study hours per day: {data.daily_hours}
Weekly timetable / busy times: {data.timetable or 'not provided'}
Syllabus / topics to cover: {data.syllabus or data.topics or 'not provided'}
Today's date: {datetime.now(timezone.utc).date().isoformat()}

Distribute topics sensibly across days leading up to the exam, leaving the last day for revision. Respect busy times.
Respond ONLY with JSON:
{{"overview": "1-2 sentence summary", "days": [{{"date": "YYYY-MM-DD", "focus": "topic focus", "tasks": ["task1","task2"], "hours": number}}], "tips": ["tip1","tip2"]}}"""
    try:
        raw = await llm_generate(system, prompt)
        plan = parse_json_block(raw)
    except Exception as e:
        logger.error(f"study plan failed: {e}")
        raise HTTPException(status_code=500, detail="AI study plan generation failed. Please try again.")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "course_id": course_id,
           "exam_name": data.exam_name, "exam_date": data.exam_date, "daily_hours": data.daily_hours,
           "plan": plan, "created_at": now_iso()}
    await db.study_plans.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/courses/{course_id}/study-plans")
async def list_study_plans(course_id: str, user: dict = Depends(get_current_user)):
    plans = await db.study_plans.find({"course_id": course_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return plans

@api_router.delete("/study-plans/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(get_current_user)):
    await db.study_plans.delete_one({"id": plan_id, "user_id": user["id"]})
    return {"ok": True}

# ---------------- Dashboard ----------------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    uid = user["id"]
    courses = await db.courses.count_documents({"user_id": uid})
    docs = await db.documents.count_documents({"user_id": uid, "is_deleted": False})
    quizzes = await db.quizzes.find({"user_id": uid}, {"_id": 0, "questions": 0}).to_list(1000)
    total_attempts = 0
    scores = []
    weak = {}
    for q in quizzes:
        for a in q.get("attempts", []):
            total_attempts += 1
            scores.append(a["score"])
            for w in a.get("weak", []):
                weak[w] = weak.get(w, 0) + 1
    avg = round(sum(scores) / len(scores)) if scores else 0
    weak_areas = sorted(weak.items(), key=lambda x: -x[1])[:5]
    # upcoming exams
    plans = await db.study_plans.find({"user_id": uid}, {"_id": 0}).to_list(100)
    upcoming = sorted([{"exam_name": p["exam_name"], "exam_date": p["exam_date"], "course_id": p["course_id"]} for p in plans], key=lambda x: x["exam_date"])
    return {"courses": courses, "documents": docs, "quizzes": len(quizzes), "attempts": total_attempts,
            "avg_score": avg, "weak_areas": [{"question": w[0], "misses": w[1]} for w in weak_areas],
            "upcoming_exams": upcoming[:5],
            "recent_quizzes": sorted(quizzes, key=lambda x: x["created_at"], reverse=True)[:5]}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"index: {e}")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@studyace.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"name": "Admin", "email": admin_email, "password_hash": hash_password(admin_password), "role": "admin", "created_at": now_iso(), "prefs": {"daily_hours": 2}})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
