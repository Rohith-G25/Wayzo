import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FaShieldAlt, FaLock, FaArrowLeft } from "react-icons/fa";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-[#0f294a] flex items-center justify-center text-white text-xl font-black shadow-lg shadow-[#0f294a]/20 animate-bounce mb-4">
          W
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Authenticating Wayzo Registry...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-5 text-2xl">
            <FaLock />
          </div>

          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Permission Restricted (403)
          </span>

          <h2 className="text-xl font-black text-[#0f294a] mt-4 tracking-tight">
            Unauthorized Module Access
          </h2>

          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Your current assigned role (
            <span className="font-bold text-slate-800 capitalize">
              {user?.role || "user"}
            </span>
            ) does not have sufficient clearance to access this department.
            Permitted roles:{" "}
            <span className="font-bold text-[#0f294a]">
              {allowedRoles.join(", ")}
            </span>
            .
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 bg-[#0f294a] text-white py-2.5 px-4 rounded-xl text-xs font-bold hover:bg-[#163a66] transition shadow-sm"
            >
              <FaArrowLeft size={10} /> Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
