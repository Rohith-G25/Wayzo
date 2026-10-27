import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaVideo,
  FaVideoSlash,
  FaExpand,
  FaCog,
  FaSearch,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";

const fallbackCameras = [
  { id: "CAM-01", name: "GST Road - Flyover Exit", status: "Active", location: "Chromepet", speed: "52 km/h", count: 18, severity: "None" },
  { id: "CAM-02", name: "Tambaram Junction East", status: "Active", location: "Tambaram", speed: "22 km/h", count: 34, severity: "High (Congestion)" },
  { id: "CAM-03", name: "Vandalur Outer Ring Rd", status: "Active", location: "Vandalur", speed: "84 km/h", count: 12, severity: "None" },
  { id: "CAM-04", name: "OMR Tech Corridor", status: "Active", location: "Sholinganallur", speed: "41 km/h", count: 25, severity: "Medium (Pothole)" },
  { id: "CAM-05", name: "Guindy Kathipara Clover", status: "Active", location: "Guindy", speed: "35 km/h", count: 42, severity: "None" },
  { id: "CAM-06", name: "Pallavaram Radial Road", status: "Maintenance", location: "Pallavaram", speed: "0 km/h", count: 0, severity: "Offline" },
];

export default function LiveMonitoring() {
  const [cameras, setCameras] = useState(fallbackCameras);
  const [selectedCam, setSelectedCam] = useState(fallbackCameras[0]);
  const [gridSize, setGridSize] = useState(4); // 4 for 2x2, 6 for 3x2
  const [searchQuery, setSearchQuery] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [aiScannerEnabled, setAiScannerEnabled] = useState(true);
  const [flowVectorsEnabled, setFlowVectorsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCameras = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await detectionService.getCameras();
      if (Array.isArray(res) && res.length > 0) {
        const mapped = res.map((cam, idx) => ({
          id: cam.camera_id || `CAM-${idx + 1}`,
          name: cam.location || `Surveillance Node ${cam.camera_id}`,
          status: cam.status || "Active",
          location: cam.location || "Monitored Expressway",
          gps: cam.gps,
          speed: cam.status === "Maintenance" || cam.status === "Inactive" ? "0 km/h" : `${42 + ((idx * 13) % 40)} km/h`,
          count: cam.status === "Maintenance" || cam.status === "Inactive" ? 0 : 18 + ((idx * 7) % 25),
          severity: cam.status === "Maintenance" ? "Offline" : (idx % 2 === 1 ? "Medium (Pothole)" : "None"),
        }));
        setCameras(mapped);
        setSelectedCam(mapped[0]);
      }
    } catch (err) {
      console.warn("[LiveMonitoring] Error fetching cameras:", err);
      setError(err.message || "Failed to load camera feeds from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredCams = cameras.filter((cam) =>
    cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cam.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Video Surveillance Registry</h1>
          </div>
          <p className="text-slate-505 text-xs mt-1">Real-time object tracking and infrastructure anomaly analysis feeds</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Grid Size Selectors */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setGridSize(4)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                gridSize === 4 ? "bg-[#0f294a] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              2x2 Grid
            </button>
            <button
              onClick={() => setGridSize(6)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                gridSize === 6 ? "bg-[#0f294a] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              3x2 Matrix
            </button>
          </div>

          <div className="relative flex-1 lg:flex-initial">
            <FaSearch className="absolute left-3.5 top-3.5 text-slate-450 text-sm" />
            <input
              type="text"
              placeholder="Search camera registry ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 text-slate-800 text-xs rounded-xl pl-10 pr-4 py-3 w-full lg:w-64 border border-slate-200 outline-none focus:border-[#0f294a] focus:bg-white transition"
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
            onClick={fetchCameras}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-1.5"
          >
            <FaSyncAlt className="text-[10px]" /> Retry
          </button>
        </div>
      )}

      {/* Main Panel */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Surveillance Feed Grid */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          {filteredCams.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <FaVideoSlash className="text-slate-300 text-3xl mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No Cameras Found</p>
              <p className="text-xs text-slate-400 mt-1">No cameras match your search filter or registry is empty.</p>
            </div>
          ) : (
            <div className={`grid gap-4 ${gridSize === 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
              {filteredCams.slice(0, gridSize).map((cam) => {
                const isActive = selectedCam && cam.id === selectedCam.id;
                const isMaintenance = cam.status === "Maintenance";

                return (
                  <motion.div
                    key={cam.id}
                    whileHover={{ scale: 1.005, y: -1 }}
                    onClick={() => setSelectedCam(cam)}
                    className={`relative aspect-video bg-slate-50 rounded-xl overflow-hidden border cursor-pointer transition-all duration-150 ${
                      isActive ? "border-[#0f294a] ring-2 ring-[#0f294a]/5 shadow-sm" : "border-slate-200 hover:border-slate-350"
                    }`}
                  >
                  {/* Camera Canvas Stream Simulation */}
                  {isMaintenance ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                      <FaVideoSlash className="text-3xl mb-2 text-amber-500 animate-pulse" />
                      <span className="text-xs font-semibold uppercase">Feed Offline</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-slate-50">
                      {/* Grid background simulation */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:24px_24px]" />
                      
                      {/* Interactive UI Layers */}
                      {aiScannerEnabled && (
                        <>
                          {/* Simulated Target 1 (Car) */}
                          <div className="absolute border-2 border-blue-600 bg-blue-600/5 rounded px-1.5 py-0.5" style={{ top: "25%", left: "40%", width: "24%", height: "20%" }}>
                            <span className="absolute -top-4 left-0 text-[8px] bg-blue-600 text-white font-bold px-1 rounded uppercase tracking-wider">Sedan [89%]</span>
                          </div>
                          
                          {/* Simulated Target 2 (Speed) */}
                          <div className="absolute border border-slate-400 bg-slate-400/5 rounded px-1.5 py-0.5" style={{ top: "45%", left: "15%", width: "18%", height: "18%" }}>
                            <span className="absolute -top-4 left-0 text-[8px] bg-slate-700 text-white font-bold px-1 rounded uppercase tracking-wider">{cam.speed}</span>
                          </div>

                          {/* Simulated Target 3 (Anomaly in Cam 4 or Cam 2) */}
                          {(cam.id === "CAM-04" || cam.id === "CAM-02") && (
                            <div className="absolute border-2 border-red-500 bg-red-500/5 rounded px-1.5 py-0.5 animate-pulse" style={{ top: "60%", left: "65%", width: "22%", height: "22%" }}>
                              <span className="absolute -top-4 left-0 text-[8px] bg-red-600 text-white font-bold px-1 rounded flex items-center gap-0.5 uppercase tracking-wider font-mono">
                                {cam.id === "CAM-04" ? "POTHOLE" : "CONGEST"}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Camera Details Overlay */}
                  <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-white/95 to-transparent flex justify-between items-center">
                    <span className="text-[10px] font-bold font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 shadow-sm">
                      {cam.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!isMaintenance && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                        isMaintenance ? "bg-amber-500/10 text-amber-700 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-700 border border-emerald-555/20"
                      }`}>
                        {cam.status}
                      </span>
                    </div>
                  </div>

                  {/* Camera Name Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-white/95 to-transparent flex justify-between items-end">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800">{cam.name}</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">{cam.location}</p>
                    </div>
                    {!isMaintenance && (
                      <span className="text-[10px] text-[#0f294a] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                        {cam.count} Vehicles/min
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}

          {/* CCTV Advanced Overlay Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold tracking-wide text-slate-400 uppercase">AI Processing Layer Controls</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/50 transition">
                <span className="text-xs font-medium text-slate-750">Target Tracking Box</span>
                <input
                  type="checkbox"
                  checked={trackingEnabled}
                  onChange={() => setTrackingEnabled(!trackingEnabled)}
                  className="rounded text-[#0f294a] focus:ring-[#0f294a] border-slate-300 bg-white w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/50 transition">
                <span className="text-xs font-medium text-slate-750">Anomaly Scanner</span>
                <input
                  type="checkbox"
                  checked={aiScannerEnabled}
                  onChange={() => setAiScannerEnabled(!aiScannerEnabled)}
                  className="rounded text-[#0f294a] focus:ring-[#0f294a] border-slate-300 bg-white w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/50 transition">
                <span className="text-xs font-medium text-slate-750">Traffic Vectors (Optical Flow)</span>
                <input
                  type="checkbox"
                  checked={flowVectorsEnabled}
                  onChange={() => setFlowVectorsEnabled(!flowVectorsEnabled)}
                  className="rounded text-[#0f294a] focus:ring-[#0f294a] border-slate-300 bg-white w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Camera Focus Dashboard */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold font-mono text-[#0f294a] bg-[#0f294a]/5 px-2.5 py-1 rounded border border-[#0f294a]/10">
                    SURVEILLANCE REGISTER
                  </span>
                  <h2 className="text-lg font-bold text-slate-800 mt-3">{selectedCam.id} Feed Details</h2>
                  <p className="text-slate-500 text-xs mt-1">{selectedCam.name}</p>
                </div>
                <FaVideo className="text-[#0f294a] text-xl" />
              </div>

              {/* CCTV Feed Simulation in Focus Panel */}
              <div className="relative aspect-video bg-slate-50 rounded-xl overflow-hidden border border-slate-200 mt-6 flex items-center justify-center">
                {selectedCam.status === "Maintenance" ? (
                  <div className="text-center text-slate-400 flex flex-col items-center">
                    <FaVideoSlash className="text-3xl text-amber-500 mb-2" />
                    <span className="text-xs font-semibold uppercase">Feed offline</span>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-2 left-2 text-[8px] font-mono text-red-650 flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm font-bold">
                      <span className="w-1 h-1 rounded-full bg-red-600 animate-ping" />
                      REC
                    </div>
                    <div className="absolute top-2 right-2 text-[8px] font-mono text-slate-450 bg-white border border-slate-205 px-1.5 py-0.5 rounded shadow-sm font-bold">
                      {currentTime}
                    </div>

                    <div className="w-full h-full flex flex-col justify-between p-4">
                      {/* Grid overlays */}
                      <div className="border border-black/5 flex-1 relative">
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-black/5 border-dashed" />
                        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-black/5 border-dashed" />
                        <div className="absolute bottom-2 left-2 font-mono text-[9px] text-slate-400 font-bold">
                          FPS: 30 // HD1080
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Stats Table */}
              <div className="space-y-4 mt-6">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Location District</span>
                  <span className="font-semibold text-slate-800">{selectedCam.location}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Operational Status</span>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded ${
                    selectedCam.status === "Active" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                  }`}>{selectedCam.status}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Current Speed Limit</span>
                  <span className="font-semibold text-slate-800">{selectedCam.speed}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Vehicle Frequency</span>
                  <span className="font-mono text-[#0f294a] font-bold">{selectedCam.count} / min</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Active Incident Trigger</span>
                  <span className={`font-semibold ${
                    selectedCam.severity.includes("High") ? "text-red-650" : selectedCam.severity.includes("Medium") ? "text-amber-650" : "text-slate-400"
                  }`}>{selectedCam.severity}</span>
                </div>
              </div>
            </div>

            {/* Quick Diagnostic Actions */}
            <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                  isRecording ? "bg-red-650 hover:bg-red-700 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    Stop Registry Recording
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    Record Feed Stream
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                  Fullscreen
                </button>
                <button className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                  Config Cam
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
