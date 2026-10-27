import { NavLink } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaHome,
  FaVideo,
  FaRoad,
  FaExclamationTriangle,
  FaTools,
  FaHospital,
  FaChartLine,
  FaCog,
  FaChevronLeft,
  FaChevronRight,
  FaFilm,
  FaMapMarkedAlt,
  FaUsers,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

const allMenuItems = [
  { name: "Dashboard", path: "/", icon: <FaHome />, roles: ["admin", "inspector", "maintenance"] },
  { name: "Live Camera", path: "/live-camera", icon: <FaVideo />, roles: ["admin", "inspector", "maintenance"] },
  { name: "Road Damage", path: "/road-damage", icon: <FaRoad />, roles: ["admin", "inspector"] },
  { name: "Video Inspection", path: "/video-inspection", icon: <FaFilm />, roles: ["admin", "inspector"] },
  { name: "Damage Map", path: "/map", icon: <FaMapMarkedAlt />, roles: ["admin", "inspector", "maintenance"] },
  { name: "Incidents", path: "/incidents", icon: <FaExclamationTriangle />, roles: ["admin", "inspector", "maintenance"] },
  { name: "Maintenance", path: "/maintenance", icon: <FaTools />, roles: ["admin", "inspector", "maintenance"] },
  { name: "Hospitals", path: "/hospitals", icon: <FaHospital />, roles: ["admin", "inspector", "maintenance"] },
  { name: "Analytics", path: "/analytics", icon: <FaChartLine />, roles: ["admin", "inspector", "maintenance"] },
  { name: "User Access", path: "/users", icon: <FaUsers />, roles: ["admin"] },
  { name: "Settings", path: "/settings", icon: <FaCog />, roles: ["admin", "inspector", "maintenance"] },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, hasRole } = useAuth();

  const menuItems = allMenuItems.filter((item) =>
    hasRole(...item.roles)
  );

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden select-none"
    >
      {/* Logo Container */}
      <div className="px-5 py-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-lg font-black text-[#0f294a] tracking-tight">
                Wayzo AI
              </h1>
              <p className="text-slate-400 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                City Infrastructure Registry
              </p>
            </motion.div>
          )}

          {isCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-[#0f294a]/5 border border-[#0f294a]/10 flex items-center justify-center text-[#0f294a] font-black text-sm mx-auto">
              W
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg bg-slate-50 border border-slate-200"
          >
            {isCollapsed ? <FaChevronRight size={10} /> : <FaChevronLeft size={10} />}
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {!isCollapsed && (
          <p className="text-slate-400 uppercase text-[9px] font-bold tracking-widest mb-4 px-3">
            National Database
          </p>
        )}

        <div className="space-y-1">
          {menuItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              className={({ isActive }) => `
                w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-150 group relative text-xs
                ${
                  isActive
                    ? "bg-[#0f294a] text-white font-semibold shadow-sm"
                    : "text-slate-650 hover:bg-slate-100/80 hover:text-slate-900"
                }
              `}
            >
              <span className="text-sm shrink-0">
                {item.icon}
              </span>

              {!isCollapsed && (
                <span className="tracking-wide">
                  {item.name}
                </span>
              )}

              {/* Hover Tooltip when collapsed */}
              {isCollapsed && (
                <div className="absolute left-16 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-3 rounded border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-md z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Profile/Bottom Console Details */}
      <div className="border-t border-slate-100 p-4">
        {!isCollapsed ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <h3 className="font-semibold text-xs text-slate-800 truncate">
              {user?.full_name || "Authorized Staff"}
            </h3>
            <p className="text-slate-400 text-[10px] mt-0.5 font-mono truncate">
              {user?.email || "staff@wayzo.gov"}
            </p>
            <div className="mt-2">
              <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0f294a]/10 text-[#0f294a]">
                {user?.role || "user"}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 font-mono border border-slate-200 mx-auto uppercase">
            {user?.role ? user.role.substring(0, 3) : "USR"}
          </div>
        )}
      </div>
    </motion.aside>
  );
}