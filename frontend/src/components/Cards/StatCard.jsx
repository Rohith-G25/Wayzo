import { motion } from "framer-motion";

export default function StatCard({
  title,
  value,
  icon,
  color = "bg-white",
  subtitle,
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: .2 }}
      className={`${color} rounded-2xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between bg-white`}
    >
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
          {title}
        </p>

        <h1 className="text-3xl font-black text-slate-800 mt-2">
          {value}
        </h1>

        <p className="text-slate-450 mt-1.5 text-[10px] font-medium">
          {subtitle}
        </p>
      </div>

      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl">
        {icon}
      </div>
    </motion.div>
  );
}