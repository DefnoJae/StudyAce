import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API, formatApiErrorDetail } from "@/lib/api";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, FileText, Trash2, Loader2, Brain, MessageCircle,
  CalendarDays, Plus, Sparkles, Send, Eye, Play, ListChecks, Layers,
  PencilLine, AlignLeft, X, Download, CheckCircle2, FolderPlus, Folder,
  Pencil, FolderOpen, ChevronRight, Presentation, Library, BookOpen, GraduationCap
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RichText from "@/components/RichText";

const QUIZ_TYPES = [
  { id: "mcq", label: "Multiple Choice", icon: ListChecks },
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "short_answer", label: "Short Answer", icon: PencilLine },
  { id: "fill_blank", label: "Fill in the Blank", icon: AlignLeft },
];

export default function CourseView() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [docs, setDocs] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const [c, d, q, p, f] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/courses/${courseId}/documents`),
        api.get(`/courses/${courseId}/quizzes`),
        api.get(`/courses/${courseId}/study-plans`),
        api.get(`/courses/${courseId}/folders`),
      ]);
      setCourse(c.data); setDocs(d.data); setQuizzes(q.data); setPlans(p.data); setFolders(f.data);
    } catch (e) { toast.error("Failed to load course"); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, [courseId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-ace-violet animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/")} data-testid="back-btn" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors duration-300">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </button>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl grid place-items-center" style={{ background: `${course.color}22`, border: `1px solid ${course.color}55` }}>
          <FileText className="w-6 h-6" style={{ color: course.color }} />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-head font-bold">{course.name}</h1>
          <p className="text-white/50">{course.description || "Your course workspace"}</p>
        </div>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="glass rounded-full p-1.5 h-auto flex-wrap gap-1 bg-transparent">
          {[["documents", "Documents", FileText], ["walkthrough", "Walkthrough", Presentation], ["guide", "Study Guide", BookOpen], ["terms", "Key Terms", Library], ["quizzes", "Quizzes", Brain], ["chat", "AI Chat", MessageCircle], ["plan", "Study Plan", CalendarDays]].map(([v, l, Icon]) => (
            <TabsTrigger key={v} value={v} data-testid={`tab-${v}`} className="rounded-full px-4 py-2 data-[state=active]:bg-ace-violet data-[state=active]:text-white text-white/60 font-semibold text-sm">
              <Icon className="w-4 h-4 mr-1.5" /> {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="documents" className="mt-6">
          <DocumentsTab courseId={courseId} docs={docs} reload={loadAll} />
        </TabsContent>
        <TabsContent value="walkthrough" className="mt-6">
          <WalkthroughTab courseId={courseId} docs={docs} navigate={navigate} />
        </TabsContent>
        <TabsContent value="guide" className="mt-6">
          <StudyGuideTab courseId={courseId} docs={docs} />
        </TabsContent>
        <TabsContent value="terms" className="mt-6">
          <KeyTermsTab courseId={courseId} docs={docs} />
        </TabsContent>
        <TabsContent value="quizzes" className="mt-6">
          <QuizzesTab courseId={courseId} docs={docs} quizzes={quizzes} folders={folders} reload={loadAll} navigate={navigate} />
        </TabsContent>
        <TabsContent value="chat" className="mt-6">
          <ChatTab courseId={courseId} docs={docs} />
        </TabsContent>
        <TabsContent value="plan" className="mt-6">
          <PlanTab courseId={courseId} plans={plans} reload={loadAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Documents ---------------- */
function DocumentsTab({ courseId, docs, reload }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        await api.post(`/courses/${courseId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        toast.success(`Uploaded ${file.name}`);
      } catch (e) { toast.error(`Failed: ${file.name}`); }
    }
    setUploading(false); reload();
  };

  const del = async (id) => {
    await api.delete(`/documents/${id}`);
    toast.success("Removed"); reload();
  };

  return (
    <div className="space-y-5">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(Array.from(e.dataTransfer.files)); }}
        data-testid="upload-dropzone"
        className="glass rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer border-dashed border-2 border-white/10 hover:border-ace-violet/50 transition-colors duration-300 text-center"
      >
        <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.pptx,.txt,.md" onChange={(e) => upload(Array.from(e.target.files))} data-testid="file-input" />
        <div className="w-14 h-14 rounded-2xl bg-ace-violet/15 grid place-items-center">
          {uploading ? <Loader2 className="w-6 h-6 text-ace-violet animate-spin" /> : <Upload className="w-6 h-6 text-ace-violet" />}
        </div>
        <p className="font-head font-semibold">{uploading ? "Uploading & scanning..." : "Drop files or click to upload"}</p>
        <p className="text-sm text-white/40">PDF, DOCX, PPTX, TXT — added to this course folder</p>
      </div>

      {docs.length === 0 ? (
        <p className="text-center text-white/40 py-6">No documents yet. Upload your notes to get started.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <div key={d.id} className="glass rounded-2xl p-4 flex flex-col gap-3" data-testid={`doc-${d.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-ace-cyan/15 grid place-items-center shrink-0">
                  <FileText className="w-5 h-5 text-ace-cyan" />
                </div>
                <button onClick={() => del(d.id)} data-testid={`delete-doc-${d.id}`} className="text-white/30 hover:text-red-400 transition-colors duration-300"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div>
                <p className="font-semibold text-sm truncate" title={d.name || d.original_filename}>{d.name || d.original_filename}</p>
                <p className="text-xs text-white/40 truncate mt-0.5">{d.original_filename}</p>
                <p className="text-xs text-white/30 uppercase mt-0.5">{d.ext} · {(d.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => setPreview(d)} data-testid={`preview-doc-${d.id}`} className="mt-auto flex items-center justify-center gap-1.5 text-sm text-ace-violet hover:text-white bg-white/5 hover:bg-ace-violet/20 rounded-full py-2 transition-colors duration-300">
                <Eye className="w-4 h-4" /> Preview
              </button>
            </div>
          ))}
        </div>
      )}

      <PreviewDialog doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function PreviewDialog({ doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const isPdf = doc?.ext === "pdf";
  const isImg = ["png", "jpg", "jpeg", "webp", "gif"].includes(doc?.ext);
  const canEmbed = isPdf || isImg;

  useEffect(() => {
    if (!doc) return;
    setBlobUrl(null); setText("");
    setLoading(true);
    if (canEmbed) {
      api.get(`/documents/${doc.id}/download`, { responseType: "blob" })
        .then((r) => setBlobUrl(URL.createObjectURL(r.data)))
        .catch(() => toast.error("Preview failed"))
        .finally(() => setLoading(false));
    } else {
      api.get(`/documents/${doc.id}/text`).then((r) => setText(r.data.text || "(No extractable text)")).catch(() => setText("(Preview unavailable)")).finally(() => setLoading(false));
    }
    return () => { setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null; }); };
  }, [doc]);

  const openOriginal = () => {
    api.get(`/documents/${doc.id}/download`, { responseType: "blob" }).then((r) => {
      const url = URL.createObjectURL(r.data);
      window.open(url, "_blank");
    });
  };

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong border-white/10 text-white max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-head truncate pr-6">{doc?.name || doc?.original_filename}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden mt-2" data-testid="doc-preview">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ace-violet" /></div>
          ) : isPdf && blobUrl ? (
            <iframe src={blobUrl} title="pdf-preview" className="w-full h-[70vh] rounded-xl bg-white" data-testid="pdf-frame" />
          ) : isImg && blobUrl ? (
            <img src={blobUrl} alt="preview" className="max-h-[70vh] mx-auto rounded-xl object-contain" />
          ) : (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <p className="text-sm text-white/60">Inline preview isn't supported for .{doc?.ext} files. Open the original or read the scanned text below.</p>
                <button onClick={openOriginal} data-testid="open-original-btn" className="flex items-center gap-1.5 text-sm bg-ace-violet/20 hover:bg-ace-violet/30 rounded-full px-4 py-2 transition-colors duration-300 shrink-0 ml-3"><Download className="w-4 h-4" /> Open</button>
              </div>
              <div className="overflow-y-auto max-h-[55vh] text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{text.slice(0, 20000)}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Quizzes ---------------- */
function QuizzesTab({ courseId, docs, quizzes, folders, reload, navigate }) {
  const [gen, setGen] = useState(false);
  const [type, setType] = useState("mcq");
  const [num, setNum] = useState(10);
  const [topics, setTopics] = useState("");
  const [selected, setSelected] = useState([]);
  const [genFolder, setGenFolder] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeFolder, setActiveFolder] = useState(null); // null=all, "none"=uncategorized, id=folder
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editing, setEditing] = useState(null); // quiz being renamed/moved

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const generate = async () => {
    if (!selected.length) { toast.error("Select at least one document"); return; }
    setCreating(true);
    try {
      await api.post(`/courses/${courseId}/quizzes/generate`, { document_ids: selected, quiz_type: type, num_questions: Number(num), topics, folder_id: genFolder || null });
      toast.success("Quiz generated!");
      setGen(false); setSelected([]); setTopics(""); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setCreating(false); }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await api.post(`/courses/${courseId}/folders`, { name: folderName });
      toast.success("Subfolder created");
      setNewFolder(false); setFolderName(""); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const delFolder = async (id) => {
    if (!window.confirm("Delete this subfolder? Quizzes inside will move to Uncategorized.")) return;
    await api.delete(`/folders/${id}`);
    toast.success("Subfolder deleted (quizzes moved out)");
    if (activeFolder === id) setActiveFolder(null);
    reload();
  };

  const delQuiz = async (id) => {
    if (!window.confirm("Delete this quiz/flashcard set? This cannot be undone.")) return;
    await api.delete(`/quizzes/${id}`);
    toast.success("Deleted"); reload();
  };

  const shown = quizzes.filter((q) => activeFolder === null ? true : activeFolder === "none" ? !q.folder_id : q.folder_id === activeFolder);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-head font-semibold text-lg">Practice Quizzes & Flashcards</h2>
        <button onClick={() => setGen(true)} data-testid="generate-quiz-btn" disabled={docs.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-40">
          <Sparkles className="w-4 h-4" /> Generate with AI
        </button>
      </div>

      {/* Subfolder chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <FolderChip label="All" active={activeFolder === null} onClick={() => setActiveFolder(null)} testid="folder-all" />
        <FolderChip label="Uncategorized" active={activeFolder === "none"} onClick={() => setActiveFolder("none")} testid="folder-none" />
        {folders.map((f) => (
          <FolderChip key={f.id} label={`${f.name} (${f.quiz_count})`} active={activeFolder === f.id} onClick={() => setActiveFolder(f.id)} onDelete={() => delFolder(f.id)} testid={`folder-${f.id}`} />
        ))}
        <button onClick={() => setNewFolder(true)} data-testid="new-folder-btn" className="flex items-center gap-1.5 px-3.5 py-2 rounded-full glass text-sm text-white/60 hover:text-white transition-colors duration-300">
          <FolderPlus className="w-4 h-4" /> New subfolder
        </button>
      </div>

      {docs.length === 0 && <p className="text-white/40 text-sm">Upload documents first to generate quizzes.</p>}

      {shown.length === 0 ? (
        <p className="text-center text-white/40 py-6">No quizzes here yet. Generate one from your documents!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((q) => {
            const Icon = QUIZ_TYPES.find((t) => t.id === q.quiz_type)?.icon || Brain;
            const folderName = folders.find((f) => f.id === q.folder_id)?.name;
            return (
              <div key={q.id} className="glass rounded-2xl p-5 flex flex-col gap-3" data-testid={`quiz-${q.id}`}>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-ace-fuchsia/15 grid place-items-center"><Icon className="w-5 h-5 text-ace-fuchsia" /></div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(q)} data-testid={`edit-quiz-${q.id}`} className="text-white/30 hover:text-ace-cyan transition-colors duration-300 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => delQuiz(q.id)} data-testid={`delete-quiz-${q.id}`} className="text-white/30 hover:text-red-400 transition-colors duration-300 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <p className="font-head font-semibold">{q.title}</p>
                  <p className="text-xs text-white/40 mt-0.5">{q.num_questions} questions · {(q.attempts?.length || 0)} attempts</p>
                  {folderName && <span className="inline-flex items-center gap-1 text-[11px] text-ace-cyan mt-1.5"><Folder className="w-3 h-3" /> {folderName}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-auto">
                  {q.best_score != null && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/15 text-green-400">Best {q.best_score}%</span>}
                  <button onClick={() => navigate(`/quiz/${q.id}`)} data-testid={`play-quiz-${q.id}`} className="ml-auto flex items-center justify-center gap-1.5 text-sm bg-gradient-to-r from-ace-violet to-ace-fuchsia rounded-full py-2 px-4 font-semibold hover:scale-[1.03] active:scale-95 transition-transform duration-300">
                    <Play className="w-4 h-4" /> Practice
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate dialog */}
      <Dialog open={gen} onOpenChange={setGen}>
        <DialogContent className="glass-strong border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-head">Generate AI Quiz</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-2">
            <div>
              <p className="text-sm font-semibold mb-2">Quiz type</p>
              <div className="grid grid-cols-2 gap-2">
                {QUIZ_TYPES.map((t) => (
                  <button key={t.id} onClick={() => setType(t.id)} data-testid={`quiz-type-${t.id}`} className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold border transition-colors duration-300 ${type === t.id ? "bg-ace-violet/20 border-ace-violet text-white" : "bg-white/5 border-white/10 text-white/60"}`}>
                    <t.icon className="w-4 h-4" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Number of questions: <span className="text-ace-cyan">{num}</span></p>
              <input type="range" min="3" max="50" value={num} onChange={(e) => setNum(e.target.value)} data-testid="num-questions-slider" className="w-full accent-ace-violet" />
              <div className="flex justify-between text-[11px] text-white/30 mt-1"><span>3</span><span>50</span></div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Save to subfolder (optional)</p>
              <select value={genFolder} onChange={(e) => setGenFolder(e.target.value)} data-testid="gen-folder-select" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none [color-scheme:dark]">
                <option value="">Uncategorized</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Focus topics (optional)</p>
              <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g. Photosynthesis, Cell division" data-testid="topics-input" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Select documents</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {docs.map((d) => (
                  <button key={d.id} onClick={() => toggle(d.id)} data-testid={`select-doc-${d.id}`} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left border transition-colors duration-300 ${selected.includes(d.id) ? "bg-ace-cyan/15 border-ace-cyan" : "bg-white/5 border-white/10"}`}>
                    <div className={`w-4 h-4 rounded grid place-items-center ${selected.includes(d.id) ? "bg-ace-cyan" : "border border-white/30"}`}>
                      {selected.includes(d.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="truncate">{d.original_filename}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generate} disabled={creating} data-testid="generate-quiz-submit" className="w-full bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300 disabled:opacity-60 flex items-center justify-center gap-2">
              {creating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newFolder} onOpenChange={setNewFolder}>
        <DialogContent className="glass-strong border-white/10 text-white max-w-sm">
          <DialogHeader><DialogTitle className="font-head">New subfolder</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. Thermodynamics" data-testid="folder-name-input" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-ace-violet outline-none" />
            <button onClick={createFolder} data-testid="create-folder-submit" className="w-full bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300">Create</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename / move dialog */}
      <RenameQuizDialog quiz={editing} folders={folders} onClose={() => setEditing(null)} reload={reload} />
    </div>
  );
}

function FolderChip({ label, active, onClick, onDelete, testid }) {
  return (
    <div className={`flex items-center rounded-full text-sm font-semibold border transition-colors duration-300 ${active ? "bg-ace-violet/20 border-ace-violet text-white" : "glass border-white/10 text-white/60"}`}>
      <button onClick={onClick} data-testid={testid} className="pl-3.5 pr-2 py-2 flex items-center gap-1.5">
        <Folder className="w-3.5 h-3.5" /> {label}
      </button>
      {onDelete && <button onClick={onDelete} data-testid={`${testid}-delete`} className="pr-2.5 text-white/30 hover:text-red-400 transition-colors duration-300"><X className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

function RenameQuizDialog({ quiz, folders, onClose, reload }) {
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (quiz) { setTitle(quiz.title); setFolderId(quiz.folder_id || ""); } }, [quiz]);
  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/quizzes/${quiz.id}`, { title, folder_id: folderId || null });
      toast.success("Updated"); onClose(); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={!!quiz} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong border-white/10 text-white max-w-sm">
        <DialogHeader><DialogTitle className="font-head">Rename & move</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <p className="text-sm font-semibold mb-1.5">Name</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="rename-quiz-input" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-ace-violet outline-none" />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1.5">Subfolder</p>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)} data-testid="move-quiz-select" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none [color-scheme:dark]">
              <option value="">Uncategorized</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <button onClick={save} disabled={saving} data-testid="rename-quiz-submit" className="w-full bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300 disabled:opacity-60 flex items-center justify-center">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Chat ---------------- */
