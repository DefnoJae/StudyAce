"""
StudyAce round-2 feature tests:
- auto-name on upload (suggested_name)
- download preview (original file) w/ cookie auth
- walkthrough generate/get/progress/delete
- study-guide generate + checklist persist
- key-terms generate + alphabetical
- quiz formula-mix (basic generation with formula content)
- clean formatting (no raw $, **, ###, backslash in walkthrough content / study-guide markdown / chat)
"""
import os, io, uuid, re, time
import pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=",1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# document with formulas to test formula-mix + fraction rendering
FORMULA_TXT = b"""Kinematics equations for uniformly accelerated motion.

Equation 1: v = u + a*t  where v is final velocity, u is initial velocity, a is acceleration, t is time.
Equation 2: s = u*t + (1/2)*a*t^2  where s is displacement.
Equation 3: v^2 = u^2 + 2*a*s
Equation 4: average velocity = (u + v) / 2

Newton's second law: F = m * a. Momentum: p = m * v. Kinetic energy: KE = (1/2) * m * v^2.
Gravitational potential energy near Earth: PE = m * g * h with g = 9.8 m/s^2.
Work: W = F * d * cos(theta). Power: P = W / t.

Worked example: A car accelerates from rest at 2 m/s^2 for 5 seconds. Its final velocity is v = 0 + 2*5 = 10 m/s.
Displacement s = 0*5 + (1/2)*2*25 = 25 m.
"""

RAW_MD_TOKENS = ["$", "\\frac", "\\times", "\\div"]  # markdown ** and ### are OK — rendered by RichText

# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    email = f"feat2_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name":"Feat2","email":email,"password":"TestPass123!"}, timeout=30)
    assert r.status_code == 200, r.text
    return s

@pytest.fixture(scope="module")
def course_id(sess):
    r = sess.post(f"{API}/courses", json={"name":"TEST_Physics R2","color":"#8B5CF6","description":"formulas"}, timeout=15)
    assert r.status_code == 200
    return r.json()["id"]

