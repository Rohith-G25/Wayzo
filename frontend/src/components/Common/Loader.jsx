import { motion } from "framer-motion";
import { FaCircleNotch, FaRoad } from "react-icons/fa";

export default function Loader({
  size = "md",
  message = "Processing road data...",
  subtext = "Syncing with AI neural vision engine",
  fullScreen = false,
  glass = true,
}) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xl",
    md: "w-12 h-12 text-2xl",
    lg: "w-16 h-16 text-3xl",
  };

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md"
    : `flex flex-col items-center justify-center p-8 rounded-2xl ${
        glass
          ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 shadow-lg"
          : "bg-transparent"
      }`;

  return (
    <div className={containerClasses}>
      <div className="relative flex items-center justify-center">
        {/* Outer ambient glow */}
        <div className="absolute -inset-3 bg-gradient-to-r from-blue-600/20 to-teal-500/20 rounded-full blur-lg animate-pulse" />

        {/* Outer spinning ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-2 border-slate-200/40 border-t-blue-600 dark:border-slate-700/40 dark:border-t-blue-400 flex items-center justify-center relative z-10`}
        />

        {/* Inner center icon */}
        <div className="absolute inset-0 flex items-center justify-center z-20 text-blue-600 dark:text-blue-400">
          <FaRoad className="text-sm opacity-90 animate-pulse" />
        </div>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 text-center z-10"
        >
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">
            {message}
          </p>
          {subtext && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {subtext}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