function ChatTab({ courseId, docs }) {
  const [selected, setSelected] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const send = async () => {
    if (!input.trim()) return;
    const msg = input;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput(""); setSending(true);
    try {
      const { data } = await api.post(`/courses/${courseId}/chat`, { message: msg, document_ids: selected, session_id: sessionId });
      setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I hit an error. Please try again." }]);
    } finally { setSending(false); }
  };

  return (
    <div className="grid lg:grid-cols-4 gap-5">
      <div className="glass rounded-2xl p-4 lg:col-span-1 h-fit">
        <p className="text-sm font-semibold mb-3">Chat context</p>
        <p className="text-xs text-white/40 mb-3">Select docs for the AI to reference (optional).</p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {docs.length === 0 && <p className="text-xs text-white/40">No documents.</p>}
          {docs.map((d) => (
            <button key={d.id} onClick={() => toggle(d.id)} data-testid={`chat-doc-${d.id}`} className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-xs text-left border transition-colors duration-300 ${selected.includes(d.id) ? "bg-ace-cyan/15 border-ace-cyan" : "bg-white/5 border-white/10"}`}>
              <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{d.original_filename}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl lg:col-span-3 flex flex-col h-[65vh]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-white/40">
              <div className="w-14 h-14 rounded-2xl bg-ace-violet/15 grid place-items-center"><MessageCircle className="w-6 h-6 text-ace-violet" /></div>
              <p className="font-head font-semibold text-white/70">Ask anything about your material</p>
              <p className="text-sm max-w-sm">Select documents on the left, then ask the AI to explain concepts, summarize, or quiz you.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-gradient-to-r from-ace-violet to-ace-fuchsia text-white whitespace-pre-wrap" : "glass text-white/90"}`}>
                {m.role === "user" ? m.content : <RichText content={m.content} />}
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-start"><div className="glass rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-ace-violet" /></div></div>}
          <div ref={endRef} />
        </div>
        <div className="p-4 border-t border-white/10 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !sending && send()} placeholder="Ask your AI tutor..." data-testid="chat-input" className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm focus:border-ace-violet outline-none" />
          <button onClick={send} disabled={sending} data-testid="chat-send-btn" className="w-12 h-12 rounded-full bg-gradient-to-r from-ace-violet to-ace-fuchsia grid place-items-center hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-60">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Study Plan ---------------- */
function PlanTab({ courseId, plans, reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ exam_name: "", exam_date: "", daily_hours: 2, topics: "", timetable: "", syllabus: "" });
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState({ syllabus: false, timetable: false });
  const [files, setFiles] = useState({ syllabus: "", timetable: "" });
  const sylRef = useRef();
  const ttRef = useRef();

  const uploadSchedule = async (kind, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [kind]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const { data } = await api.post(`/courses/${courseId}/schedule-file`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, [kind]: data.text }));
      setFiles((s) => ({ ...s, [kind]: data.filename }));
      toast.success(`${kind === "timetable" ? "Timetable" : "Syllabus"} read by AI ✨`);
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setUploading((u) => ({ ...u, [kind]: false })); }
  };

  const create = async () => {
    if (!form.exam_name || !form.exam_date) { toast.error("Add exam name and date"); return; }
    setCreating(true);
    try {
      await api.post(`/courses/${courseId}/study-plan`, { ...form, daily_hours: Number(form.daily_hours) });
      toast.success("Study plan created!");
      setOpen(false); reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setCreating(false); }
  };

  const del = async (id) => { await api.delete(`/study-plans/${id}`); reload(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-head font-semibold text-lg">Study Plans</h2>
        <button onClick={() => setOpen(true)} data-testid="new-plan-btn" className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-300">
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="text-center text-white/40 py-6">No study plans yet. Tell the AI your exam date & schedule to build one.</p>
      ) : plans.map((p) => (
        <div key={p.id} className="glass rounded-2xl p-6" data-testid={`plan-${p.id}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-head font-semibold text-lg">{p.exam_name}</p>
              <p className="text-sm text-ace-cyan">Exam: {p.exam_date} · {p.daily_hours}h/day</p>
              <p className="text-sm text-white/60 mt-2">{p.plan?.overview}</p>
            </div>
            <button onClick={() => del(p.id)} className="text-white/30 hover:text-red-400 transition-colors duration-300"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            {p.plan?.days?.map((d, i) => (
              <div key={i} className="glass rounded-xl p-3 flex gap-4" data-testid={`plan-day-${i}`}>
                <div className="text-center shrink-0 w-20">
                  <p className="text-xs text-ace-violet font-semibold">{d.date}</p>
                  <p className="text-xs text-white/40">{d.hours}h</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{d.focus}</p>
                  <ul className="text-xs text-white/50 mt-1 list-disc pl-4 space-y-0.5">
                    {d.tasks?.map((t, j) => <li key={j}>{t}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          {p.plan?.tips?.length > 0 && (
            <div className="mt-4 glass rounded-xl p-3">
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-1"><Sparkles className="w-4 h-4 text-ace-cyan" /> Tips</p>
              <ul className="text-xs text-white/60 list-disc pl-4 space-y-0.5">{p.plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-head">Build a study plan</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Inp label="Exam / quiz name" value={form.exam_name} onChange={(v) => setForm({ ...form, exam_name: v })} testid="plan-exam-name" placeholder="Midterm Exam" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-semibold mb-1.5">Exam date</p>
                <input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} data-testid="plan-exam-date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none [color-scheme:dark]" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1.5">Hours/day</p>
                <input type="number" min="0.5" step="0.5" value={form.daily_hours} onChange={(e) => setForm({ ...form, daily_hours: e.target.value })} data-testid="plan-hours" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none" />
              </div>
            </div>
            <Txt label="Topics to cover" value={form.topics} onChange={(v) => setForm({ ...form, topics: v })} testid="plan-topics" placeholder="List topics, or upload a syllabus below to auto-fill" />

            <ScheduleUpload
              label="Syllabus" hint="Upload a syllabus (PDF/DOCX/image) — AI extracts the topics"
              fileName={files.syllabus} uploading={uploading.syllabus}
              onPick={() => sylRef.current?.click()}
              inputRef={sylRef} onFile={(f) => uploadSchedule("syllabus", f)}
              value={form.syllabus} onChange={(v) => setForm({ ...form, syllabus: v })}
              testid="syllabus" placeholder="AI-extracted syllabus topics will appear here (editable)"
            />
            <ScheduleUpload
              label="Timetable" hint="Upload your timetable (PDF/image) — AI finds your free study time"
              fileName={files.timetable} uploading={uploading.timetable}
              onPick={() => ttRef.current?.click()}
              inputRef={ttRef} onFile={(f) => uploadSchedule("timetable", f)}
              value={form.timetable} onChange={(v) => setForm({ ...form, timetable: v })}
              testid="timetable" placeholder="e.g. Classes Mon-Fri 9-3, work Sat (or upload a file)"
            />

            <button onClick={create} disabled={creating} data-testid="create-plan-submit" className="w-full bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300 disabled:opacity-60 flex items-center justify-center gap-2">
              {creating ? <><Loader2 className="w-5 h-5 animate-spin" /> Building plan...</> : <><Sparkles className="w-4 h-4" /> Generate Plan</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Shared doc picker ---------------- */
function DocSelectList({ docs, selected, toggle }) {
  return (
    <div className="space-y-2 max-h-52 overflow-y-auto">
      {docs.length === 0 && <p className="text-sm text-white/40">No documents in this course yet.</p>}
      {docs.map((d) => (
        <button key={d.id} onClick={() => toggle(d.id)} data-testid={`pick-doc-${d.id}`} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left border transition-colors duration-300 ${selected.includes(d.id) ? "bg-ace-cyan/15 border-ace-cyan" : "bg-white/5 border-white/10"}`}>
          <div className={`w-4 h-4 rounded grid place-items-center shrink-0 ${selected.includes(d.id) ? "bg-ace-cyan" : "border border-white/30"}`}>
            {selected.includes(d.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </div>
          <span className="truncate">{d.name || d.original_filename}</span>
        </button>
      ))}
    </div>
  );
}

function GenerateDialog({ open, setOpen, docs, onGenerate, busy, cta, hint, titlePlaceholder }) {
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState("");
  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSelected([]); setTitle(""); } }}>
      <DialogContent className="glass-strong border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-head">{cta}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titlePlaceholder} data-testid="gen-title-input" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none" />
          <div>
            <p className="text-sm font-semibold mb-2">Select documents</p>
            <DocSelectList docs={docs} selected={selected} toggle={toggle} />
          </div>
          <p className="text-xs text-white/40">{hint}</p>
          <button onClick={() => onGenerate(selected, title)} disabled={busy} data-testid="gen-submit-btn" className="w-full bg-gradient-to-r from-ace-violet to-ace-fuchsia py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating with AI…</> : <><Sparkles className="w-4 h-4" /> {cta}</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Walkthrough ---------------- */
