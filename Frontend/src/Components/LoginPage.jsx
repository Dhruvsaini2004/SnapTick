import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { FiMail, FiLock, FiUser, FiArrowLeft, FiMoon, FiSun, FiCamera } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

export default function LoginPage({ isDark, setIsDark }) {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(!searchParams.get("register"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { login, register } = useAuth();

  useEffect(() => {
    if (searchParams.get("register") === "true") {
      setIsLogin(false);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!name) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        await register(name, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)]">
      {/* Left Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[var(--color-primary)]">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-black/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-[var(--color-primary-text)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <FiCamera className="text-xl" />
            </div>
            <span className="font-bold text-xl">SnapTick</span>
          </div>
          
          <div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Attendance made
              <br />
              effortless.
            </h1>
            <p className="text-lg opacity-80 max-w-sm">
              AI-powered face recognition for modern classrooms. 
              Save hours every week.
            </p>
          </div>
          
          <p className="text-sm opacity-60">
            Trusted by educators worldwide
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <FiArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] transition-all"
          >
            {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                <FiCamera className="text-xl text-[var(--color-primary-text)]" />
              </div>
              <span className="font-bold text-xl text-[var(--text-main)]">SnapTick</span>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-[var(--text-muted)]">
                {isLogin 
                  ? "Enter your credentials to access your dashboard" 
                  : "Start tracking attendance in minutes"}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </Motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <Motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="input-premium w-full pl-11 pr-4 py-3"
                      required={!isLogin}
                    />
                  </div>
                </Motion.div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="input-premium w-full pl-11 pr-4 py-3"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="input-premium w-full pl-11 pr-4 py-3"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[var(--color-primary-text)]/30 border-t-[var(--color-primary-text)] rounded-full animate-spin" />
                ) : (
                  isLogin ? "Sign in" : "Create account"
                )}
              </button>
            </form>

            {/* Toggle */}
            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={toggleMode}
                className="ml-1 text-[var(--color-primary)] hover:underline font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </Motion.div>
        </div>
      </div>
    </div>
  );
}
