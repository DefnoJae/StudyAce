import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import RichText from "@/components/RichText";
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight, BookOpen, Lightbulb,
  Globe, HelpCircle, PencilRuler, Sparkles, CheckCircle2, Trophy, Eye
} from "lucide-react";

const TYPE_META = {
  concept: { icon: Lightbulb, color: "#8B5CF6", label: "Concept" },
  example: { icon: PencilRuler, color: "#06B6D4", label: "Worked Example" },
  realworld: { icon: Globe, color: "#22C55E", label: "Real World" },
  question: { icon: HelpCircle, color: "#D946EF", label: "Quick Check" },
};

export default function Walkthrough() {
  const { wid } = useParams();
  const navigate = useNavigate();
  const [w, setW] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const saveRef = useRef(null);

  useEffect(() => {
    api.get(`/walkthroughs/${wid}`).then((r) => { setW(r.data); setIdx(r.data.progress || 0); })
      .catch(() => toast.error("Walkthrough not found")).finally(() => setLoading(false));
  }, [wid]);

  const saveProgress = (i) => {
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => { api.patch(`/walkthroughs/${wid}/progress`, { current_index: i }).catch(() => {}); }, 400);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-ace-violet animate-spin" /></div>;
  if (!w) return null;

  const steps = w.steps || [];
  const step = steps[idx];
  const meta = TYPE_META[step?.type] || TYPE_META.concept;
  const Icon = meta.icon;
  const isQuestion = step?.type === "question";

  const go = (d) => {
    const ni = idx + d;
    if (ni < 0) return;
    if (ni >= steps.length) { setDone(true); saveProgress(steps.length); return; }
    setIdx(ni); setRevealed(false); saveProgress(ni);
  };

  if (done) return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-3xl p-10 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/15 grid place-items-center mb-4"><Trophy className="w-10 h-10 text-green-400" /></div>
        <h1 className="text-3xl font-head font-bold">Lecture complete! 🎉</h1>
        <p className="text-white/60 mt-2">You worked through all {steps.length} steps of "{w.title}". Time to test yourself with a quiz.</p>
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={() => { setDone(false); setIdx(0); setRevealed(false); saveProgress(0); }} data-testid="restart-walkthrough-btn" className="flex items-center gap-2 px-6 py-3 rounded-full glass font-semibold hover:scale-105 active:scale-95 transition-transform duration-300">Restart</button>
          <button onClick={() => navigate(`/courses/${w.course_id}`)} data-testid="finish-walkthrough-btn" className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia font-semibold hover:scale-105 active:scale-95 transition-transform duration-300"><ArrowLeft className="w-4 h-4" /> Back to course</button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(`/courses/${w.course_id}`)} data-testid="walkthrough-back-btn" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors duration-300">
        <ArrowLeft className="w-4 h-4" /> Back to course
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-head font-bold">{w.title}</h1>
        <p className="text-white/40 text-sm mt-1">Step {idx + 1} of {steps.length}</p>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div className="h-full bg-gradient-to-r from-ace-violet to-ace-fuchsia" animate={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.3 }}
          className="glass rounded-3xl p-7 sm:p-9 min-h-[300px]" data-testid="walkthrough-step">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}>
              <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
          </div>

          {step?.heading && <h2 className="font-head font-bold text-xl mb-3">{step.heading}</h2>}
          <RichText content={step?.content} />

          {isQuestion && (
            <div className="mt-5">
              {step.question && !step.content?.includes(step.question) && <p className="font-semibold text-white mb-3">{step.question}</p>}
              {!revealed ? (
                <button onClick={() => setRevealed(true)} data-testid="reveal-answer-btn" className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-ace-fuchsia/20 border border-ace-fuchsia/50 text-white font-semibold text-sm hover:bg-ace-fuchsia/30 hover:scale-105 active:scale-95 transition-transform duration-300">
                  <Eye className="w-4 h-4" /> Reveal answer
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 bg-green-500/10 border border-green-500/40" data-testid="walkthrough-answer">
                  <p className="text-green-400 font-semibold flex items-center gap-2 mb-1.5"><CheckCircle2 className="w-4 h-4" /> Answer</p>
                  <RichText content={step.answer} />
                </motion.div>
              )}
            </div>
          )}

          {step?.source && (
            <p className="text-xs text-ace-violet mt-6 flex items-center gap-1.5 pt-4 border-t border-white/10"><BookOpen className="w-3.5 h-3.5" /> {step.source}</p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => go(-1)} disabled={idx === 0} data-testid="walkthrough-prev-btn" className="flex items-center gap-1.5 px-5 py-3 rounded-full glass text-sm font-semibold disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform duration-300">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button onClick={() => go(1)} data-testid="walkthrough-next-btn" className="flex items-center gap-1.5 px-6 py-3 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia text-sm font-semibold hover:scale-105 active:scale-95 transition-transform duration-300">
          {idx === steps.length - 1 ? "Finish" : "Next"} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