function WalkthroughTab({ courseId, docs, navigate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/courses/${courseId}/walkthroughs`).then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, [courseId]);

  const gen = async (selected, title) => {
    if (!selected.length) { toast.error("Select at least one document"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/courses/${courseId}/walkthrough/generate`, { document_ids: selected, title: title || null });
      toast.success("Interactive lecture ready!");
      setOpen(false); load(); navigate(`/walkthrough/${data.id}`);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm("Delete this walkthrough?")) return; await api.delete(`/walkthroughs/${id}`); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-head font-semibold text-lg">Interactive Walkthroughs</h2>
          <p className="text-sm text-white/40">A fun, guided lecture that teaches your documents step by step.</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-walkthrough-btn" disabled={docs.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-40">
          <Sparkles className="w-4 h-4" /> Build Walkthrough
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-white/40 py-6">No walkthroughs yet. Build one and learn interactively!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => {
            const pct = w.total_steps ? Math.round(((w.progress || 0) / w.total_steps) * 100) : 0;
            const started = (w.progress || 0) > 0;
            return (
              <div key={w.id} className="glass rounded-2xl p-5 flex flex-col gap-3" data-testid={`walkthrough-${w.id}`}>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-ace-violet/15 grid place-items-center"><Presentation className="w-5 h-5 text-ace-violet" /></div>
                  <button onClick={() => del(w.id)} data-testid={`delete-walkthrough-${w.id}`} className="text-white/30 hover:text-red-400 transition-colors duration-300 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
                <p className="font-head font-semibold">{w.title}</p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-ace-violet to-ace-fuchsia" style={{ width: `${pct}%` }} /></div>
                <p className="text-xs text-white/40">{started ? `Resume · step ${(w.progress || 0) + 1} of ${w.total_steps}` : `${w.total_steps} steps`}</p>
                <button onClick={() => navigate(`/walkthrough/${w.id}`)} data-testid={`open-walkthrough-${w.id}`} className="mt-auto flex items-center justify-center gap-1.5 text-sm bg-gradient-to-r from-ace-violet to-ace-fuchsia rounded-full py-2.5 font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300">
                  <Play className="w-4 h-4" /> {started ? "Continue" : "Start"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {docs.length === 0 && <p className="text-white/40 text-sm">Upload documents first to build a walkthrough.</p>}
      <GenerateDialog open={open} setOpen={setOpen} docs={docs} onGenerate={gen} busy={busy} cta="Build Walkthrough" titlePlaceholder="Lecture title (optional)" hint="The AI builds a complete interactive lecture covering everything important — this can take 20-40 seconds." />
    </div>
  );
}

