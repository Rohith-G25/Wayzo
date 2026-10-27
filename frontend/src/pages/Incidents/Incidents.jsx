import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaExclamationTriangle,
  FaCarCrash,
  FaWater,
  FaSignal,
  FaTruck,
  FaBullhorn,
  FaClock,
  FaTrafficLight,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaSearch,
  FaSyncAlt,
  FaShieldAlt,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";

const initialIncidents = [
  {
    id: "INC-901",
    type: "Vehicle Accident",
    location: "Vandalur Outer Ring Rd",
    severity: "Critical",
    time: "12 mins ago",
    status: "Responding",
    icon: <FaCarCrash className="text-red-650" />,
    color: "border-red-500/20 bg-red-500/5",
    laneBlocked: "2 Lanes Blocked",
    dispatcher: "Officer R. Shreya",
    timeline: [
      { status: "Reported", time: "17:09", desc: "Computer vision trigger at Camera 03" },
      { status: "Triage", time: "17:11", desc: "Operator Rohith verified accident details" },
      { status: "Dispatched", time: "17:13", desc: "Trauma Response Squad and Towing dispatched" },
      { status: "On-site", time: "Pending", desc: "Estimated arrival in 4 mins" }
    ]
  },
  {
    id: "INC-902",
    type: "Water Logging",
    location: "Tambaram Subway Route",
    severity: "High",
    time: "28 mins ago",
    status: "Scheduled",
    icon: <FaWater className="text-blue-650" />,
    color: "border-blue-500/20 bg-blue-500/5",
    laneBlocked: "Full Closure",
    dispatcher: "System Automated",
    timeline: [
      { status: "Reported", time: "16:53", desc: "Water level sensor threshold exceeded" },
      { status: "Triage", time: "16:55", desc: "Automated route-blocking warning issued" },
      { status: "Scheduled", time: "16:58", desc: "Pumping crew queue assigned (High)" }
    ]
  },
  {
    id: "INC-903",
    type: "Broken Traffic Signal",
    location: "GST Road Junction Crossing",
    severity: "Medium",
    time: "1 hr ago",
    status: "Resolved",
    icon: <FaSignal className="text-amber-655" />,
    color: "border-amber-500/20 bg-amber-500/5",
    laneBlocked: "None (Slow Traffic)",
    dispatcher: "Engineer S. Vignesh",
    timeline: [
      { status: "Reported", time: "16:21", desc: "Cycle signal malfunction logged by control center" },
      { status: "Triage", time: "16:25", desc: "Manual override activated to flashing amber" },
      { status: "Resolved", time: "17:01", desc: "Signal logic board replaced and certified" }
    ]
  }
];

