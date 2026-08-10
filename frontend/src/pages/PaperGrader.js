import { useEffect, useRef, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import RichText from "@/components/RichText";
import {
  ClipboardCheck, Upload, FileText, Loader2, Sparkles, CheckCircle2,
  ThumbsUp, ArrowUpCircle, Trophy, RefreshCw, Trash2, X, PartyPopper, Target
} from "lucide-react";

export default function PaperGrader() {
  const [paper, setPaper] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [title, setTitle] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [resubmitOf, setResubmitOf] = useState("");
  const paperRef = useRef();
  const rubricRef = useRef();

  const loadHistory = () => api.get("/paper-grader").then((r) => setHistory(r.data)).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  const grade = async () => {
    if (!paper) { toast.error("Upload your paper first"); return; }
    setGrading(true);
    try {
      const fd = new FormData();
      fd.append("paper", paper);
      if (rubric) fd.append("rubric", rubric);
      if (title) fd.append("title", title);
      if (resubmitOf) fd.append("previous_id", resubmitOf);
      const { data } = await api.post("/paper-grader/grade", fd);
      setResult(data);
      setResubmitOf("");
      loadHistory();
      if (data.perfect) toast.success("Perfect score — 100% in every area! 🎉");
      else toast.success(`Graded: ${data.overall_percentage}%`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setGrading(false); }
  };

  const resubmit = () => {
    setResubmitOf(result.id);
    setPaper(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Upload your improved paper, then grade again", { icon: "📝" });
    setTimeout(() => paperRef.current?.click(), 300);
  };

  const del = async (id) => { if (!window.confirm("Delete this grade?")) return; await api.delete(`/paper-grader/${id}`); loadHistory(); if (result?.id === id) setResult(null); };
  const openGrade = async (id) => { const { data } = await api.get(`/paper-grader/${id}`); setResult(data); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <p className="text-ace-cyan text-sm font-semibold flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" /> AI Paper Grader</p>
        <h1 className="text-4xl sm:text-5xl font-head font-bold mt-1">Grade my paper</h1>
        <p className="text-white/50 mt-2">Upload your paper and rubric. Get scored on comprehension, structure & scientific accuracy — then keep improving until you hit 100%.</p>
      </div>

      {/* Upload card */}
      <div className="glass rounded-3xl p-6 sm:p-8 space-y-5" data-testid="grader-uploader">
        {resubmitOf && (
          <div className="glass rounded-xl p-3 flex items-center gap-2 border-ace-fuchsia/40" data-testid="resubmit-banner">
            <RefreshCw className="w-4 h-4 text-ace-fuchsia shrink-0" />
            <p className="text-sm text-white/80">Resubmitting an improved version — upload your revised paper and grade again.</p>
          </div>
        )}
        <input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="paper-title-input" placeholder="Assignment title (optional)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-ace-violet outline-none" />
        <div className="grid sm:grid-cols-2 gap-4">
          <UploadZone label="Your paper" required file={paper} onPick={() => paperRef.current?.click()} inputRef={paperRef} onFile={setPaper} testid="paper" accent="#8B5CF6" onClear={() => setPaper(null)} />
          <UploadZone label="Rubric (optional)" file={rubric} onPick={() => rubricRef.current?.click()} inputRef={rubricRef} onFile={setRubric} testid="rubric" accent="#06B6D4" onClear={() => setRubric(null)} />
        </div>
        <button onClick={grade} disabled={grading || !paper} data-testid="grade-btn" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3.5 rounded-full font-semibold hover:scale-[1.01] active:scale-95 transition-transform duration-300 disabled:opacity-50">
          {grading ? <><Loader2 className="w-5 h-5 animate-spin" /> Grading your paper…</> : <><Sparkles className="w-5 h-5" /> Grade my paper</>}
        </button>
      </div>

      <AnimatePresence>
        {result && <ResultView key={result.id} result={result} onResubmit={resubmit} grading={grading} />}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-head font-semibold text-lg flex items-center gap-2"><RefreshCw className="w-5 h-5 text-ace-cyan" /> Previous submissions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((h) => (
              <div key={h.id} className="glass rounded-2xl p-4 flex flex-col gap-2" data-testid={`grade-${h.id}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{h.title}</p>
                    <p className="text-xs text-white/40">Attempt {h.attempt} · {new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => del(h.id)} className="text-white/30 hover:text-red-400 transition-colors duration-300"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-head font-bold ${h.perfect ? "text-green-400" : h.overall_percentage >= 70 ? "text-ace-cyan" : "text-amber-400"}`}>{h.overall_percentage}%</span>
                  {h.perfect && <PartyPopper className="w-4 h-4 text-green-400" />}
                </div>
                <button onClick={() => openGrade(h.id)} data-testid={`open-grade-${h.id}`} className="mt-auto text-sm bg-white/5 hover:bg-ace-violet/20 rounded-full py-2 font-semibold transition-colors duration-300">View feedback</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadZone({ label, required, file, onPick, inputRef, onFile, testid, accent, onClear }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">{label}{required && <span className="text-ace-fuchsia"> *</span>}</p>
      <div onClick={onPick} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
        data-testid={`${testid}-dropzone`}
        className="rounded-2xl p-5 border-2 border-dashed border-white/10 hover:border-ace-violet/50 cursor-pointer transition-colors duration-300 flex items-center gap-3 min-h-[92px]">
        <input ref={inputRef} type="file" hidden accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.pptx" data-testid={`${testid}-input`} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>
          {file ? <FileText className="w-5 h-5" style={{ color: accent }} /> : <Upload className="w-5 h-5" style={{ color: accent }} />}
        </div>
        <div className="min-w-0 flex-1">
          {file ? <p className="text-sm font-semibold truncate">{file.name}</p> : <p className="text-sm text-white/50">Click or drop a file</p>}
          <p className="text-xs text-white/30">PDF, Word, PPT, image or text</p>
        </div>
        {file && onClear && <button onClick={(e) => { e.stopPropagation(); onClear(); }} data-testid={`${testid}-clear`} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}

function ScoreRing({ pct, perfect }) {
  const r = 52, circ = 2 * Math.PI * r;
  const color = perfect ? "#22C55E" : pct >= 70 ? "#06B6D4" : "#F59E0B";
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - (pct / 100) * circ }} transition={{ duration: 1, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-3xl font-head font-bold" style={{ color }} data-testid="overall-score">{pct}%</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Overall</p>
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, onResubmit, grading }) {
  const { criteria = [], perfect, overall_percentage } = result;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5" data-testid="grade-result">
      <div className={`glass rounded-3xl p-6 sm:p-8 ${perfect ? "border-green-500/40" : ""}`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing pct={overall_percentage} perfect={perfect} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              {perfect ? <Trophy className="w-6 h-6 text-green-400" /> : <Target className="w-6 h-6 text-ace-cyan" />}
              <h2 className="text-2xl font-head font-bold">{perfect ? "Perfect! 100% in every area" : `${result.title}`}</h2>
            </div>
            <div className="text-white/70 mt-2 text-sm"><RichText content={result.summary} /></div>
            <p className="text-xs text-white/40 mt-2">Attempt {result.attempt}{result.rubric_provided ? " · graded against your rubric" : " · graded on default academic criteria"}</p>
          </div>
        </div>

        {!perfect && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 glass rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 border-ace-fuchsia/30">
            <div className="w-10 h-10 rounded-xl bg-ace-fuchsia/15 grid place-items-center shrink-0"><ArrowUpCircle className="w-5 h-5 text-ace-fuchsia" /></div>
            <p className="text-sm text-white/80 flex-1 text-center sm:text-left">You're not at 100% yet. Apply the improvements below, then resubmit a revised version — keep going until every area hits 10/10!</p>
            <button onClick={onResubmit} disabled={grading} data-testid="resubmit-btn" className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-60 shrink-0">
              <RefreshCw className="w-4 h-4" /> Resubmit improved paper
            </button>
          </motion.div>
        )}
        {perfect && (
          <div className="mt-6 glass rounded-2xl p-4 flex items-center gap-3 border-green-500/40">
            <PartyPopper className="w-6 h-6 text-green-400 shrink-0" />
            <p className="text-sm text-white/85">Outstanding — your paper meets every part of the rubric at full marks. Nothing left to improve!</p>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {criteria.map((c, i) => {
          const full = c.score >= 10;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-5" data-testid={`criterion-${i}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-head font-semibold">{c.name}</p>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${full ? "bg-green-500/15 text-green-400" : c.score >= 7 ? "bg-ace-cyan/15 text-ace-cyan" : "bg-amber-500/15 text-amber-400"}`} data-testid={`criterion-score-${i}`}>{c.score}/10</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
                <motion.div className="h-full rounded-full" style={{ background: full ? "#22C55E" : "#8B5CF6" }} initial={{ width: 0 }} animate={{ width: `${(c.score / 10) * 100}%` }} transition={{ duration: 0.8 }} />
              </div>
              {c.did_well && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5 mb-1"><ThumbsUp className="w-3.5 h-3.5" /> What you did right</p>
                  <div className="text-sm text-white/70"><RichText content={c.did_well} /></div>
                </div>
              )}
              {!full && c.improve && (
                <div>
                  <p className="text-xs font-semibold text-ace-fuchsia flex items-center gap-1.5 mb-1"><ArrowUpCircle className="w-3.5 h-3.5" /> How to reach 10/10</p>
                  <div className="text-sm text-white/70"><RichText content={c.improve} /></div>
                </div>
              )}
              {full && <p className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Full marks — nailed it!</p>}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
