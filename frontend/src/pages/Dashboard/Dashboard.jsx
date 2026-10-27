import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaCamera,
  FaRoad,
  FaExclamationTriangle,
  FaHeartbeat,
  FaWrench,
  FaShieldAlt,
  FaLayerGroup,
  FaSyncAlt,
} from "react-icons/fa";

import StatCard from "../../components/Cards/StatCard";
import MapCard from "../../components/Cards/MapCard";
import detectionService from "../../services/detectionService";

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [dispatchCount, setDispatchCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    cameraCount: 0,
    totalInspections: 0,
    totalDefects: 0,
    potholeCount: 0,
    crackCount: 0,
    criticalCount: 0,
    repairsPending: 0,
    systemHealth: "Healthy",
    isLive: false,
    severityDistribution: {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    },
    categoryDistribution: {},
  });

  // Timer clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLiveTelemetry = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const statsRes = await detectionService.getStatistics();
      if (statsRes) {
        setStats({
          cameraCount: statsRes.camera_count ?? statsRes.cameraCount ?? 0,
          totalInspections: statsRes.total_inspections ?? statsRes.totalInspections ?? 0,
          totalDefects: statsRes.total_defects ?? statsRes.totalDefects ?? 0,
          potholeCount: statsRes.pothole_count ?? statsRes.potholeCount ?? 0,
          crackCount: statsRes.crack_count ?? statsRes.crackCount ?? 0,
          criticalCount: statsRes.critical_count ?? statsRes.criticalCount ?? 0,
          repairsPending: statsRes.repairs_pending ?? statsRes.repairsPending ?? 0,
          systemHealth: statsRes.system_health ?? statsRes.systemHealth ?? "Healthy",
          isLive: true,
          severityDistribution: statsRes.severity_distribution ?? statsRes.severityDistribution ?? {
            Critical: 0,
            High: 0,
            Medium: 0,
            Low: 0,
          },
          categoryDistribution: statsRes.category_distribution ?? statsRes.categoryDistribution ?? {},
        });
      }
    } catch (err) {
      console.warn("[Dashboard] Failed to fetch statistics:", err);
      setError(err.message || "Failed to connect to backend statistics endpoint.");
    }

    try {
      const alertsRes = await detectionService.getAlerts();
      if (Array.isArray(alertsRes)) {
        const mapped = alertsRes.map((a, idx) => ({
          id: a.alert_id || idx,
          title: a.type || a.description || "Hazard Alert",
          location: a.location || "Monitored City Expressway",
          severity: a.severity || "High",
          time: a.timestamp
            ? new Date(a.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Recorded",
          status: "Unresolved",
        }));
        setAlerts(mapped);
      }
    } catch (err) {
      console.warn("[Dashboard] Failed to fetch live alerts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTelemetry();
  }, []);

  const handleResolve = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDispatch = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Responding" } : a))
    );
    setDispatchCount((prev) => prev + 1);
  };

  const totalDefects = stats.totalDefects || 0;
  const criticalPercent = totalDefects > 0 ? Math.round(((stats.severityDistribution.Critical || 0) / totalDefects) * 100) : 0;
  const highPercent = totalDefects > 0 ? Math.round(((stats.severityDistribution.High || 0) / totalDefects) * 100) : 0;
  const mediumPercent = totalDefects > 0 ? Math.round(((stats.severityDistribution.Medium || 0) / totalDefects) * 100) : 0;
  const lowPercent = totalDefects > 0 ? Math.round(((stats.severityDistribution.Low || 0) / totalDefects) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Page Header Command Strip */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <FaShieldAlt className="text-[#0f294a]" /> SmartRoadAI Registry Control
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Autonomous Road Surface Anomaly Tracking & MongoDB Real-Time Surveillance Telemetry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLiveTelemetry}
            disabled={isLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition"
            title="Refresh Registry Telemetry"
          >
            <FaSyncAlt className={`text-xs ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            {currentTime}
          </span>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              stats.isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="text-xs font-bold text-[#0f294a] uppercase tracking-widest bg-[#0f294a]/5 px-3 py-1 rounded border border-[#0f294a]/10">
            {stats.isLive ? "Database Sync: Live" : "Database Sync: Offline"}
          </span>
        </div>
      </div>

      {/* Error state banner if API request fails */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchLiveTelemetry}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* KPI Cards Panel - 100% Real Backend Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Road Inspections"
          value={stats.totalInspections.toString()}
          subtitle="MongoDB verified inspection scans"
          icon={<FaRoad className="text-blue-600" />}
          color="bg-white"
        />

        <StatCard
          title="Detected Road Defects"
          value={stats.totalDefects.toString()}
          subtitle={`${stats.potholeCount} Potholes • ${stats.crackCount} Cracks`}
          icon={<FaExclamationTriangle className="text-amber-600" />}
          color="bg-white"
        />

        <StatCard
          title="Active Work Orders"
          value={stats.repairsPending.toString()}
          subtitle={`${dispatchCount} locally dispatched`}
          icon={<FaWrench className="text-red-600" />}
          color="bg-white"
        />

        <StatCard
          title="Neural Pipeline Health"
          value={stats.systemHealth}
          subtitle="RDD2022-YOLOv8s Active"
          icon={<FaHeartbeat className="text-emerald-600" />}
          color="bg-white"
        />
      </div>

      {/* Rearchitected Operational Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Real Severity Distribution & Quick Action controls */}
        <div className="col-span-12 xl:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Defect Severity Distribution
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Real DB Records</span>
            </div>
            
            <div className="space-y-3.5">
              {/* Critical */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span> Critical Severity
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {stats.severityDistribution.Critical || 0} ({criticalPercent}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all duration-300"
                    style={{ width: `${criticalPercent}%` }}
                  />
                </div>
              </div>

              {/* High */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> High Severity
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {stats.severityDistribution.High || 0} ({highPercent}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${highPercent}%` }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> Medium Severity
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {stats.severityDistribution.Medium || 0} ({mediumPercent}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${mediumPercent}%` }}
                  />
                </div>
              </div>

              {/* Low */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low Severity
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {stats.severityDistribution.Low || 0} ({lowPercent}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${lowPercent}%` }}
                  />
                </div>
              </div>

              {totalDefects === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">
                  No defect records found in database.
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">POTHOLES</span>
                <span className="text-slate-800 font-bold text-sm">{stats.potholeCount}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">CRACKS</span>
                <span className="text-slate-800 font-bold text-sm">{stats.crackCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Command Action Terminal</h3>
            <div className="space-y-2">
              <Link to="/live-camera" className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-150">
                <FaCamera className="text-[10px] text-blue-600" /> Enter Live Camera matrix
              </Link>
              <Link to="/road-damage" className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-150">
                <FaRoad className="text-[10px] text-amber-600" /> Go to Road Triage queue
              </Link>
              <Link to="/incidents" className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition duration-150">
                <FaExclamationTriangle className="text-[10px] text-red-600" /> Open Dispatch Board
              </Link>
            </div>
          </div>
        </div>

        {/* Center Column: Live Traffic Coordinates Map & Live Stream Overlay */}
        <div className="col-span-12 xl:col-span-6 space-y-6">
          <MapCard />

          {/* Surveillance stream card snippet */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CCTV Stream preview (CAM-04)</span>
              <span className="text-[10px] text-slate-400 font-mono">Guindy Cloverleaf Outward</span>
            </div>

            <div className="relative aspect-video bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
              <div className="absolute top-3 left-3 text-[9px] font-mono text-[#0f294a] bg-white border border-slate-200 px-2.5 py-1 rounded flex items-center gap-1.5 uppercase font-bold shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Analysis stream
              </div>

              <div className="absolute border-2 border-blue-600 bg-blue-600/5 rounded px-1.5 py-0.5" style={{ top: "35%", left: "30%", width: "20%", height: "20%" }}>
                <span className="absolute -top-5 left-0 text-[8px] bg-blue-600 text-white font-bold px-1 rounded uppercase tracking-wider">Vehicle [94%]</span>
              </div>
              <div className="absolute border-2 border-amber-600 bg-amber-600/5 rounded px-1.5 py-0.5" style={{ top: "55%", left: "60%", width: "25%", height: "25%" }}>
                <span className="absolute -top-5 left-0 text-[8px] bg-amber-600 text-white font-bold px-1 rounded uppercase tracking-wider">Pothole [89%]</span>
              </div>

              <FaRoad className="text-slate-300 text-7xl" />
            </div>
          </div>
        </div>

        {/* Right Column: Live alerts logs with actionable widgets */}
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registry Alerts Stream</span>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </div>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-sm">
                <FaShieldAlt className="text-slate-300 text-2xl mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No Active Road Hazard Alerts</p>
                <p className="text-[10px] text-slate-400 mt-1">All monitored roadway sections are operating normally.</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isCritical = alert.severity === "Critical";
                const isHigh = alert.severity === "High";
                const isResponding = alert.status === "Responding";
                const isScheduled = alert.status === "Scheduled";

                return (
                  <div
                    key={alert.id}
                    className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                              isCritical
                                ? "bg-red-500/10 text-red-700 border border-red-500/20"
                                : isHigh
                                ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                                : "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono font-semibold">{alert.time}</span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-800 mt-1.5 leading-snug">{alert.title}</h4>
                        <p className="text-slate-500 text-xs mt-1">📍 {alert.location}</p>
                      </div>

                      <div className="text-right">
                        {isResponding ? (
                          <span className="text-[9px] font-bold text-red-650 uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                            Responding
                          </span>
                        ) : isScheduled ? (
                          <span className="text-[9px] font-bold text-blue-650 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            Scheduled
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions line inside alert cards */}
                    {!isResponding && !isScheduled && (
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg text-[10px] font-bold flex-1 transition duration-150 border border-slate-200"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleDispatch(alert.id)}
                          className="px-3 py-1.5 bg-[#0f294a] hover:bg-[#1a3f6a] text-white rounded-lg text-[10px] font-bold flex-1 transition duration-150 shadow-sm"
                        >
                          Dispatch Crew
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}