/* ---------------- Study Guide ---------------- */
function StudyGuideTab({ courseId, docs }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const load = () => api.get(`/courses/${courseId}/study-guides`).then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, [courseId]);

  const gen = async (selected, title) => {
    if (!selected.length) { toast.error("Select at least one document"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/courses/${courseId}/study-guide/generate`, { document_ids: selected, title: title || null });
      toast.success("Study guide ready!"); setOpen(false); load(); setViewing(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm("Delete this study guide?")) return; await api.delete(`/study-guides/${id}`); load(); };
  const view = async (id) => { const { data } = await api.get(`/study-guides/${id}`); setViewing(data); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-head font-semibold text-lg">Study Guides</h2>
          <p className="text-sm text-white/40">Detailed, organized guides with a revision checklist.</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-guide-btn" disabled={docs.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-40">
          <Sparkles className="w-4 h-4" /> Generate Guide
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-white/40 py-6">No study guides yet. Generate a comprehensive one!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((g) => (
            <div key={g.id} className="glass rounded-2xl p-5 flex flex-col gap-3" data-testid={`guide-${g.id}`}>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-ace-cyan/15 grid place-items-center"><BookOpen className="w-5 h-5 text-ace-cyan" /></div>
                <button onClick={() => del(g.id)} data-testid={`delete-guide-${g.id}`} className="text-white/30 hover:text-red-400 transition-colors duration-300 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="font-head font-semibold">{g.title}</p>
              <button onClick={() => view(g.id)} data-testid={`open-guide-${g.id}`} className="mt-auto flex items-center justify-center gap-1.5 text-sm bg-gradient-to-r from-ace-violet to-ace-fuchsia rounded-full py-2.5 font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300">
                <Eye className="w-4 h-4" /> Read Guide
              </button>
            </div>
          ))}
        </div>
      )}
      {docs.length === 0 && <p className="text-white/40 text-sm">Upload documents first to generate a study guide.</p>}
      <GenerateDialog open={open} setOpen={setOpen} docs={docs} onGenerate={gen} busy={busy} cta="Generate Guide" titlePlaceholder="Guide title (optional)" hint="The AI writes a detailed, comprehensive guide — this can take 20-40 seconds." />
      <StudyGuideViewer guide={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function StudyGuideViewer({ guide, onClose }) {
  const [checkState, setCheckState] = useState({});
  useEffect(() => { if (guide) setCheckState(guide.checklist_state || {}); }, [guide]);
  const toggle = (i) => {
    const next = { ...checkState, [i]: !checkState[i] };
    setCheckState(next);
    if (guide) api.patch(`/study-guides/${guide.id}/checklist`, { checklist_state: next }).catch(() => {});
  };
  const ci = { i: 0 };
  const checkbox = { state: checkState, next: () => ci.i++, onToggle: toggle };
  return (
    <Dialog open={!!guide} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong border-white/10 text-white max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="font-head pr-6">{guide?.title}</DialogTitle></DialogHeader>
        <div className="overflow-y-auto mt-2 pr-2" data-testid="guide-content">
          {guide && <RichText content={guide.content} checkbox={checkbox} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Key Terms ---------------- */
function KeyTermsTab({ courseId, docs }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const load = () => api.get(`/courses/${courseId}/key-terms`).then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, [courseId]);

  const gen = async (selected, title) => {
    if (!selected.length) { toast.error("Select at least one document"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/courses/${courseId}/key-terms/generate`, { document_ids: selected, title: title || null });
      toast.success("Key terms ready!"); setOpen(false); load(); setViewing(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm("Delete this key term set?")) return; await api.delete(`/key-terms/${id}`); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-head font-semibold text-lg">Key Terms & Definitions</h2>
          <p className="text-sm text-white/40">Important terms scanned from your documents, sorted A→Z.</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-terms-btn" disabled={docs.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-300 disabled:opacity-40">
          <Sparkles className="w-4 h-4" /> Extract Terms
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-white/40 py-6">No key term sets yet. Extract them from your documents!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((k) => (
            <div key={k.id} className="glass rounded-2xl p-5 flex flex-col gap-3" data-testid={`terms-${k.id}`}>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-ace-fuchsia/15 grid place-items-center"><Library className="w-5 h-5 text-ace-fuchsia" /></div>
                <button onClick={() => del(k.id)} data-testid={`delete-terms-${k.id}`} className="text-white/30 hover:text-red-400 transition-colors duration-300 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="font-head font-semibold">{k.title}</p>
              <p className="text-xs text-white/40">{(k.terms || []).length} terms</p>
              <button onClick={() => setViewing(k)} data-testid={`open-terms-${k.id}`} className="mt-auto flex items-center justify-center gap-1.5 text-sm bg-gradient-to-r from-ace-violet to-ace-fuchsia rounded-full py-2.5 font-semibold hover:scale-[1.02] active:scale-95 transition-transform duration-300">
                <Eye className="w-4 h-4" /> View Terms
              </button>
            </div>
          ))}
        </div>
      )}
      {docs.length === 0 && <p className="text-white/40 text-sm">Upload documents first to extract key terms.</p>}
      <GenerateDialog open={open} setOpen={setOpen} docs={docs} onGenerate={gen} busy={busy} cta="Extract Terms" titlePlaceholder="Set title (optional)" hint="The AI scans thoroughly for the most important terms — this can take 15-30 seconds." />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="glass-strong border-white/10 text-white max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="font-head pr-6">{viewing?.title}</DialogTitle></DialogHeader>
          <div className="overflow-y-auto mt-2 space-y-3 pr-2" data-testid="terms-list">
            {(viewing?.terms || []).map((t, i) => (
              <div key={i} className="glass rounded-xl p-4" data-testid={`term-${i}`}>
                <p className="font-head font-semibold text-ace-cyan">{t.term}</p>
                <div className="text-sm text-white/75 mt-1"><RichText content={t.definition} /></div>
                {t.source && <p className="text-xs text-ace-violet mt-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {t.source}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduleUpload({ label, hint, fileName, uploading, onPick, inputRef, onFile, value, onChange, testid, placeholder }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold">{label} <span className="text-white/30 font-normal">(optional)</span></p>
        <button type="button" onClick={onPick} disabled={uploading} data-testid={`upload-${testid}-btn`} className="flex items-center gap-1.5 text-xs bg-ace-violet/20 hover:bg-ace-violet/30 text-white rounded-full px-3 py-1.5 transition-colors duration-300 disabled:opacity-60">
          {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading…</> : <><Upload className="w-3.5 h-3.5" /> Upload file</>}
        </button>
      </div>
      <input ref={inputRef} type="file" hidden accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp" data-testid={`upload-${testid}-input`} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="text-xs text-white/40 mb-1.5">{hint}</p>
      {fileName && <p className="text-xs text-ace-cyan mb-1.5 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {fileName}</p>}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} data-testid={`plan-${testid}`} placeholder={placeholder} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none resize-none" />
    </div>
  );
}

function Inp({ label, value, onChange, testid, placeholder }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1.5">{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} placeholder={placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none" />
    </div>
  );
}
function Txt({ label, value, onChange, testid, placeholder }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1.5">{label}</p>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} placeholder={placeholder} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-ace-violet outline-none resize-none" />
    </div>
  );
}
