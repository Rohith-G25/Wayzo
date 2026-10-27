import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FaRoad,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to requested page after login, or dashboard
  const destination = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMsg(
        err.message || "Failed to authenticate. Please check your credentials."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (roleEmail, rolePassword) => {
    setEmail(roleEmail);
    setPassword(rolePassword);
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-[#071322] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-500/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0f233a]/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/50">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-cyan-500/20 mb-4">
            <FaRoad />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            Wayzo AI Infrastructure
          </h1>
          <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest mt-1">
            Civil Road Registry & AI Surveillance
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-slate-400 text-xs">
            <FaShieldAlt className="text-emerald-400" size={11} />
            <span>Secure Role-Based Access Control</span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mb-6 bg-red-950/60 border border-red-500/40 rounded-xl p-3.5 flex items-start gap-3 text-red-200 text-xs animate-shake">
            <FaExclamationCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Official Email Address
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-4 top-3.5 text-slate-400 text-sm" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@wayzo.gov"
                className="w-full bg-slate-900/80 border border-slate-700 text-white text-sm rounded-xl pl-11 pr-4 py-3 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Access Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-4 top-3.5 text-slate-400 text-sm" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900/80 border border-slate-700 text-white text-sm rounded-xl pl-11 pr-11 py-3 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition"
              >
                {showPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <span>Sign In to Terminal</span>
            )}
          </button>
        </form>

        {/* Development Quick Test Preset Credentials (disabled in production) */}
        {import.meta.env.DEV && (
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Development Test Presets (Dev Mode Only)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@wayzo.gov", "AdminPass123!")}
                className="bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 rounded-lg p-2.5 text-left transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                    Administrator
                  </span>
                  <FaCheckCircle className="text-slate-600 group-hover:text-cyan-400 text-xs" />
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5 truncate">
                  admin@wayzo.gov
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("inspector@wayzo.gov", "InspectorPass123!")}
                className="bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 rounded-lg p-2.5 text-left transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    Inspector
                  </span>
                  <FaCheckCircle className="text-slate-600 group-hover:text-amber-400 text-xs" />
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5 truncate">
                  inspector@wayzo.gov
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="text-[10px] text-slate-500 text-center mt-6">
          Authorized personnel only. Sessions are encrypted using HS256 tokens and
          rate-limited against unauthorized entry.
        </p>
      </div>
    </div>
  );
}