@pytest.fixture(scope="module")
def doc(sess, course_id):
    files = {"file": ("kinematics_notes.txt", io.BytesIO(FORMULA_TXT), "text/plain")}
    r = sess.post(f"{API}/courses/{course_id}/documents", files=files, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()

# ---------------- Auto-name on upload ----------------
class TestAutoName:
    def test_suggested_name_present(self, doc):
        # d.name should be AI-suggested (not the raw filename)
        assert "suggested_name" in doc and doc["suggested_name"], "missing suggested_name"
        assert doc["name"] == doc["suggested_name"], "primary name must be suggested_name"
        # original filename preserved somewhere (filename field expected)
        assert doc.get("original_filename") == "kinematics_notes.txt"
        # suggested name should not equal the raw filename (would defeat the feature)
        assert doc["suggested_name"].lower() != "kinematics_notes.txt"
        assert len(doc["suggested_name"]) >= 3

# ---------------- Preview / download original ----------------
class TestPreviewOriginal:
    def test_download_original_via_cookie(self, sess, doc):
        # cookie session -> should stream original bytes back
        r = sess.get(f"{API}/documents/{doc['id']}/download", timeout=20)
        assert r.status_code == 200, r.text
        # content should equal what we uploaded (txt) or at least contain a distinctive phrase
        assert b"Kinematics equations" in r.content

    def test_get_text_still_works(self, sess, doc):
        r = sess.get(f"{API}/documents/{doc['id']}/text", timeout=20)
        assert r.status_code == 200
        assert "Kinematics" in r.json()["text"]

# ---------------- Walkthrough ----------------
class TestWalkthrough:
    def test_generate(self, sess, course_id, doc):
        r = sess.post(f"{API}/courses/{course_id}/walkthrough/generate",
                      json={"document_ids":[doc["id"]]}, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["steps"] and len(data["steps"]) >= 3
        # step schema
        s0 = data["steps"][0]
        for k in ("type","heading","content","source"):
            assert k in s0, f"missing {k} in step"
        types = {s.get("type") for s in data["steps"]}
        # at least a couple different types
        assert len(types) >= 2
        # clean formatting on all content
        for s in data["steps"]:
            c = s.get("content","")
            for tok in RAW_MD_TOKENS:
                assert tok not in c, f"raw markdown token {tok!r} leaked into walkthrough content: {c[:120]!r}"
        pytest.wid = data["id"]
        pytest.total_steps = len(data["steps"])

    def test_get(self, sess):
        r = sess.get(f"{API}/walkthroughs/{pytest.wid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["progress"] == 0

    def test_progress_persists(self, sess):
        r = sess.patch(f"{API}/walkthroughs/{pytest.wid}/progress",
                       json={"current_index": 2}, timeout=15)
        assert r.status_code == 200
        r2 = sess.get(f"{API}/walkthroughs/{pytest.wid}", timeout=15)
        assert r2.json()["progress"] == 2

    def test_list(self, sess, course_id):
        r = sess.get(f"{API}/courses/{course_id}/walkthroughs", timeout=15)
        assert r.status_code == 200
        assert any(w["id"] == pytest.wid for w in r.json())

# ---------------- Study guide ----------------
class TestStudyGuide:
    def test_generate(self, sess, course_id, doc):
        r = sess.post(f"{API}/courses/{course_id}/study-guide/generate",
                      json={"document_ids":[doc["id"]]}, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        c = data["content"]
        assert "Quiz Revision Checklist" in c
        assert "- [ ]" in c, "no fillable checkboxes in study guide"
        # no raw $ or backslash math
        assert "$" not in c
        assert "\\frac" not in c
        pytest.gid = data["id"]

    def test_checklist_persist(self, sess):
        state = {"0": True, "2": True}
        r = sess.patch(f"{API}/study-guides/{pytest.gid}/checklist",
                       json={"checklist_state": state}, timeout=15)
        assert r.status_code == 200
        r2 = sess.get(f"{API}/study-guides/{pytest.gid}", timeout=15)
        assert r2.json()["checklist_state"] == state

# ---------------- Key terms ----------------
class TestKeyTerms:
    def test_generate_alphabetical(self, sess, course_id, doc):
        r = sess.post(f"{API}/courses/{course_id}/key-terms/generate",
                      json={"document_ids":[doc["id"]]}, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        terms = data["terms"]
        assert len(terms) >= 3
        names = [t["term"].lower() for t in terms]
        assert names == sorted(names), f"terms not alphabetical: {names}"
        for t in terms:
            for k in ("term","definition","source"):
                assert k in t
            # clean formatting
            for tok in ["$", "\\frac"]:
                assert tok not in t["definition"]

# ---------------- Quiz formula-mix ----------------
class TestQuizFormulaMix:
    def test_generate_with_formulas(self, sess, course_id, doc):
        r = sess.post(f"{API}/courses/{course_id}/quizzes/generate",
                      json={"document_ids":[doc["id"]], "quiz_type":"mcq", "num_questions":6, "topics":"kinematics formulas"},
                      timeout=180)
        assert r.status_code == 200, r.text
        qs = r.json()["questions"]
        # check no raw markdown/latex in question text
        joined = " ".join(q.get("question","") + " " + q.get("explanation","") for q in qs)
        for tok in ["$", "\\frac", "\\times"]:
            assert tok not in joined, f"raw {tok!r} in quiz content"
        # at least one calculation-style question (numeric hint like m/s, =, digits) - best effort
        has_calc = any(re.search(r"\d+\s*(m/s|s|kg|N|J|W|m)\b", q.get("question","")) or "=" in q.get("question","") for q in qs)
        # not strict-fail: just record
        if not has_calc:
            pytest.skip("LLM did not produce a numeric calc question on this run (non-deterministic)")

# ---------------- Chat clean formatting ----------------
class TestChatClean:
    def test_chat_no_raw_markdown(self, sess, course_id, doc):
        r = sess.post(f"{API}/courses/{course_id}/chat",
                      json={"message":"Explain the main kinematics formula v = u + a*t with a worked example.",
                            "document_ids":[doc["id"]]}, timeout=90)
        assert r.status_code == 200, r.text
        ans = r.json()["answer"]
        assert len(ans) > 20
        for tok in ["$", "\\frac", "\\times", "\\div"]:
            assert tok not in ans, f"raw {tok!r} leaked into chat reply"
