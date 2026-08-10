import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, User, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      toast.success(mode === "login" ? "Welcome back!" : "Account created!");
      navigate("/");
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ace-bg relative flex items-center justify-center p-5 font-nunito overflow-hidden">
      <div className="ace-orbs" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-8 sm:p-10">
          <div className="flex flex-col items-start gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ace-violet to-ace-fuchsia grid place-items-center shadow-lg shadow-ace-violet/40 animate-float">
              <GraduationCap className="w-7 h-7 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-3xl font-head font-bold">{mode === "login" ? "Welcome back" : "Create account"}</h1>
              <p className="text-white/50 mt-1 flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-ace-cyan" /> Your AI study companion for straight A's
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === "register" && (
              <Field icon={User} placeholder="Full name" value={name} onChange={setName} testid="name-input" type="text" required />
            )}
            <Field icon={Mail} placeholder="Email" value={email} onChange={setEmail} testid="email-input" type="email" required />
            <Field icon={Lock} placeholder="Password" value={password} onChange={setPassword} testid="password-input" type="password" required />

            {error && <p className="text-sm text-red-400" data-testid="auth-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              data-testid="submit-btn"
              className="mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-ace-violet to-ace-fuchsia text-white font-semibold py-3.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform duration-300 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === "login" ? "Sign in" : "Get started")}
            </button>
          </form>

          <p className="text-center text-sm text-white/50 mt-6">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              data-testid="toggle-mode-btn"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-ace-cyan font-semibold hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon: Icon, placeholder, value, onChange, testid, type, required }) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
      <input
        data-testid={testid}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:border-ace-violet focus:ring-1 focus:ring-ace-violet outline-none transition-colors duration-300"
      />
    </div>
  );
}
