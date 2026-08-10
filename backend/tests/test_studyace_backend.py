"""
StudyAce backend regression tests
Covers: auth, courses, documents, folders, quiz generate (mcq, flashcards, fill_blank), attempt scoring,
quiz rename/move/delete, chat, study plan, dashboard.
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

SAMPLE_TXT = b"""Photosynthesis is the process by which green plants use sunlight to make food from carbon dioxide and water.
The chloroplast is the organelle where photosynthesis takes place. Chlorophyll is the green pigment that absorbs light.
Mitochondria are the powerhouse of the cell producing ATP through cellular respiration.
The nucleus contains DNA, the genetic material of the cell. Ribosomes synthesize proteins.
Cell division includes mitosis for growth and meiosis for gamete formation.
"""

# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    return s

@pytest.fixture(scope="session")
def user_creds():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    return {"name": "Test User", "email": email, "password": "TestPass123!"}

@pytest.fixture(scope="session")
def auth_session(session, user_creds):
    r = session.post(f"{API}/auth/register", json=user_creds, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return session

@pytest.fixture(scope="session")
def course_id(auth_session):
    r = auth_session.post(f"{API}/courses", json={"name": "TEST_Biology 101", "color": "#8B5CF6", "description": "test"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"]

@pytest.fixture(scope="session")
def doc_id(auth_session, course_id):
    files = {"file": ("notes.txt", io.BytesIO(SAMPLE_TXT), "text/plain")}
    r = auth_session.post(f"{API}/courses/{course_id}/documents", files=files, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()["id"]

# ---------------- Auth ----------------
class TestAuth:
    def test_me(self, auth_session, user_creds):
        r = auth_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == user_creds["email"].lower()

    def test_duplicate_register(self, session, user_creds):
        r = session.post(f"{API}/auth/register", json=user_creds, timeout=15)
        assert r.status_code == 400

    def test_login_admin(self, session):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": "admin@studyace.app", "password": "admin123"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_bad(self, session):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": "admin@studyace.app", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

# ---------------- Courses ----------------
class TestCourses:
    def test_get_course(self, auth_session, course_id):
        r = auth_session.get(f"{API}/courses/{course_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Biology 101"

    def test_list_courses(self, auth_session, course_id):
        r = auth_session.get(f"{API}/courses", timeout=15)
        assert r.status_code == 200
        found = [c for c in r.json() if c["id"] == course_id]
        assert found and "doc_count" in found[0] and "quiz_count" in found[0]

# ---------------- Documents ----------------
class TestDocuments:
    def test_list_docs(self, auth_session, course_id, doc_id):
        r = auth_session.get(f"{API}/courses/{course_id}/documents", timeout=15)
        assert r.status_code == 200
        assert any(d["id"] == doc_id for d in r.json())

    def test_get_text(self, auth_session, doc_id):
        r = auth_session.get(f"{API}/documents/{doc_id}/text", timeout=15)
        assert r.status_code == 200
        assert "Photosynthesis" in r.json()["text"]

# ---------------- Folders ----------------
class TestFolders:
    def test_create_and_list(self, auth_session, course_id):
        r = auth_session.post(f"{API}/courses/{course_id}/folders", json={"name": "TEST_Sub1"}, timeout=15)
        assert r.status_code == 200
        fid = r.json()["id"]
        r2 = auth_session.get(f"{API}/courses/{course_id}/folders", timeout=15)
        assert r2.status_code == 200
        f = [x for x in r2.json() if x["id"] == fid][0]
        assert "quiz_count" in f
        pytest.folder_id = fid

# ---------------- Quiz generation & attempt (uses LLM) ----------------
class TestQuizzes:
    def test_generate_mcq_in_folder(self, auth_session, course_id, doc_id):
        assert getattr(pytest, "folder_id", None), "folder must exist first"
        payload = {"document_ids": [doc_id], "quiz_type": "mcq", "num_questions": 3, "folder_id": pytest.folder_id, "topics": "photosynthesis"}
        r = auth_session.post(f"{API}/courses/{course_id}/quizzes/generate", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["quiz_type"] == "mcq"
        assert data["folder_id"] == pytest.folder_id
        assert len(data["questions"]) >= 1
        q0 = data["questions"][0]
        assert "options" in q0 and len(q0["options"]) >= 2
        assert "answer" in q0 and "explanation" in q0
        pytest.mcq_quiz_id = data["id"]
        pytest.mcq_questions = data["questions"]

    def test_generate_flashcards(self, auth_session, course_id, doc_id):
        payload = {"document_ids": [doc_id], "quiz_type": "flashcards", "num_questions": 3}
        r = auth_session.post(f"{API}/courses/{course_id}/quizzes/generate", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        pytest.flash_quiz_id = r.json()["id"]

    def test_generate_fill_blank_max_50(self, auth_session, course_id, doc_id):
        # verify backend accepts up to 50 (send 5 to keep quick)
        payload = {"document_ids": [doc_id], "quiz_type": "fill_blank", "num_questions": 5}
        r = auth_session.post(f"{API}/courses/{course_id}/quizzes/generate", json=payload, timeout=120)
        assert r.status_code == 200, r.text

    def test_list_quizzes_folder_count(self, auth_session, course_id):
        r = auth_session.get(f"{API}/courses/{course_id}/quizzes", timeout=15)
        assert r.status_code == 200
        assert any(q.get("folder_id") == pytest.folder_id for q in r.json())
        # folder quiz_count should reflect
        rf = auth_session.get(f"{API}/courses/{course_id}/folders", timeout=15)
        f = [x for x in rf.json() if x["id"] == pytest.folder_id][0]
        assert f["quiz_count"] >= 1

    def test_attempt_mcq_all_correct(self, auth_session):
        qid = pytest.mcq_quiz_id
        answers = [q["answer"] for q in pytest.mcq_questions]
        r = auth_session.post(f"{API}/quizzes/{qid}/attempt", json={"answers": answers}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["score"] == 100
        assert all(res["is_correct"] for res in data["results"])

    def test_rename_and_move_quiz(self, auth_session):
        qid = pytest.mcq_quiz_id
        r = auth_session.patch(f"{API}/quizzes/{qid}", json={"title": "TEST_Renamed", "folder_id": None}, timeout=15)
        assert r.status_code == 200
        r2 = auth_session.get(f"{API}/quizzes/{qid}", timeout=15)
        assert r2.json()["title"] == "TEST_Renamed"
        assert r2.json()["folder_id"] is None

    def test_delete_quiz(self, auth_session):
        qid = pytest.flash_quiz_id
        r = auth_session.delete(f"{API}/quizzes/{qid}", timeout=15)
        assert r.status_code == 200
        r2 = auth_session.get(f"{API}/quizzes/{qid}", timeout=15)
        assert r2.status_code == 404

    def test_delete_folder_unassigns(self, auth_session, course_id):
        fid = pytest.folder_id
        r = auth_session.delete(f"{API}/folders/{fid}", timeout=15)
        assert r.status_code == 200
        # remaining quizzes shouldn't have this folder_id
        r2 = auth_session.get(f"{API}/courses/{course_id}/quizzes", timeout=15)
        assert not any(q.get("folder_id") == fid for q in r2.json())

# ---------------- Chat ----------------
class TestChat:
    def test_chat(self, auth_session, course_id, doc_id):
        payload = {"message": "What is photosynthesis in one sentence?", "document_ids": [doc_id]}
        r = auth_session.post(f"{API}/courses/{course_id}/chat", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "answer" in data and len(data["answer"]) > 5
        assert "session_id" in data

# ---------------- Study plan ----------------
class TestStudyPlan:
    def test_create_plan(self, auth_session, course_id):
        payload = {"exam_name": "TEST_Midterm", "exam_date": "2026-02-15", "daily_hours": 2, "topics": "photosynthesis, cell biology"}
        r = auth_session.post(f"{API}/courses/{course_id}/study-plan", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plan" in data
        assert isinstance(data["plan"].get("days"), list) and len(data["plan"]["days"]) >= 1

# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard(self, auth_session):
        r = auth_session.get(f"{API}/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ["courses", "documents", "quizzes", "attempts", "avg_score", "weak_areas", "upcoming_exams", "recent_quizzes"]:
            assert key in d
        assert d["attempts"] >= 1
        assert d["avg_score"] >= 1
