import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import detectionService from "../../services/detectionService";
import {
  FaUsers,
  FaUserPlus,
  FaShieldAlt,
  FaTrashAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,
  FaKey,
} from "react-icons/fa";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "inspector",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await detectionService.getUsers();
      setUsers(data);
    } catch (err) {
      setErrorMsg(err.message || "Failed to load user registry.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await detectionService.createUser(formData);
      setSuccessMsg(`User ${formData.email} registered successfully.`);
      setIsModalOpen(false);
      setFormData({
        full_name: "",
        email: "",
        role: "inspector",
        password: "",
      });
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await detectionService.updateUser(user.user_id, {
        is_active: !user.is_active,
      });
      setSuccessMsg(
        `User ${user.email} ${!user.is_active ? "activated" : "deactivated"}.`
      );
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || "Failed to update user status.");
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
      return;
    }
    try {
      await detectionService.deleteUser(userId);
      setSuccessMsg(`User ${userEmail} deleted successfully.`);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || "Failed to delete user.");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "inspector":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "maintenance":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#0f294a] text-white">
              <FaUsers />
            </span>
            <h1 className="text-xl font-black text-[#0f294a] tracking-tight">
              User Access & Role Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Provision and audit authorized accounts across Wayzo infrastructure
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#0f294a] hover:bg-[#183d6a] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
        >
          <FaUserPlus size={12} /> Register New Account
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
          <FaExclamationTriangle className="shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-red-500 hover:text-red-700">
            <FaTimes />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
          <FaCheckCircle className="shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <FaTimes />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <FaSearch className="text-slate-400 text-xs" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by name, email, or role..."
          className="w-full text-xs outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
            <FaTimes size={12} />
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-4">Role Clearance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 font-bold">
                    Loading account registry...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-800">{u.full_name}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getRoleBadge(
                          u.role
                        )}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-500 font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-red-400" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      {u.user_id !== currentUser?.user_id && (
                        <>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                              u.is_active
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {u.is_active ? "Suspend" : "Activate"}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.email)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete Account"
                          >
                            <FaTrashAlt size={12} />
                          </button>
                        </>
                      )}
                      {u.user_id === currentUser?.user_id && (
                        <span className="text-[10px] font-bold text-slate-400 italic">
                          Current Account
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <FaTimes />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-[#0f294a]/10 text-[#0f294a]">
                <FaUserPlus />
              </span>
              <h2 className="text-base font-black text-[#0f294a]">
                Register New User
              </h2>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#0f294a] transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="ramesh@wayzo.gov"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#0f294a] transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Role Clearance
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#0f294a] transition bg-white"
                >
                  <option value="inspector">Inspector (AI Inspections & Reports)</option>
                  <option value="maintenance">Maintenance Staff (Work Orders & Status)</option>
                  <option value="admin">Administrator (Full Access & User Ops)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Min 8 characters, letter + number"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#0f294a] transition"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#0f294a] hover:bg-[#19406f] text-white py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