export default function Incidents() {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [selectedInc, setSelectedInc] = useState(initialIncidents[0]);
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlerts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await detectionService.getAlerts();
      if (Array.isArray(res) && res.length > 0) {
        const mapped = res.map((a, idx) => {
          const typeLower = (a.type || "").toLowerCase();
          let icon = <FaExclamationTriangle className="text-red-600" />;
          if (typeLower.includes("accident") || typeLower.includes("crash")) {
            icon = <FaCarCrash className="text-red-650" />;
          } else if (typeLower.includes("water") || typeLower.includes("flood")) {
            icon = <FaWater className="text-blue-650" />;
          } else if (typeLower.includes("signal") || typeLower.includes("light")) {
            icon = <FaSignal className="text-amber-655" />;
          }

          const timeFormatted = a.timestamp
            ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : "Just now";

          return {
            id: a.alert_id || `ALT-${idx + 101}`,
            type: a.type || "Hazard Alert",
            location: a.location || "Monitored City Expressway",
            severity: a.severity || "High",
            time: timeFormatted,
            status: a.severity === "Critical" ? "Responding" : "Scheduled",
            icon,
            color: a.severity === "Critical" ? "border-red-500/20 bg-red-500/5" : "border-blue-500/20 bg-blue-500/5",
            laneBlocked: a.severity === "Critical" ? "1-2 Lanes Restricted" : "Advisory Caution",
            dispatcher: "Autonomous Control Room",
            timeline: [
              { status: "Reported", time: timeFormatted, desc: a.description || "Alert registered by visual monitoring" },
              { status: "Triage", time: timeFormatted, desc: "System classified hazard parameters" },
              { status: "Dispatched", time: "Pending", desc: "Emergency maintenance dispatched" }
            ]
          };
        });
        setIncidents(mapped);
        setSelectedInc(mapped[0]);
      }
    } catch (err) {
      console.warn("[Incidents] Error fetching live alerts:", err);
      setError(err.message || "Failed to load live incident alerts from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const updateIncidentStatus = (id, newStatus, timelineStep) => {
    const updated = incidents.map((inc) => {
      if (inc.id === id) {
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newTimeline = [...inc.timeline, { status: timelineStep, time: timeNow, desc: `Status changed to ${timelineStep}` }];
        const updatedInc = { ...inc, status: newStatus, timeline: newTimeline };
        if (selectedInc.id === id) {
          setSelectedInc(updatedInc);
        }
        return updatedInc;
      }
      return inc;
    });
    setIncidents(updated);
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = filterSeverity === "All" || inc.severity === filterSeverity;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-600 text-2xl" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Emergency Incident Dispatch</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">Real-time incident response tracking, dispatcher console, and emergency routing logs</p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-[#0f294a]"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Severity</option>
            <option value="Medium">Medium Severity</option>
          </select>

          <div className="relative flex-1 lg:flex-initial">
            <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search active dispatches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 text-slate-850 text-xs rounded-xl pl-10 pr-4 py-3 w-full lg:w-60 border border-slate-200 outline-none focus:border-[#0f294a] transition"
            />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAlerts}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-1.5"
          >
            <FaSyncAlt className="text-[10px]" /> Retry
          </button>
        </div>
      )}

      {/* Grid structure */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Side: Incident List */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Alerts</span>
            <span className="text-[10px] text-slate-400 font-mono">Live Sync: Active</span>
          </div>

          <div className="space-y-3">
            {filteredIncidents.length === 0 ? (
              <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm">
                <FaShieldAlt className="text-slate-300 text-2xl mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Incidents Found</p>
                <p className="text-[10px] text-slate-400 mt-1">No active hazardous incident alerts match your filter.</p>
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = selectedInc && inc.id === selectedInc.id;
                const isCritical = inc.severity === "Critical";

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedInc(inc)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-white border-[#0f294a] ring-2 ring-[#0f294a]/5 shadow-md"
                        : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/55"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg border border-slate-200">
                        {inc.icon}
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs text-[#0f294a] font-bold">{inc.id}</span>
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            isCritical
                              ? "bg-red-500/10 text-red-700 border border-red-500/20"
                              : inc.severity === "High"
                              ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                          }`}>
                            {inc.severity}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-slate-800 mt-1.5 leading-snug">{inc.type}</h3>
                        <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1.5">
                          <FaMapMarkerAlt className="text-slate-400 text-[10px]" /> {inc.location}
                        </p>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-450">
                          <span className="flex items-center gap-1"><FaClock /> {inc.time}</span>
                          <span className={`font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                            inc.status === "Responding"
                              ? "bg-red-500/10 text-red-700 border border-red-500/20"
                              : inc.status === "Scheduled"
                              ? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                              : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                          }`}>{inc.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Emergency Dispatch Command Center */}
        <div className="col-span-12 lg:col-span-7">
          {selectedInc ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between h-full min-h-[600px]">
              <div>
                {/* Header block */}
                <div className="flex justify-between items-start pb-5 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-[#0f294a] bg-[#0f294a]/5 px-2.5 py-1 rounded border border-[#0f294a]/10">
                      DISPATCH INTERACTION UNIT
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 mt-3">{selectedInc.type} Alert Details</h2>
                    <p className="text-slate-500 text-xs mt-1.5">{selectedInc.location}</p>
                  </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Severity Status</span>
                  <span className={`text-md font-bold ${
                    selectedInc.severity === "Critical" ? "text-red-700" : "text-amber-700"
                  }`}>{selectedInc.severity} Emergency</span>
                </div>
              </div>

              {/* Grid content parameters */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
                {/* Diagnostic Details */}
                <div className="md:col-span-6 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Incident Metadata</h3>
                  
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lane Blockage status</span>
                      <span className="font-semibold text-slate-800">{selectedInc.laneBlocked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Incident Supervisor</span>
                      <span className="font-semibold text-slate-800">{selectedInc.dispatcher}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Incident ID</span>
                      <span className="font-mono text-[#0f294a] font-semibold">{selectedInc.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Alert Trigger Time</span>
                      <span className="font-semibold text-slate-800">{selectedInc.time}</span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Response Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl flex items-center justify-center gap-2 transition">
                      <FaBullhorn className="text-slate-500 text-[10px]" /> Send Transit Reroute Alert
                    </button>
                    <button className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl flex items-center justify-center gap-2 transition">
                      <FaTrafficLight className="text-slate-500 text-[10px]" /> Manual Signal Override
                    </button>
                  </div>
                </div>

                {/* Response Timeline logs */}
                <div className="md:col-span-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Response Dispatch Timeline</h3>
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                    {selectedInc.timeline.map((step, idx) => (
                      <div key={idx} className="relative">
                        {/* Timeline point */}
                        <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full ${
                          step.time === "Pending" ? "bg-slate-100 border border-slate-350" : "bg-[#0f294a]"
                        }`} />
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-800">{step.status}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{step.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostics Dispatch workflows */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Operational Status</span>
                <span className={`text-xs font-semibold px-2.5 py-1 mt-1 inline-block rounded ${
                  selectedInc.status === "Responding"
                    ? "bg-red-500/10 text-red-700 border border-red-500/20"
                    : selectedInc.status === "Scheduled"
                    ? "bg-blue-500/10 text-blue-700 border border-blue-550/20"
                    : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                }`}>{selectedInc.status}</span>
              </div>

              <div className="flex gap-2">
                {selectedInc.status === "Responding" ? (
                  <button
                    onClick={() => updateIncidentStatus(selectedInc.id, "Resolved", "Resolved")}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <FaCheckCircle className="text-[10px]" /> Resolve Incident
                  </button>
                ) : selectedInc.status === "Scheduled" ? (
                  <button
                    onClick={() => updateIncidentStatus(selectedInc.id, "Responding", "Dispatched")}
                    className="px-5 py-3 bg-[#0f294a] hover:bg-[#1a3f6a] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <FaTruck className="text-[10px]" /> Dispatch Crew Now
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-755 bg-emerald-500/10 px-4 py-3 border border-emerald-500/20 rounded-xl flex items-center gap-1.5">
                    <FaCheckCircle /> Audited & Closed
                  </span>
                )}
              </div>
            </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center h-full min-h-[600px] flex flex-col items-center justify-center text-slate-400">
              <FaShieldAlt className="text-3xl mb-2 text-slate-300" />
              <p className="text-xs font-semibold">Select an incident to view dispatch metadata</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
