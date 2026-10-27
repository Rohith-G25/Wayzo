import {
  FaBell,
  FaSearch,
  FaMoon,
  FaUserCircle,
  FaSignOutAlt,
  FaShieldAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out of Wayzo?")) {
      logout();
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case "admin":
        return "National Administrator";
      case "inspector":
        return "Civil Field Inspector";
      case "maintenance":
        return "Maintenance Supervisor";
      default:
        return "Authorized Staff";
    }
  };

  return (
    <header className="bg-white h-20 border-b border-slate-200 flex justify-between items-center px-8 shrink-0 select-none">
      <div className="relative">
        <FaSearch className="absolute left-4 top-4.5 text-slate-400 text-xs" />
        <input
          placeholder="Search state registry databases..."
          className="bg-slate-50 text-slate-800 text-xs rounded-xl pl-12 pr-4 py-3 w-[380px] border border-slate-200 outline-none focus:border-[#0f294a] focus:bg-white transition"
        />
      </div>

      <div className="flex gap-4 items-center">
        <button className="bg-white border border-slate-200 w-11 h-11 rounded-xl text-slate-500 hover:text-slate-800 transition flex items-center justify-center">
          <FaMoon size={14} className="mx-auto" />
        </button>

        <button className="bg-white border border-slate-200 w-11 h-11 rounded-xl text-slate-500 hover:text-slate-800 transition relative flex items-center justify-center">
          <FaBell size={14} className="mx-auto" />
          <div className="w-2 h-2 rounded-full bg-red-600 absolute top-2.5 right-2.5 shadow shadow-red-600/30 animate-pulse" />
        </button>

        {/* User Profile Pill */}
        <div className="flex gap-3 items-center bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-[#0f294a]/10 text-[#0f294a] flex items-center justify-center font-black text-xs uppercase">
            {user?.full_name ? user.full_name[0] : "U"}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 leading-tight">
              {user?.full_name || "Authorized User"}
            </h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
              {getRoleDisplay(user?.role)}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 w-11 h-11 rounded-xl text-slate-500 transition flex items-center justify-center"
        >
          <FaSignOutAlt size={14} />
        </button>
      </div>
    </header>
  );
}