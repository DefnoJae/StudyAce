import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CourseView from "@/pages/CourseView";
import QuizPlay from "@/pages/QuizPlay";
import Layout from "@/components/Layout";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-ace-bg">
      <Loader2 className="w-8 h-8 text-ace-violet animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" theme="dark" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/courses/:courseId" element={<Protected><CourseView /></Protected>} />
            <Route path="/quiz/:quizId" element={<Protected><QuizPlay /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
