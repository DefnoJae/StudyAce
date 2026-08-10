import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BookOpen, FileText, Brain, Target, Plus, Loader2, TrendingUp,
  CalendarClock, Sparkles, Folder, AlertCircle, X
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

const COLORS = ["#8B5CF6", "#06B6D4", "#D946EF", "#F59E0B", "#22C55E", "#EF4444"];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [c, s] = await Promise.all([api.get("/courses"), api.get("/dashboard")]);
      setCourses(c.data);
      setStats(s.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-ace-violet animate-spin" /></div>;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-ace-cyan text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> {greet}</p>
          <h1 className="text-4xl sm:text-5xl font-head font-bold mt-1">Hi, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-white/50 mt-2">Let's crush your goals today. Ready to study smart?</p>
        </div>
        <NewCourseDialog open={open} setOpen={setOpen} onCreated={load} />
      </div>

      {/* Study reminder */}
      {stats?.attempts === 0 && courses.length > 0 && (
        <ReminderCard text="You haven't taken a practice quiz yet. Pick a course and generate one to lock in your knowledge!" />
      )}
      {stats?.avg_score > 0 && stats?.avg_score < 60 && (
        <ReminderCard text={`Your average is ${stats.avg_score}%. Focus on your weak areas below and retake quizzes to level up!`} tone="warn" />
      )}

      {/* Bento stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={Folder} label="Courses" value={stats?.courses} color="#8B5CF6" delay={0} />
        <StatCard icon={FileText} label="Documents" value={stats?.documents} color="#06B6D4" delay={0.05} />
        <StatCard icon={Brain} label="Quizzes" value={stats?.quizzes} color="#D946EF" delay={0.1} />
        <StatCard icon={TrendingUp} label="Avg Score" value={stats?.avg_score != null ? `${stats.avg_score}%` : "—"} color="#22C55E" delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Courses */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-head font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 text-ace-violet" /> Your Courses</h2>
          {courses.length === 0 ? (
            <EmptyCourses onCreate={() => setOpen(true)} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {courses.map((c, i) => (
                <motion.button
                  key={c.id}
                  data-testid={`course-card-${c.id}`}
                  onClick={() => navigate(`/courses/${c.id}`)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl p-5 text-left hover:scale-[1.02] transition-transform duration-300 group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: `${c.color}22`, border: `1px solid ${c.color}55` }}>
                      <Folder className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                  </div>
                  <p className="font-head font-semibold text-lg truncate">{c.name}</p>
                  <p className="text-sm text-white/40 truncate mt-0.5">{c.description || "No description"}</p>
                  <div className="flex gap-4 mt-4 text-xs text-white/50">
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {c.doc_count} docs</span>
                    <span className="flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> {c.quiz_count} quizzes</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Side: upcoming + weak */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-head font-semibold flex items-center gap-2 mb-4"><CalendarClock className="w-5 h-5 text-ace-cyan" /> Upcoming Exams</h3>
            {stats?.upcoming_exams?.length ? (
              <div className="space-y-3">
                {stats.upcoming_exams.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm" data-testid={`upcoming-exam-${i}`}>
                    <span className="truncate">{e.exam_name}</span>
                    <span className="text-ace-cyan font-semibold whitespace-nowrap ml-2">{e.exam_date}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-white/40">No exams scheduled. Create a study plan inside a course.</p>}
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-head font-semibold flex items-center gap-2 mb-4"><Target className="w-5 h-5 text-ace-fuchsia" /> Weak Areas</h3>
            {stats?.weak_areas?.length ? (
              <div className="space-y-3">
                {stats.weak_areas.map((w, i) => (
                  <div key={i} className="text-sm" data-testid={`weak-area-${i}`}>
                    <p className="text-white/70 line-clamp-2">{w.question}</p>
                    <p className="text-xs text-red-400/80 mt-0.5">missed {w.misses}×</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-white/40">Take some quizzes and we'll spot topics to review here.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="glass rounded-2xl p-5" data-testid={`stat-${label.toLowerCase().replace(" ", "-")}`}
    >
      <div className="w-10 h-10 rounded-xl grid place-items-center mb-3" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-3xl font-head font-bold">{value ?? 0}</p>
      <p className="text-sm text-white/40 mt-0.5">{label}</p>
    </motion.div>
  );
}

function ReminderCard({ text, tone = "info" }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`glass rounded-2xl p-4 flex items-start gap-3 ${tone === "warn" ? "border-amber-400/30" : "border-ace-cyan/30"}`}
      data-testid="reminder-card">
      <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${tone === "warn" ? "bg-amber-400/15" : "bg-ace-cyan/15"}`}>
        <AlertCircle className={`w-5 h-5 ${tone === "warn" ? "text-amber-400" : "text-ace-cyan"}`} />
      </div>
      <p className="text-sm text-white/80 pt-1.5">{text}</p>
    </motion.div>
  );
}

function EmptyCourses({ onCreate }) {
  return (
    <div className="glass rounded-3xl p-10 flex flex-col items-center text-center gap-4">
      <img src="https://images.unsplash.com/photo-1756118175438-4e732b6aa719?crop=entropy&cs=srgb&fm=jpg&w=400&q=80" alt="study" className="w-40 h-40 object-cover rounded-3xl" />
      <div>
        <p className="font-head font-semibold text-lg">No courses yet</p>
        <p className="text-white/40 text-sm mt-1">Create your first course folder to upload notes and generate quizzes.</p>
      </div>
      <button onClick={onCreate} data-testid="empty-create-course-btn" className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-6 py-3 rounded-full font-semibold hover:scale-105 active:scale-95 transition-transform duration-300">
        <Plus className="w-4 h-4" /> Create Course
      </button>
    </div>
  );
}

function NewCourseDialog({ open, setOpen, onCreated }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/courses", { name, description: desc, color });
      toast.success("Course created!");
      setOpen(false); setName(""); setDesc(""); onCreated();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="new-course-btn" className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-3 rounded-full font-semibold hover:scale-105 active:scale-95 transition-transform duration-300">
          <Plus className="w-4 h-4" /> New Course
        </button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-white/10 text-white">
        <DialogHeader><DialogTitle className="font-head">Create a course folder</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <input data-testid="course-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name (e.g. Biology 101)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-ace-violet outline-none" />
          <textarea data-testid="course-desc-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-ace-violet outline-none resize-none" />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-transform duration-300 ${color === c ? "scale-110 ring-2 ring-white" : ""}`} style={{ background: c }} />
            ))}
          </div>
          <button onClick={create} disabled={saving} data-testid="create-course-submit" className="w-full bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300 disabled:opacity-60 flex items-center justify-center">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Course"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
