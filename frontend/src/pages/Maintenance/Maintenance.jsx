import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTools,
  FaCalendarAlt,
  FaUsers,
  FaDollarSign,
  FaCheckCircle,
  FaHourglassHalf,
  FaPlus,
  FaArrowRight,
  FaExclamationTriangle,
  FaSyncAlt,
  FaTimes,
  FaSearch,
  FaFilter,
  FaMapMarkerAlt,
  FaRoad,
  FaHistory,
  FaBan,
  FaPlay,
  FaUserCheck,
  FaCheckDouble,
  FaThLarge,
  FaTable,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaClipboardList,
  FaClock,
  FaFilePdf,
  FaLock,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";
import { useAuth } from "../../context/AuthContext";
import AuthenticatedImage from "../../components/Common/AuthenticatedImage";

// Standard team rosters
const CREW_TEAMS = [
  "Alpha Patch Squad",
  "Beta Maintenance Squad",
  "Rapid Response Unit",
  "Metro Asphalt Crew",
  "Signal & Drainage Div"
];

// Workflow columns definition
const COLUMNS = [
  { id: "Open", title: "Open / Triage", color: "border-slate-300 bg-slate-50 text-slate-700", badge: "bg-slate-200 text-slate-800" },
  { id: "Assigned", title: "Assigned to Crew", color: "border-blue-300 bg-blue-50/60 text-blue-800", badge: "bg-blue-100 text-blue-800" },
  { id: "In Progress", title: "In Progress", color: "border-amber-300 bg-amber-50/60 text-amber-800", badge: "bg-amber-100 text-amber-900" },
  { id: "Completed", title: "Completed & Verified", color: "border-emerald-300 bg-emerald-50/60 text-emerald-800", badge: "bg-emerald-100 text-emerald-900" },
  { id: "Cancelled", title: "Cancelled", color: "border-rose-200 bg-rose-50/50 text-rose-700", badge: "bg-rose-100 text-rose-800" }
];

// Valid workflow transitions map
const VALID_TRANSITIONS = {
  "Open": ["Assigned", "Cancelled"],
  "Assigned": ["In Progress", "Open", "Cancelled"],
  "In Progress": ["Completed", "Assigned", "Cancelled"],
  "Completed": [],
  "Cancelled": []
};

