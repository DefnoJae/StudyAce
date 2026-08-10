import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, RotateCcw, Trophy,
  ChevronLeft, ChevronRight, BookOpen, Sparkles, Check, X, Eye
} from "lucide-react";

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function isCorrect(type, userAns, gold) {
  const na = norm(userAns), ng = norm(gold);
  if (type === "mcq") return na === ng && na !== "";
  return !!na && (na === ng || (ng.length > 3 && (na.includes(ng) || ng.includes(na))));
}

export default function QuizPlay() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});   // idx -> string
  const [checked, setChecked] = useState({});    // idx -> bool (feedback revealed)
  const [marks, setMarks] = useState({});        // flashcards: idx -> 'right'|'wrong'
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/quizzes/${quizId}`).then((r) => setQuiz(r.data)).catch(() => toast.error("Quiz not found")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [quizId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-ace-violet animate-spin" /></div>;
  if (!quiz) return null;

  const questions = quiz.questions || [];
  const q = questions[idx];
  const isFlash = quiz.quiz_type === "flashcards";
  const isMcq = quiz.quiz_type === "mcq";
  const last = idx === questions.length - 1;

  const go = (d) => { setIdx((i) => Math.max(0, Math.min(questions.length - 1, i + d))); setFlipped(false); };

  const chooseMcq = (opt) => {
    if (checked[idx]) return;
    setAnswers({ ...answers, [idx]: opt });
    setChecked({ ...checked, [idx]: true });
  };
  const checkText = () => {
    if (!(answers[idx] || "").trim()) { toast.error("Type an answer first"); return; }
    setChecked({ ...checked, [idx]: true });
  };
  const markCard = (m) => {
    setMarks({ ...marks, [idx]: m });
    if (last) finish({ ...marks, [idx]: m });
    else go(1);
  };

  const finish = async (finalMarks = marks) => {
    setSubmitting(true);
    try {
      const arr = questions.map((qq, i) => {
        if (isFlash) return finalMarks[i] === "right" ? (qq.answer || "x") : "";
        return answers[i] || "";
      });
      const { data } = await api.post(`/quizzes/${quizId}/attempt`, { answers: arr });
      setResult(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSubmitting(false); }
  };

  const retake = () => { setAnswers({}); setChecked({}); setMarks({}); setIdx(0); setResult(null); setFlipped(false); load(); };

  if (result) return <Results result={result} quiz={quiz} onRetake={retake} onBack={() => navigate(`/courses/${quiz.course_id}`)} />;

  const answeredCount = isFlash ? Object.keys(marks).length : Object.keys(checked).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(`/courses/${quiz.course_id}`)} data-testid="quiz-back-btn" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors duration-300">
        <ArrowLeft className="w-4 h-4" /> Back to course
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-head font-bold">{quiz.title}</h1>
          <p className="text-white/40 text-sm">Question {idx + 1} of {questions.length}</p>
        </div>
        <span className="text-sm text-ace-cyan font-semibold">{answeredCount}/{questions.length} done</span>
      </div>

      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div className="h-full bg-gradient-to-r from-ace-violet to-ace-fuchsia" animate={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
          {isFlash ? (
            <div className="space-y-4">
              <button onClick={() => setFlipped((f) => !f)} data-testid="flashcard" className="w-full glass rounded-3xl p-10 min-h-[260px] flex flex-col items-center justify-center text-center gap-4 hover:border-ace-violet/40 transition-colors duration-300">
                <span className="text-xs uppercase tracking-wide text-ace-cyan font-semibold flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {flipped ? "Answer" : "Tap to reveal answer"}</span>
                <p className="text-xl font-head font-semibold">{flipped ? q.answer : q.question}</p>
                {flipped && q.explanation && <p className="text-sm text-white/50 max-w-md">{q.explanation}</p>}
                {flipped && q.source && <p className="text-xs text-ace-violet flex items-center gap-1"><BookOpen className="w-3 h-3" /> {q.source}</p>}
              </button>
              {flipped && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                  <button onClick={() => markCard("wrong")} data-testid="flashcard-wrong-btn" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 font-semibold hover:bg-red-500/25 hover:scale-[1.02] active:scale-95 transition-transform duration-300">
                    <X className="w-5 h-5" /> Got it wrong
                  </button>
                  <button onClick={() => markCard("right")} data-testid="flashcard-right-btn" className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-400 font-semibold hover:bg-green-500/25 hover:scale-[1.02] active:scale-95 transition-transform duration-300">
                    <Check className="w-5 h-5" /> Got it right
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="glass rounded-3xl p-7 space-y-5">
              <p className="text-lg font-head font-semibold" data-testid="question-text">{q.question}</p>
              {isMcq ? (
                <div className="space-y-2.5">
                  {(q.options || []).map((opt, i) => {
                    const done = checked[idx];
                    const chosen = answers[idx] === opt;
                    const correct = norm(opt) === norm(q.answer);
                    let cls = "bg-white/5 border-white/10 hover:border-white/25";
                    if (done && correct) cls = "bg-green-500/15 border-green-500";
                    else if (done && chosen && !correct) cls = "bg-red-500/15 border-red-500";
                    else if (done) cls = "bg-white/5 border-white/10 opacity-60";
                    else if (chosen) cls = "bg-ace-violet/20 border-ace-violet";
                    return (
                      <button key={i} onClick={() => chooseMcq(opt)} disabled={done} data-testid={`option-${i}`} className={`w-full text-left p-4 rounded-2xl text-sm border transition-colors duration-300 flex items-center justify-between ${cls}`}>
                        <span><span className="font-semibold mr-2 text-ace-cyan">{String.fromCharCode(65 + i)}.</span>{opt}</span>
                        {done && correct && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                        {done && chosen && !correct && <XCircle className="w-5 h-5 text-red-400" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea value={answers[idx] || ""} onChange={(e) => setAnswers({ ...answers, [idx]: e.target.value })} disabled={checked[idx]} data-testid="answer-input" placeholder="Type your answer..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-ace-violet outline-none resize-none disabled:opacity-70" />
                  {!checked[idx] && (
                    <button onClick={checkText} data-testid="check-answer-btn" className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia text-sm font-semibold hover:scale-105 active:scale-95 transition-transform duration-300">
                      <Check className="w-4 h-4" /> Check answer
                    </button>
                  )}
                </div>
              )}

              {/* Immediate feedback */}
              {checked[idx] && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-4 border ${isCorrect(quiz.quiz_type, answers[idx], q.answer) ? "bg-green-500/10 border-green-500/40" : "bg-red-500/10 border-red-500/40"}`} data-testid="feedback">
                  <p className={`font-semibold flex items-center gap-2 ${isCorrect(quiz.quiz_type, answers[idx], q.answer) ? "text-green-400" : "text-red-400"}`}>
                    {isCorrect(quiz.quiz_type, answers[idx], q.answer) ? <><CheckCircle2 className="w-5 h-5" /> Correct!</> : <><XCircle className="w-5 h-5" /> Not quite</>}
                  </p>
                  {!isCorrect(quiz.quiz_type, answers[idx], q.answer) && <p className="text-sm text-white/70 mt-2">Correct answer: <span className="text-white font-semibold">{q.answer}</span></p>}
                  {q.explanation && <p className="text-sm text-white/60 mt-2">{q.explanation}</p>}
                  {q.source && <p className="text-xs text-ace-violet mt-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Source: {q.source}</p>}
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {!isFlash && (
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => go(-1)} disabled={idx === 0} data-testid="prev-btn" className="flex items-center gap-1.5 px-5 py-3 rounded-full glass text-sm font-semibold disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform duration-300">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          {last ? (
            <button onClick={() => finish()} disabled={submitting || !checked[idx]} data-testid="submit-quiz-btn" className="flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia font-semibold hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} Finish
            </button>
          ) : (
            <button onClick={() => go(1)} data-testid="next-btn" className="flex items-center gap-1.5 px-5 py-3 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia text-sm font-semibold hover:scale-105 active:scale-95 transition-transform duration-300">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {isFlash && !flipped && (
        <div className="flex justify-between gap-3">
          <button onClick={() => go(-1)} disabled={idx === 0} data-testid="prev-btn" className="flex items-center gap-1.5 px-5 py-3 rounded-full glass text-sm font-semibold disabled:opacity-40 transition-transform duration-300">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <p className="text-sm text-white/40 self-center">Tap the card, then mark right or wrong</p>
        </div>
      )}
      {submitting && <div className="flex justify-center"><Loader2 className="w-6 h-6 text-ace-violet animate-spin" /></div>}
    </div>
  );
}

function Results({ result, quiz, onRetake, onBack }) {
  const pass = result.score >= 70;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-3xl p-8 text-center">
        <div className={`w-20 h-20 mx-auto rounded-full grid place-items-center mb-4 ${pass ? "bg-green-500/15" : "bg-amber-500/15"}`}>
          <Trophy className={`w-10 h-10 ${pass ? "text-green-400" : "text-amber-400"}`} />
        </div>
        <h1 className="text-5xl font-head font-bold" data-testid="quiz-score">{result.score}%</h1>
        <p className="text-white/60 mt-2">{result.correct} of {result.total} correct</p>
        <p className="text-sm mt-3 text-white/50">{pass ? "Great work! You're on track for that A. 🎯" : "Keep going — review the explanations below and retake."}</p>
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={onRetake} data-testid="retake-btn" className="flex items-center gap-2 px-6 py-3 rounded-full glass font-semibold hover:scale-105 active:scale-95 transition-transform duration-300"><RotateCcw className="w-4 h-4" /> Retake</button>
          <button onClick={onBack} data-testid="results-back-btn" className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia font-semibold hover:scale-105 active:scale-95 transition-transform duration-300"><ArrowLeft className="w-4 h-4" /> Course</button>
        </div>
      </motion.div>

      <div className="space-y-3">
        <h2 className="font-head font-semibold text-lg">Review & Explanations</h2>
        {result.results.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass rounded-2xl p-5" data-testid={`result-${i}`}>
            <div className="flex items-start gap-3">
              {r.is_correct ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{r.question}</p>
                {!r.is_correct && (
                  <div className="mt-2 space-y-1 text-sm">
                    {quiz.quiz_type !== "flashcards" && <p className="text-red-400/90">Your answer: <span className="text-white/70">{r.user_answer || "(blank)"}</span></p>}
                    <p className="text-green-400/90">Correct: <span className="text-white/90">{r.correct_answer}</span></p>
                  </div>
                )}
                {r.explanation && (
                  <div className="mt-3 glass rounded-xl p-3">
                    <p className="text-xs font-semibold text-ace-cyan flex items-center gap-1.5 mb-1"><Sparkles className="w-3.5 h-3.5" /> Explanation</p>
                    <p className="text-sm text-white/70">{r.explanation}</p>
                    {r.source && <p className="text-xs text-ace-violet mt-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Source: {r.source}</p>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
