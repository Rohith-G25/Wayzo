import { useState } from "react";
import {
  FaSlidersH,
  FaBell,
  FaFileAlt,
  FaSave,
  FaCheckCircle,
  FaDatabase,
  FaNetworkWired,
} from "react-icons/fa";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("AI Model Config");
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [accidentThreshold, setAccidentThreshold] = useState(90);
  const [potholeEnabled, setPotholeEnabled] = useState(true);
  const [accidentEnabled, setAccidentEnabled] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState("");
  const [emailAlerts, setEmailAlerts] = useState("control-room@smartroad.ai");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const tabs = [
    { id: "AI Model Config", label: "AI Scanner Config", icon: <FaSlidersH /> },
    { id: "Notifications", label: "Webhooks & Alerts", icon: <FaBell /> },
    { id: "Audit Logs", label: "System Audit Logs", icon: <FaFileAlt /> }
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto select-none text-slate-800">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <FaSave className="text-[#0f294a] text-2xl" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">System Registry Config</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">Configure computer vision alert triggers, Slack webhooks, and registry logging profiles</p>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-3 bg-[#0f294a] hover:bg-[#1a3f6a] text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-sm"
        >
          <FaSave /> Save Config
        </button>
      </div>

      {isSaved && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-700">
          <FaCheckCircle /> Configuration variables updated successfully. Relaying settings payload to Tamil Nadu backend.
        </div>
      )}

      {/* Tabs Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left column: Sidebar Tabs Selector */}
        <div className="col-span-12 md:col-span-4 xl:col-span-3 space-y-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#0f294a] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right column: Form configuration content */}
        <div className="col-span-12 md:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[450px]">
          {activeTab === "AI Model Config" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Object Spotting Thresholds</h3>
                <p className="text-slate-400 text-xs mt-1">Specify model confidence limits before logging alert records</p>
              </div>

              {/* Threshold Sliders */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Road Damage detection limit</span>
                    <span className="font-mono text-[#0f294a] font-bold">{confidenceThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#0f294a]"
                  />
                  <span className="text-[10px] text-slate-400 block">Lowest confidence needed to trigger a pothole report.</span>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Accident trigger alert limit</span>
                    <span className="font-mono text-[#0f294a] font-bold">{accidentThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={accidentThreshold}
                    onChange={(e) => setAccidentThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#0f294a]"
                  />
                  <span className="text-[10px] text-slate-400 block">Confidence required before routing emergency alarms.</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Neural Scanners</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/50 transition">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Pothole / Crack Classifier</span>
                      <span className="text-[10px] text-slate-400 mt-1 block">Active on CAM-01, CAM-04</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={potholeEnabled}
                      onChange={() => setPotholeEnabled(!potholeEnabled)}
                      className="rounded text-[#0f294a] focus:ring-[#0f294a] border-slate-300 bg-white w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/50 transition">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Accident Collision Detector</span>
                      <span className="text-[10px] text-slate-400 mt-1 block">Active on CAM-02, CAM-03</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={accidentEnabled}
                      onChange={() => setAccidentEnabled(!accidentEnabled)}
                      className="rounded text-[#0f294a] focus:ring-[#0f294a] border-slate-300 bg-white w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Notifications" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Webhooks & Alert Routing</h3>
                <p className="text-slate-400 text-xs mt-1">Configure automated incident notification webhooks and email alert lists</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Slack Alert Webhook URI</label>
                  <div className="flex gap-2">
                    <span className="bg-slate-50 px-3.5 py-3.5 rounded-xl border border-slate-200 text-slate-400 text-xs flex items-center">
                      <FaNetworkWired />
                    </span>
                    <input
                      type="text"
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                      className="bg-slate-50 text-slate-800 text-xs rounded-xl px-4 py-3.5 flex-1 border border-slate-200 outline-none focus:border-[#0f294a] transition font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-700 block">Emergency Dispatch Broadcast List</label>
                  <input
                    type="email"
                    value={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.value)}
                    className="bg-slate-50 text-slate-800 text-xs rounded-xl px-4 py-3.5 w-full border border-slate-200 outline-none focus:border-[#0f294a] transition"
                  />
                  <span className="text-[10px] text-slate-400 block font-medium">Comma-separated state agency emails.</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Audit Logs" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">System Audit Logs</h3>
                  <p className="text-slate-400 text-xs mt-1">Logs for model execution steps and supervisor actions</p>
                </div>
                <span className="text-[10px] text-slate-450 font-mono flex items-center gap-1.5"><FaDatabase /> Logs Size: 1.2MB</span>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600 max-h-[300px] overflow-y-auto">
                <p><span className="text-slate-400">[2026-07-11 17:15:22]</span> INFO: AI Model pipeline initialized on State GPU Cluster</p>
                <p><span className="text-slate-400">[2026-07-11 17:16:04]</span> ALERT: INC-901 accident log generated (confidence: 94.8%)</p>
                <p><span className="text-slate-400">[2026-07-11 17:17:10]</span> COMMAND: Dispatch crew dispatched to INC-901 by Supervisor Rohith</p>
                <p><span className="text-slate-400">[2026-07-11 17:18:45]</span> WARN: CAM-06 feed dropped frames. Triggering scheduled healthcheck ping.</p>
                <p><span className="text-slate-400">[2026-07-11 17:20:00]</span> INFO: Daily diagnostic export run. 4 road damage incidents triaged.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
