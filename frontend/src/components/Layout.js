import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { GraduationCap, LayoutDashboard, LogOut, Sparkles } from "lucide-react";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nav = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  ];

  return (
    <div className="min-h-screen bg-ace-bg text-white relative font-nunito">
      <div className="ace-orbs" />
      <div className="relative z-10 flex">
        {/* Sidebar */}
        <aside className="glass-strong hidden md:flex flex-col w-64 min-h-screen sticky top-0 p-6 gap-8" data-testid="sidebar">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group" data-testid="logo-btn">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-ace-violet to-ace-fuchsia grid place-items-center shadow-lg shadow-ace-violet/30 group-hover:scale-105 transition-transform duration-300">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-head font-bold text-lg leading-none">StudyAce</p>
              <p className="text-xs text-white/40 mt-0.5">Straight A's, AI-powered</p>
            </div>
          </button>

          <nav className="flex flex-col gap-1.5">
            {nav.map((n) => {
              const active = location.pathname === n.path;
              return (
                <button
                  key={n.path}
                  onClick={() => navigate(n.path)}
                  data-testid={`nav-${n.label.toLowerCase()}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors duration-300 ${active ? "bg-ace-violet/20 text-white border border-ace-violet/40" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                >
                  <n.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  {n.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <div className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ace-cyan to-ace-violet grid place-items-center text-sm font-bold font-head">
                {(user?.name || "U")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
            </div>
            <button onClick={logout} data-testid="logout-btn" className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors duration-300">
              <LogOut className="w-[18px] h-[18px]" /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-screen">
          {/* Mobile top bar */}
          <div className="md:hidden glass-strong sticky top-0 z-20 flex items-center justify-between px-5 py-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-ace-violet to-ace-fuchsia grid place-items-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="font-head font-bold">StudyAce</span>
            </button>
            <button onClick={logout} data-testid="logout-btn-mobile" className="text-white/60"><LogOut className="w-5 h-5" /></button>
          </div>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-5 sm:p-8 lg:p-10 max-w-[1400px]"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