export default function Maintenance() {
  const { user, hasRole } = useAuth();
  const canUpdateStatus = hasRole("admin", "maintenance");

  const [searchParams, setSearchParams] = useSearchParams();
  const directIdParam = searchParams.get("id");

  // Main Data States
  const [workOrders, setWorkOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // View & Filter States
  const [activeView, setActiveView] = useState("kanban"); // "kanban" | "table"
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  // Selected Detail Drawer
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [targetTransitionStatus, setTargetTransitionStatus] = useState(null);
  const [transitionNotes, setTransitionNotes] = useState("");
  const [transitionActualCost, setTransitionActualCost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Create Form State
  const [newRoadName, setNewRoadName] = useState("");
  const [newInspectionId, setNewInspectionId] = useState("");
  const [newPriority, setNewPriority] = useState("High");
  const [newCategory, setNewCategory] = useState("Pothole");
  const [newDescription, setNewDescription] = useState("");
  const [newCost, setNewCost] = useState("₹15,000");
  const [newAssignedTeam, setNewAssignedTeam] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");

  // PDF Download States
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadSummaryReport = async () => {
    setIsDownloadingPdf(true);
    try {
      await detectionService.downloadSummaryReport();
    } catch (err) {
      console.error("Summary PDF download failed:", err);
      alert(err.message || "Failed to download summary report.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadInspectionPdf = async (inspectionId) => {
    if (!inspectionId) return;
    setIsDownloadingPdf(true);
    try {
      await detectionService.downloadInspectionReport(inspectionId);
    } catch (err) {
      console.error("Inspection PDF download failed:", err);
      alert(err.message || "Failed to download inspection report.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Fetch Work Orders and Stats from MongoDB
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        detectionService.getMaintenanceTickets({
          status: statusFilter !== "all" ? statusFilter : undefined,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          team: teamFilter !== "all" ? teamFilter : undefined,
          limit: 300
        }),
        detectionService.getMaintenanceStatistics()
      ]);

      const list = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.data || []);
      setWorkOrders(list);
      setStats(statsRes?.data || statsRes || null);

      // If URL had ?id=WO-xxxx, find and select it
      if (directIdParam) {
        const found = list.find(o => (o.work_order_id === directIdParam || o.ticket_id === directIdParam));
        if (found) {
          setSelectedOrder(found);
        }
      }
    } catch (err) {
      console.error("Failed to load maintenance records:", err);
      setError("Unable to load maintenance work orders from server. Ensure the backend is reachable.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, teamFilter, directIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side search filtering
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return workOrders;
    const term = searchTerm.toLowerCase().trim();
    return workOrders.filter((wo) => {
      const idMatch = (wo.work_order_id || wo.ticket_id || "").toLowerCase().includes(term);
      const roadMatch = (wo.road_name || "").toLowerCase().includes(term);
      const inspMatch = (wo.inspection_id || wo.detection_id || "").toLowerCase().includes(term);
      const catMatch = (wo.damage_category || "").toLowerCase().includes(term);
      const teamMatch = (wo.assigned_team || "").toLowerCase().includes(term);
      return idMatch || roadMatch || inspMatch || catMatch || teamMatch;
    });
  }, [workOrders, searchTerm]);

  // Group work orders into columns for Kanban
  const kanbanColumns = useMemo(() => {
    const map = {
      Open: [],
      Assigned: [],
      "In Progress": [],
      Completed: [],
      Cancelled: []
    };

    filteredOrders.forEach((wo) => {
      let st = wo.status || "Open";
      if (st === "Pending" || st === "Pending Triage") st = "Open";
      if (st === "Scheduled") st = "Assigned";
      if (map[st]) {
        map[st].push(wo);
      } else {
        map.Open.push(wo);
      }
    });

    return map;
  }, [filteredOrders]);

  // Handle status transition initiation
  const initiateTransition = (wo, nextStatus) => {
    setSelectedOrder(wo);
    setTargetTransitionStatus(nextStatus);
    setTransitionNotes("");
    setTransitionActualCost(wo.estimated_cost || "₹15,000");
    setActionError(null);
    setIsTransitionModalOpen(true);
  };

  // Submit status transition to backend
  const confirmTransition = async () => {
    if (!selectedOrder || !targetTransitionStatus) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const orderId = selectedOrder.work_order_id || selectedOrder.ticket_id;
      const payload = {
        status: targetTransitionStatus,
        notes: transitionNotes || `Transitioned to ${targetTransitionStatus}`,
        actual_cost: targetTransitionStatus === "Completed" ? transitionActualCost : undefined,
        completion_notes: targetTransitionStatus === "Completed" ? transitionNotes : undefined
      };

      const updated = await detectionService.updateWorkOrderStatus(orderId, payload);
      const refreshedDoc = updated?.data || updated;

      // Update local state
      setWorkOrders((prev) =>
        prev.map((o) =>
          (o.work_order_id === orderId || o.ticket_id === orderId) ? refreshedDoc : o
        )
      );
      setSelectedOrder(refreshedDoc);
      setIsTransitionModalOpen(false);

      // Refresh aggregate metrics
      const newStats = await detectionService.getMaintenanceStatistics();
      setStats(newStats?.data || newStats);
    } catch (err) {
      console.error("Transition failed:", err);
      setActionError(err?.message || err?.response?.data?.detail || "Status transition was rejected by server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Assignment change
  const handleAssignTeam = async (wo, teamName) => {
    try {
      const orderId = wo.work_order_id || wo.ticket_id;
      const updated = await detectionService.updateWorkOrder(orderId, {
        assigned_team: teamName
      });
      const doc = updated?.data || updated;
      setWorkOrders((prev) =>
        prev.map((o) => (o.work_order_id === orderId || o.ticket_id === orderId) ? doc : o)
      );
      if (selectedOrder && (selectedOrder.work_order_id === orderId || selectedOrder.ticket_id === orderId)) {
        setSelectedOrder(doc);
      }
    } catch (err) {
      console.error("Assignment update failed:", err);
    }
  };

  // Handle Create Work Order submission
  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);
    try {
      const payload = {
        road_name: newRoadName || "Sector Roadway Corridor",
        inspection_id: newInspectionId.trim() || undefined,
        priority: newPriority,
        damage_category: newCategory,
        description: newDescription || `Road surface repair for ${newCategory}`,
        estimated_cost: newCost || "₹15,000",
        assigned_team: newAssignedTeam || undefined,
        target_completion_date: newTargetDate || undefined,
        status: newAssignedTeam ? "Assigned" : "Open"
      };

      const res = await detectionService.createWorkOrder(payload);
      const created = res?.data || res;

      setWorkOrders((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      setSelectedOrder(created);

      // Reset form
      setNewRoadName("");
      setNewInspectionId("");
      setNewDescription("");
      setNewAssignedTeam("");
      setNewTargetDate("");

      // Refresh statistics
      const newStats = await detectionService.getMaintenanceStatistics();
      setStats(newStats?.data || newStats);
    } catch (err) {
      console.error("Failed to create work order:", err);
      setActionError(err?.response?.data?.detail || "Failed to create work order. Please verify inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for priority badges
  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case "critical":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "high":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "medium":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "low":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0f294a] text-white flex items-center justify-center text-lg shadow-sm">
              <FaTools />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                Maintenance Work Orders
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Trackable road defect work orders, crew dispatch & lifecycle management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeView === "kanban"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaThLarge size={12} /> Board
            </button>
            <button
              onClick={() => setActiveView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeView === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaTable size={12} /> Table
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-xs font-bold flex items-center gap-1.5"
            title="Refresh from MongoDB"
          >
            <FaSyncAlt className={isLoading ? "animate-spin text-blue-600" : ""} />
          </button>

          <button
            onClick={handleDownloadSummaryReport}
            disabled={isDownloadingPdf}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            title="Download Official Executive Summary PDF"
          >
            {isDownloadingPdf ? (
              <FaSyncAlt className="animate-spin text-xs" />
            ) : (
              <FaFilePdf />
            )}
            Summary PDF
          </button>

          <button
            onClick={() => {
              setActionError(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <FaPlus /> Create Work Order
          </button>
        </div>
      </div>

      {/* KPI Metric Strip (Dynamic from MongoDB) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Work Orders</span>
            <FaClipboardList className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {stats ? stats.total_work_orders : workOrders.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Logged in MongoDB</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/70 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Queue</span>
            <FaHourglassHalf />
          </div>
          <div className="text-2xl font-black text-blue-800 font-mono">
            {stats ? (stats.open_work_orders + stats.assigned_work_orders + stats.in_progress_work_orders) : "-"}
          </div>
          <div className="text-[11px] text-blue-600 font-semibold mt-1">
            {stats?.in_progress_work_orders || 0} in progress
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/70 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
            <FaCheckCircle />
          </div>
          <div className="text-2xl font-black text-emerald-800 font-mono">
            {stats ? stats.completed_work_orders : "-"}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Verified repairs</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200/70 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">High / Critical Unresolved</span>
            <FaExclamationTriangle />
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {stats ? stats.high_priority_unresolved : "-"}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">Requires immediate crew</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Est. Repair Cost</span>
            <FaDollarSign className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {stats?.formatted_total_estimated_cost || "₹0"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate" title="Automated heuristic estimate">
            *Heuristic estimate
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search road, WO-ID, inspection..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <FaTimes size={10} />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Defects</option>
            <option value="Pothole">Pothole</option>
            <option value="Longitudinal Crack">Longitudinal Crack</option>
            <option value="Transverse Crack">Transverse Crack</option>
            <option value="Alligator Crack">Alligator Crack</option>
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Teams</option>
            <option value="unassigned">Unassigned</option>
            {CREW_TEAMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {(statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || teamFilter !== "all" || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setCategoryFilter("all");
                setTeamFilter("all");
                setSearchTerm("");
              }}
              className="text-xs text-rose-600 font-bold hover:underline px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Kanban or Table */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <FaSyncAlt className="animate-spin text-3xl text-blue-600 mx-auto" />
          <p className="text-xs font-bold text-slate-600">Loading work orders from MongoDB...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2 text-rose-800">
          <FaExclamationTriangle className="text-2xl text-rose-600 mx-auto" />
          <p className="text-xs font-bold">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
            <FaTools size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Work Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No maintenance records match your active search filters or database is currently empty.
          </p>
        </div>
      ) : activeView === "kanban" ? (
        /* ================= KANBAN BOARD VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {COLUMNS.map((col) => {
            const items = kanbanColumns[col.id] || [];
            return (
              <div
                key={col.id}
                className="bg-slate-100/70 rounded-2xl p-3 border border-slate-200 flex flex-col gap-3 min-h-[480px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{col.title}</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.badge}`}>
                    {items.length}
                  </span>
                </div>

                {/* Column Card List */}
                <div className="space-y-2.5 overflow-y-auto max-h-[700px] pr-0.5">
                  {items.map((wo) => {
                    const woId = wo.work_order_id || wo.ticket_id;
                    const nextAllowed = VALID_TRANSITIONS[col.id] || [];
                    return (
                      <motion.div
                        key={woId}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white rounded-xl p-3.5 border shadow-xs hover:shadow-md transition cursor-pointer space-y-2.5 ${
                          selectedOrder?.work_order_id === woId ? "ring-2 ring-blue-500 border-blue-400" : "border-slate-200"
                        }`}
                        onClick={() => setSelectedOrder(wo)}
                      >
                        {/* Card Header: ID & Priority */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {woId}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getPriorityBadge(wo.priority)}`}>
                            {wo.priority || "Medium"}
                          </span>
                        </div>

                        {/* Road Name */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-2 flex items-start gap-1">
                            <FaMapMarkerAlt className="text-slate-400 mt-0.5 shrink-0 text-[10px]" />
                            {wo.road_name}
                          </h4>
                          {wo.damage_category && (
                            <span className="inline-block mt-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {wo.damage_category}
                            </span>
                          )}
                        </div>

                        {/* Linked Inspection & Cost */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                          {wo.inspection_id ? (
                            <span className="font-mono text-[10px] text-slate-600 flex items-center gap-1">
                              <FaClipboardList className="text-[9px]" /> {wo.inspection_id}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Manual Entry</span>
                          )}
                          <span className="font-bold font-mono text-slate-800">{wo.estimated_cost}</span>
                        </div>

                        {/* Crew Assignment */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                          <span className="text-slate-400 flex items-center gap-1">
                            <FaUsers />
                            <span className="truncate max-w-[110px] font-medium text-slate-700">
                              {wo.assigned_team || "Unassigned"}
                            </span>
                          </span>

                          {/* Quick Lifecycle Progress Button */}
                          {nextAllowed.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                initiateTransition(wo, nextAllowed[0]);
                              }}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                              title={`Advance to ${nextAllowed[0]}`}
                            >
                              Move to {nextAllowed[0]} <FaArrowRight size={8} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-[11px] italic">
                      No records in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= DATA TABLE VIEW ================= */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="p-3.5 pl-5">Work Order ID</th>
                  <th className="p-3.5">Roadway / Location</th>
                  <th className="p-3.5">Defect Category</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Assigned Crew</th>
                  <th className="p-3.5">Estimated Cost</th>
                  <th className="p-3.5">Created Date</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((wo) => {
                  const woId = wo.work_order_id || wo.ticket_id;
                  const nextAllowed = VALID_TRANSITIONS[wo.status || "Open"] || [];
                  return (
                    <tr
                      key={woId}
                      onClick={() => setSelectedOrder(wo)}
                      className={`hover:bg-blue-50/40 transition cursor-pointer ${
                        selectedOrder?.work_order_id === woId ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <td className="p-3.5 pl-5 font-mono font-bold text-blue-700">
                        {woId}
                      </td>
                      <td className="p-3.5 font-medium text-slate-800 max-w-xs truncate">
                        {wo.road_name}
                      </td>
                      <td className="p-3.5 text-slate-600 font-medium">
                        {wo.damage_category || "Road Defect"}
                      </td>
                      <td className="p-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(wo.priority)}`}>
                          {wo.priority || "Medium"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-[11px] text-slate-700">
                          {wo.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {wo.assigned_team || <span className="text-amber-600 font-bold">Unassigned</span>}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">
                        {wo.estimated_cost}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="p-3.5 text-right pr-5" onClick={(e) => e.stopPropagation()}>
                        {nextAllowed.length > 0 && (
                          <button
                            onClick={() => initiateTransition(wo, nextAllowed[0])}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-bold text-slate-700 transition"
                          >
                            Advance to {nextAllowed[0]}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= WORK ORDER INSPECTOR DRAWER ================= */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ x: 450 }}
              animate={{ x: 0 }}
              exit={{ x: 450 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                    {selectedOrder.work_order_id || selectedOrder.ticket_id}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(selectedOrder.priority)}`}>
                    {selectedOrder.priority} Priority
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    {selectedOrder.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 space-y-5 flex-1 overflow-y-auto text-xs">
                {/* Road Location & Scope */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Location & Scope
                  </span>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                    <FaMapMarkerAlt className="text-rose-500 shrink-0" />
                    {selectedOrder.road_name}
                  </h3>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
                    {selectedOrder.description}
                  </p>
                </div>

                {/* Linked Inspection Details Card */}
                {selectedOrder.inspection_id && (
                  <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100 space-y-2.5">
                    <div className="flex items-center justify-between text-blue-900 font-bold text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <FaClipboardList /> Linked AI Inspection Session
                      </span>
                      <span className="font-mono">{selectedOrder.inspection_id}</span>
                    </div>

                    {selectedOrder.image_url && (
                      <div className="relative rounded-lg overflow-hidden border border-blue-200 max-h-44 bg-slate-900">
                        <AuthenticatedImage
                          src={detectionService.getMediaUrl(selectedOrder.image_url)}
                          alt="Defect Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Genuine GPS Coordinates */}
                    <div className="text-[11px] text-slate-700 space-y-1">
                      <div className="font-semibold text-slate-500 text-[10px] uppercase">
                        Verified Geolocation
                      </div>
                      {selectedOrder.gps ? (
                        <div className="font-mono flex items-center justify-between bg-white p-2 rounded-lg border border-blue-100">
                          <span>
                            {selectedOrder.gps.latitude?.toFixed(5)}, {selectedOrder.gps.longitude?.toFixed(5)}
                          </span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            Source: {selectedOrder.gps_source || "GPS"}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-400 italic">No GPS coordinates recorded for this inspection</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Repair & Cost Breakdown */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Estimated Repair Cost</span>
                    <span className="text-lg font-black font-mono text-slate-800">{selectedOrder.estimated_cost}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Actual Completed Cost</span>
                    <span className="text-lg font-black font-mono text-emerald-700">
                      {selectedOrder.actual_cost || "-"}
                    </span>
                  </div>
                </div>

                {/* Crew Assignment & Target Date */}
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <FaUsers className="text-slate-400" /> Assigned Crew:
                    </span>
                    <select
                      value={selectedOrder.assigned_team || ""}
                      onChange={(e) => handleAssignTeam(selectedOrder, e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="">Unassigned</option>
                      {CREW_TEAMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {selectedOrder.target_completion_date && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-600">
                      <span className="flex items-center gap-1.5 font-medium">
                        <FaCalendarAlt className="text-slate-400" /> Target Date:
                      </span>
                      <span className="font-mono font-bold">{selectedOrder.target_completion_date}</span>
                    </div>
                  )}
                </div>

                {/* State Transition Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Workflow Actions
                  </span>
                  {canUpdateStatus ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {(VALID_TRANSITIONS[selectedOrder.status] || []).map((nextSt) => (
                        <button
                          key={nextSt}
                          onClick={() => initiateTransition(selectedOrder, nextSt)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            nextSt === "Completed"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              : nextSt === "Cancelled"
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                          }`}
                        >
                          {nextSt === "Completed" && <FaCheckDouble />}
                          {nextSt === "Cancelled" && <FaBan />}
                          {nextSt === "In Progress" && <FaPlay />}
                          {nextSt === "Assigned" && <FaUserCheck />}
                          Transition to {nextSt}
                        </button>
                      ))}
                      {(VALID_TRANSITIONS[selectedOrder.status] || []).length === 0 && (
                        <span className="text-[11px] text-slate-400 italic">
                          Work order has reached terminal status ({selectedOrder.status}).
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
                      <FaLock className="shrink-0 text-amber-600" />
                      <span>Status updates restricted to Maintenance Staff & Administrators.</span>
                    </div>
                  )}
                </div>

                {/* Status History / Audit Trail */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FaHistory className="text-slate-400" /> Status Audit Trail
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(selectedOrder.status_history || []).map((h, i) => (
                      <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between text-slate-700 font-bold">
                          <span>{h.from_status ? `${h.from_status} → ${h.to_status}` : `Initial: ${h.to_status}`}</span>
                          <span className="text-[9px] font-normal text-slate-400">
                            {h.changed_at ? new Date(h.changed_at).toLocaleString() : ""}
                          </span>
                        </div>
                        {h.notes && <p className="text-slate-500 text-[10px]">{h.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Engineering Disclaimers */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[10px] text-amber-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1 mb-0.5">
                    <FaInfoCircle className="text-amber-600" /> Certified Civil Engineering Disclaimer
                  </div>
                  {selectedOrder.severity_disclaimer ||
                    "Heuristic calculation based on bounding-box surface area and model confidence; not a certified civil/pavement engineering assessment."}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-3">
                  <Link
                    to="/map"
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <FaMapMarkerAlt /> Damage Map
                  </Link>
                  {selectedOrder.inspection_id && (
                    <button
                      onClick={() => handleDownloadInspectionPdf(selectedOrder.inspection_id)}
                      disabled={isDownloadingPdf}
                      className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                      title="Download Linked AI Inspection PDF Report"
                    >
                      <FaFilePdf /> Inspection PDF
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= STATUS TRANSITION MODAL ================= */}
      <AnimatePresence>
        {isTransitionModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <FaTools className="text-blue-600" />
                  Transition to {targetTransitionStatus}
                </h3>
                <button
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {actionError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                Moving <span className="font-mono font-bold text-blue-700">{selectedOrder?.work_order_id}</span> from{" "}
                <span className="font-bold">{selectedOrder?.status}</span> to{" "}
                <span className="font-bold text-blue-700">{targetTransitionStatus}</span>.
              </p>

              {/* If completing: ask for actual cost */}
              {targetTransitionStatus === "Completed" && (
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-700">Actual Cost Incurred (₹)</label>
                  <input
                    type="text"
                    value={transitionActualCost}
                    onChange={(e) => setTransitionActualCost(e.target.value)}
                    placeholder="e.g. ₹14,500"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              )}

              {/* Operational Notes */}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-700">Operational / Audit Notes</label>
                <textarea
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder="Describe status reason or crew feedback..."
                  rows={3}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmTransition}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isSubmitting && <FaSyncAlt className="animate-spin text-xs" />}
                  Confirm Transition
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= CREATE WORK ORDER MODAL ================= */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <FaPlus className="text-blue-600" />
                  Create Trackable Work Order
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleCreateWorkOrder} className="space-y-3.5 text-xs">
                {/* Road / Location Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Roadway Corridor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ring Road Bypass, Km 14"
                    value={newRoadName}
                    onChange={(e) => setNewRoadName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* Linked Inspection ID (Optional) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Linked Inspection ID (Optional - verifies GPS from MongoDB)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DET-05fb1b19"
                    value={newInspectionId}
                    onChange={(e) => setNewInspectionId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    If provided, genuine coordinates and defect classes are pulled directly from the inspection.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Damage Category */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Damage Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="Pothole">Pothole</option>
                      <option value="Longitudinal Crack">Longitudinal Crack</option>
                      <option value="Transverse Crack">Transverse Crack</option>
                      <option value="Alligator Crack">Alligator Crack</option>
                      <option value="General Road Surface Damage">General Surface Damage</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Priority Level</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Estimated Cost */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Estimated Cost</label>
                    <input
                      type="text"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      placeholder="e.g. ₹15,000"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  {/* Assign to Crew */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Dispatch Crew (Optional)</label>
                    <select
                      value={newAssignedTeam}
                      onChange={(e) => setNewAssignedTeam(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="">Leave Unassigned (Open)</option>
                      {CREW_TEAMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Target Completion Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Target Completion Date (Optional)</label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Repair Scope & Description</label>
                  <textarea
                    rows={3}
                    placeholder="Details about repair method, required asphalt mix, or traffic diversion..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    {isSubmitting && <FaSyncAlt className="animate-spin text-xs" />}
                    Create Work Order
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
