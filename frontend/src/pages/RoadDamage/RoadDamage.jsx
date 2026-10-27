import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaRoad,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaWrench,
  FaTrashAlt,
  FaCheckCircle,
  FaSearch,
  FaArrowRight,
  FaUpload,
  FaTimes,
  FaCrosshairs,
  FaInfoCircle,
  FaShieldAlt,
  FaLayerGroup,
  FaChevronLeft,
  FaChevronRight,
  FaSyncAlt,
  FaCalendarAlt,
  FaFilm,
  FaVideo,
  FaMapMarkedAlt,
  FaTools,
  FaFilePdf,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";
import Loader from "../../components/Common/Loader";
import AuthenticatedImage from "../../components/Common/AuthenticatedImage";

export default function RoadDamage() {
  const [damages, setDamages] = useState([]);
  const [selectedDmg, setSelectedDmg] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters and search
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Media upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("Running RDD2022-YOLOv8s Neural Scan...");
  const fileInputRef = useRef(null);

  const mapRecordToDamage = (r, idx) => {
    const detections = Array.isArray(r.detections) ? r.detections : [];
    const detectionsCount = detections.length;
    const topDet = detections[0];

    const isVideo = r.media_type === "video" || !!r.video_metadata;
    const rawClass = topDet?.class || topDet?.class_name || topDet?.category;
    let damageType = isVideo ? "Video Road Inspection" : "Road Defect";
    if (!isVideo && rawClass) {
      damageType = rawClass;
    } else if (!isVideo && detectionsCount === 0) {
      damageType = "Clear Pavement";
    }

    const highestConfidence = topDet?.confidence
      ? `${Math.round(topDet.confidence * 100)}%`
      : detectionsCount > 0
      ? "85%"
      : "N/A";

    const rawUrl =
      r.image_url ||
      r.processed_image_path ||
      r.filename ||
      (r.video_metadata ? r.filename : null);
    const fullMediaUrl = rawUrl ? detectionService.getMediaUrl(rawUrl) : null;

    // Aggregate breakdown by defect class
    const countsByClass = {};
    detections.forEach((d) => {
      const cName = d.class || d.class_name || d.category || "Road Defect";
      countsByClass[cName] = (countsByClass[cName] || 0) + 1;
    });

    const breakdown = {};
    if (detectionsCount > 0) {
      Object.entries(countsByClass).forEach(([cName, count]) => {
        breakdown[cName] = `${count} ${count > 1 ? "defects" : "defect"} (${Math.round(
          (count / detectionsCount) * 100
        )}%)`;
      });
    } else {
      breakdown["Clear Surface"] = "100%";
    }

    const modelName = r.model_name || "RDD2022-YOLOv8s";
    const disclaimer =
      r.severity_disclaimer ||
      "Heuristic calculation based on bounding-box surface area and model confidence; not a certified civil/pavement engineering assessment.";

    const highestSev =
      r.highest_severity && r.highest_severity !== "None"
        ? r.highest_severity
        : detectionsCount > 0
        ? "Medium"
        : "Low";

    let formattedDate = "Recent";
    if (r.timestamp) {
      try {
        const d = new Date(r.timestamp);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      } catch {
        formattedDate = "Recorded";
      }
    }

    return {
      id: r.detection_id || r.id || `DMG-${idx + 101}`,
      type: damageType,
      location:
        r.gps?.latitude && r.gps?.longitude
          ? `GPS: ${Number(r.gps.latitude).toFixed(4)}, ${Number(r.gps.longitude).toFixed(4)}`
          : "Uploaded Inspection Media",
      severity: highestSev,
      severityScore:
        r.severity_score !== undefined && r.severity_score !== null
          ? r.severity_score
          : highestSev === "Critical"
          ? 9.2
          : highestSev === "High"
          ? 7.5
          : highestSev === "Medium"
          ? 5.0
          : 2.5,
      confidence: highestConfidence,
      timestamp: formattedDate,
      rawTimestamp: r.timestamp,
      status: r.work_order_status || "Pending Triage",
      workOrderId: r.work_order_id || null,
      workOrderStatus: r.work_order_status || null,
      lat: r.gps?.latitude ?? r.latitude ?? null,
      lng: r.gps?.longitude ?? r.longitude ?? null,
      notes: r.video_metadata
        ? `Video scan: ${r.video_metadata.total_frames || 0} frames analyzed by ${modelName}. Anomalies detected: ${r.video_metadata.damages_detected || 0}.`
        : `${modelName} neural model verified ${detectionsCount} defect instance(s). Total estimated repair: ${r.estimated_cost || "₹0"}.`,
      detector: isVideo ? "AI Dashcam Video Stream" : `${modelName} Vision`,
      modelName: modelName,
      severityDisclaimer: disclaimer,
      estimatedCost: r.estimated_cost || "₹0",
      detections: detections,
      breakdown: breakdown,
      imageUrl: fullMediaUrl,
      isVideo: isVideo,
      videoMetadata: r.video_metadata,
      frameDetections: r.frame_detections || [],
      processedVideoPath: r.processed_video_path,
    };
  };

  const fetchHistoricalDetections = useCallback(async (page = currentPage, limit = pageSize) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const skip = (page - 1) * limit;
      const historyRes = await detectionService.getHistory(limit, skip);
      const items = Array.isArray(historyRes?.items) ? historyRes.items : [];
      const total = typeof historyRes?.total === "number" ? historyRes.total : items.length;

      setTotalRecords(total);

      const mapped = items.map((r, idx) => mapRecordToDamage(r, skip + idx));
      setDamages(mapped);

      // Select first or maintain current selection if still in view
      setSelectedDmg((prevSelected) => {
        if (!prevSelected && mapped.length > 0) return mapped[0];
        const stillInList = mapped.find((m) => m.id === prevSelected?.id);
        return stillInList || (mapped.length > 0 ? mapped[0] : null);
      });
    } catch (err) {
      console.warn("[RoadDamage] Error fetching historical detections:", err);
      setHistoryError(err.message || "Failed to load inspection history from database.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchHistoricalDetections(currentPage, pageSize);
  }, [fetchHistoricalDetections, currentPage, pageSize]);

  const handlePageChange = (newPage) => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize) => {
    const size = parseInt(newSize, 10) || 10;
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const isVideo = file.name.toLowerCase().match(/\.(mp4|avi|mov|mkv)$/);

    if (isVideo) {
      setUploadMessage("Processing video frames with RDD2022-YOLOv8s model...");
    } else {
      setUploadMessage("Running RDD2022-YOLOv8s Road Damage Scan...");
    }

    try {
      if (isVideo) {
        const res = await detectionService.uploadVideo(file);
        const newRecord = {
          id: res.detection_id || `VID-${Math.floor(100 + Math.random() * 900)}`,
          type: "Video Road Inspection",
          location: res.gps?.latitude && res.gps?.longitude
            ? `GPS: ${Number(res.gps.latitude).toFixed(4)}, ${Number(res.gps.longitude).toFixed(4)}`
            : "Uploaded Dashcam Video (Unlocated)",
          severity: res.highest_severity && res.highest_severity !== "None" ? res.highest_severity : "Low",
          severityScore: res.highest_severity === "Critical" ? 9.2 : res.highest_severity === "High" ? 7.5 : 5.0,
          confidence: "95.0%",
          timestamp: "Just now",
          status: "Pending Triage",
          lat: res.latitude ?? res.gps?.latitude ?? null,
          lng: res.longitude ?? res.gps?.longitude ?? null,
          notes: `Processed ${res.total_frames || 0} frames with RDD2022-YOLOv8s. ${res.damages_detected || 0} road damage defects localized.`,
          detector: "RDD2022 Video Inspector",
          modelName: "RDD2022-YOLOv8s",
          severityDisclaimer: "Heuristic estimation based on bounding-box surface area and detection count.",
          estimatedCost: `₹${(res.damages_detected || 0) * 7500}`,
          detections: [],
          breakdown: { "Video Anomalies": `${res.damages_detected || 0} detected` },
          imageUrl: res.processed_video_path ? detectionService.getMediaUrl(res.processed_video_path) : null,
          isVideo: true,
        };
        setDamages((prev) => [newRecord, ...prev.filter((d) => d.id !== newRecord.id)]);
        setSelectedDmg(newRecord);
        setTotalRecords((prev) => prev + 1);
      } else {
        const res = await detectionService.uploadImage(file);
        const newRecord = mapRecordToDamage(res, 0);
        setDamages((prev) => [newRecord, ...prev.filter((d) => d.id !== newRecord.id)]);
        setSelectedDmg(newRecord);
        setTotalRecords((prev) => prev + 1);
      }
    } catch (err) {
      console.warn("Upload detection failed:", err);
      setUploadError(
        err.message || "Failed to process media. Make sure the FastAPI backend is online."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAction = (id, newStatus) => {
    const updated = damages.map((dmg) => {
      if (dmg.id === id) {
        const updatedDmg = { ...dmg, status: newStatus };
        if (selectedDmg?.id === id) {
          setSelectedDmg(updatedDmg);
        }
        return updatedDmg;
      }
      return dmg;
    });
    setDamages(updated);
  };

  const [dispatchingWoId, setDispatchingWoId] = useState(null);

  const handleDispatchWorkOrder = async (dmg) => {
    if (!dmg || !dmg.id) return;
    setDispatchingWoId(dmg.id);
    try {
      const res = await detectionService.createWorkOrderFromInspection(dmg.id, {
        road_name: dmg.location || "Corridor Segment",
        priority: dmg.severity || "High",
        estimated_cost: dmg.estimatedCost || "₹15,000",
        damage_category: dmg.type || "Pothole",
        description: `Work order dispatched from Triage Queue for ${dmg.type} on ${dmg.location}.`
      });
      const created = res?.data || res;
      const woId = created.work_order_id || created.ticket_id;
      const woStatus = created.status || "Open";

      const updated = damages.map((d) =>
        d.id === dmg.id ? { ...d, workOrderId: woId, workOrderStatus: woStatus, status: woStatus } : d
      );
      setDamages(updated);
      setSelectedDmg((prev) => ({
        ...prev,
        workOrderId: woId,
        workOrderStatus: woStatus,
        status: woStatus
      }));
    } catch (err) {
      console.error("Failed to dispatch work order:", err);
      alert(err?.response?.data?.detail || "Failed to create work order.");
    } finally {
      setDispatchingWoId(null);
    }
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(null);

  const handleDownloadPdf = async (detectionId) => {
    if (!detectionId) return;
    setIsDownloadingPdf(detectionId);
    try {
      await detectionService.downloadInspectionReport(detectionId);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert(err.message || "Failed to download PDF inspection report.");
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  const filteredDamages = damages.filter((dmg) => {
    const matchesSearch =
      dmg.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dmg.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dmg.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = filterSeverity === "All" || dmg.severity === filterSeverity;
    const matchesStatus = filterStatus === "All" || dmg.status === filterStatus;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png,image/jpeg,image/webp,video/mp4,video/avi,video/mov,video/mkv"
        className="hidden"
      />

      {/* Upload loader overlay */}
      {isUploading && (
        <Loader
          fullScreen
          message={uploadMessage}
          subtext="Localizing road distress, classifying RDD categories, and computing heuristic severity"
        />
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-red-500" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* Header and Filtering Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f294a]/10 flex items-center justify-center text-[#0f294a]">
              <FaRoad className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Road Damage Detection</h1>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                  RDD2022-YOLOv8s Active
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Specialized computer vision pipeline connected to MongoDB inspection archives
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Video Inspection Mode Link */}
          <Link
            to="/video-inspection"
            className="bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 transition border border-purple-200 shadow-sm"
          >
            <FaFilm className="text-xs text-purple-700" /> Video Inspection View
          </Link>

          {/* Interactive GIS Map Link */}
          <Link
            to="/map"
            className="bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 transition border border-blue-200 shadow-sm"
          >
            <FaMapMarkedAlt className="text-xs text-blue-700" /> Interactive GIS Map
          </Link>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#0f294a] hover:bg-[#1a3f6a] text-white text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 transition shadow-sm"
          >
            <FaUpload className="text-xs" /> Run AI Road Scan (Upload)
          </button>

          {/* Refresh button */}
          <button
            onClick={() => fetchHistoricalDetections(currentPage, pageSize)}
            disabled={isLoadingHistory}
            title="Reload inspection history from MongoDB"
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
          >
            <FaSyncAlt className={`text-xs ${isLoadingHistory ? "animate-spin" : ""}`} />
          </button>

          {/* Severity filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-[#0f294a]"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Severity</option>
            <option value="Medium">Medium Severity</option>
            <option value="Low">Low Severity</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl px-4 py-3 border border-slate-200 outline-none focus:border-[#0f294a]"
          >
            <option value="All">All Statuses</option>
            <option value="Pending Triage">Pending Triage</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Scheduled">Scheduled</option>
          </select>

          {/* Search bar */}
          <div className="relative flex-1 lg:flex-initial">
            <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search registry defects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 text-slate-800 text-xs rounded-xl pl-10 pr-4 py-3 w-full lg:w-60 border border-slate-200 outline-none focus:border-[#0f294a] transition"
            />
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Side: Damage Queue List */}
        <div className="col-span-12 lg:col-span-6 xl:col-span-5 space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Detection Log Queue ({filteredDamages.length} of {totalRecords} Records)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              MongoDB Database
            </span>
          </div>

          {/* Error Banner for History Loading */}
          {historyError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FaExclamationTriangle className="text-red-500 flex-shrink-0" />
                <span>{historyError}</span>
              </div>
              <button
                onClick={() => fetchHistoricalDetections(currentPage, pageSize)}
                className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Queue Items or Loading/Empty States */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {isLoadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-4 rounded-2xl border border-slate-200 bg-white animate-pulse space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                      <div className="h-4 bg-slate-200 rounded w-16"></div>
                    </div>
                    <div className="h-5 bg-slate-200 rounded w-48"></div>
                    <div className="h-3 bg-slate-200 rounded w-36"></div>
                  </div>
                ))}
              </div>
            ) : filteredDamages.length > 0 ? (
              <AnimatePresence>
                {filteredDamages.map((dmg) => {
                  const isSelected = selectedDmg?.id === dmg.id;
                  const isCritical = dmg.severity === "Critical";
                  const isHigh = dmg.severity === "High";

                  return (
                    <motion.div
                      key={dmg.id}
                      layoutId={`damage-card-${dmg.id}`}
                      onClick={() => setSelectedDmg(dmg)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 relative flex flex-col justify-between ${
                        isSelected
                          ? "bg-white border-[#0f294a] ring-2 ring-[#0f294a]/10 shadow-md"
                          : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-[#0f294a] font-bold">{dmg.id}</span>
                            {dmg.isVideo && (
                              <span className="text-[9px] font-mono bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                <FaFilm className="text-[8px]" /> VIDEO
                              </span>
                            )}
                            <span
                              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                isCritical
                                  ? "bg-red-500/10 text-red-700 border border-red-500/20"
                                  : isHigh
                                  ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                                  : dmg.severity === "Medium"
                                  ? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                              }`}
                            >
                              {dmg.severity}
                            </span>
                          </div>
                          <h3 className="font-bold text-sm text-slate-800 mt-1.5">{dmg.type}</h3>
                          {dmg.isVideo && dmg.videoMetadata && (
                            <p className="text-[10px] text-purple-700 font-mono font-semibold mt-0.5">
                              📹 {dmg.videoMetadata.duration_seconds?.toFixed(1) || "?"}s •{" "}
                              {dmg.videoMetadata.sampled_frames || dmg.videoMetadata.total_frames || "?"} frames analyzed
                            </p>
                          )}
                          <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                            <FaMapMarkerAlt className="text-slate-400 text-[10px]" /> {dmg.location}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-bold text-emerald-600 font-mono">
                            {dmg.confidence} Conf.
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium flex items-center justify-end gap-1">
                            <FaCalendarAlt className="text-[9px]" /> {dmg.timestamp}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-medium font-mono">{dmg.detector}</span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-full ${
                            dmg.status === "Pending Triage"
                              ? "bg-slate-50 text-slate-500 border border-slate-200"
                              : dmg.status === "Dispatched"
                              ? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                              : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                          }`}
                        >
                          {dmg.status}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                <FaCheckCircle className="text-4xl text-emerald-500/40 mx-auto mb-3" />
                <span className="text-sm font-semibold">
                  {totalRecords === 0 ? "No Inspections In Database" : "Queue Clean"}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  {totalRecords === 0
                    ? "Click 'Run AI Road Scan' to upload an image and save your first inspection record."
                    : "No road damage logs match the selected filter criteria."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalRecords > 0 && (
            <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-semibold outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span className="text-slate-400 font-mono">
                  Page {currentPage} of {totalPages}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoadingHistory}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Previous Page"
                >
                  <FaChevronLeft className="text-xs text-slate-600" />
                </button>
                <span className="px-3 py-1 font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                  {currentPage}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isLoadingHistory}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Next Page"
                >
                  <FaChevronRight className="text-xs text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Damage Diagnostic Details */}
        <div className="col-span-12 lg:col-span-6 xl:col-span-7">
          {!selectedDmg ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 min-h-[550px] flex flex-col items-center justify-center shadow-sm">
              <FaRoad className="text-5xl text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Road Inspection Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {isLoadingHistory
                  ? "Querying inspection records from MongoDB database..."
                  : totalRecords === 0
                  ? "No saved inspections found in the database. Run an AI scan to upload and analyze road media."
                  : "Select an inspection from the detection queue on the left to view detailed diagnostic telemetry."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[550px] flex flex-col justify-between">
              <div>
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-[#0f294a] bg-[#0f294a]/5 px-2.5 py-1 rounded border border-[#0f294a]/10">
                        {selectedDmg.isVideo ? "VIDEO ROAD INSPECTION REPORT" : "ROAD DAMAGE AUDIT REPORT"}
                      </span>
                      <span className="text-xs font-mono text-slate-400 font-semibold">
                        Model: {selectedDmg.modelName || "RDD2022-YOLOv8s"}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mt-3">{selectedDmg.type}</h2>
                    {selectedDmg.isVideo && (
                      <div className="mt-2 flex items-center gap-2">
                        <Link
                          to="/video-inspection"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition shadow-xs"
                        >
                          <FaFilm className="text-xs" /> Open Interactive Video Frame Inspector <FaArrowRight className="text-[9px]" />
                        </Link>
                      </div>
                    )}
                    <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
                      <FaMapMarkerAlt className="text-slate-400 text-xs" /> {selectedDmg.location}
                    </p>
                  </div>
                  <div className="text-right sm:text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Severity Score
                      </span>
                      <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        Heuristic
                      </span>
                    </div>
                    <span
                      className={`text-2xl font-black ${
                        selectedDmg.severity === "Critical"
                          ? "text-red-600"
                          : selectedDmg.severity === "High"
                          ? "text-amber-600"
                          : "text-blue-700"
                      }`}
                    >
                      {typeof selectedDmg.severityScore === "number"
                        ? selectedDmg.severityScore.toFixed(1)
                        : selectedDmg.severity === "Critical"
                        ? "9.2"
                        : selectedDmg.severity === "High"
                        ? "7.5"
                        : "5.0"}{" "}
                      <span className="text-sm font-normal text-slate-400">/ 10</span>
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Est. Cost: <strong className="text-slate-700">{selectedDmg.estimatedCost}</strong>
                    </p>
                  </div>
                </div>

                {/* Diagnostic Media and Verification Section */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
                  {/* Visual Image Capture Area */}
                  <div className="md:col-span-5">
                    <div className="relative aspect-square bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col items-center justify-center p-2">
                      {selectedDmg.imageUrl ? (
                        <div className="relative w-full h-full rounded-lg overflow-hidden flex items-center justify-center bg-black/5">
                          <AuthenticatedImage
                            src={selectedDmg.imageUrl}
                            alt="AI Road Damage Detection"
                            className="w-full h-full object-contain"
                          />
                          <span className="absolute bottom-2 left-2 text-[9px] font-mono text-white bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm">
                            RDD2022 Annotated
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="border border-red-500/20 w-3/4 h-3/4 absolute rounded flex flex-col justify-between p-1.5">
                            <span className="text-[8px] font-mono font-bold text-red-700 bg-white border border-red-500/10 px-1 py-0.5 rounded w-max">
                              {selectedDmg.id}
                            </span>
                            <span className="text-[7px] font-mono text-slate-400 text-right">
                              LAT: {Number(selectedDmg.lat)?.toFixed(4)}
                            </span>
                          </div>
                          <FaRoad className="text-slate-300 text-6xl" />
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-4">
                            Road Defect Frame
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Classification parameters */}
                  <div className="md:col-span-7 space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FaLayerGroup className="text-slate-400 text-xs" /> Defect Distribution Breakdown
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(selectedDmg.breakdown || {}).map(([label, val]) => (
                        <div key={label} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600">{label}</span>
                            <span className="font-mono text-slate-800">{val}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                label.toLowerCase().includes("alligator")
                                  ? "bg-purple-600"
                                  : label.toLowerCase().includes("pothole")
                                  ? "bg-red-600"
                                  : label.toLowerCase().includes("transverse")
                                  ? "bg-amber-500"
                                  : "bg-[#0f294a]"
                              }`}
                              style={{
                                width: val.includes("%") ? val.split("(")[1]?.replace(")", "") || "100%" : "100%",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Registry coordinates */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        Geographic Registry Coordinates
                      </span>
                      <div className="grid grid-cols-2 gap-4 mt-2 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 block">Latitude</span>
                          <span className="text-slate-800 font-semibold">{selectedDmg.lat}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Longitude</span>
                          <span className="text-slate-800 font-semibold">{selectedDmg.lng}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Detected Defect Instances Section */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <FaCrosshairs className="text-[#0f294a]" /> Localized Defect Instances (
                      {selectedDmg.detections?.length || 0})
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      Confidence Threshold: ≥ 0.25
                    </span>
                  </div>

                  {selectedDmg.detections && selectedDmg.detections.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedDmg.detections.map((det, dIdx) => {
                        const dClass = det.class || det.class_name || det.category;
                        const dConf = det.confidence ? Math.round(det.confidence * 100) : 0;
                        const bbox = Array.isArray(det.bounding_box)
                          ? det.bounding_box.map((n) => Math.round(n)).join(", ")
                          : "N/A";
                        const dSev = det.severity || "Medium";
                        const dCost = det.estimated_cost || "₹5000";

                        const badgeStyle = dClass.toLowerCase().includes("alligator")
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : dClass.toLowerCase().includes("pothole")
                          ? "bg-red-50 text-red-700 border-red-200"
                          : dClass.toLowerCase().includes("transverse")
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200";

                        return (
                          <div
                            key={dIdx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${badgeStyle}`}>
                                {dClass}
                              </span>
                              <span className="font-mono text-slate-500 text-[11px]">
                                Confidence: <strong className="text-emerald-700 font-semibold">{dConf}%</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                BBox: [{bbox}]
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  dSev === "Critical"
                                    ? "bg-red-100 text-red-800"
                                    : dSev === "High"
                                    ? "bg-amber-100 text-amber-800"
                                    : dSev === "Medium"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {dSev}
                              </span>
                              <span className="font-mono font-bold text-slate-700">{dCost}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                      No individual bounding-boxes detected above threshold.
                    </div>
                  )}
                </div>

                {/* Heuristic Severity Notice */}
                <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                  <FaInfoCircle className="text-blue-500 mt-0.5 flex-shrink-0 text-sm" />
                  <div className="leading-relaxed">
                    <span className="font-bold block text-[11px] text-blue-800 uppercase tracking-wide">
                      Heuristic Engineering Notice
                    </span>
                    <span className="text-[11px] text-blue-700">
                      {selectedDmg.severityDisclaimer ||
                        "Heuristic calculation based on bounding-box surface area and model confidence; not a certified civil/pavement engineering assessment."}
                    </span>
                  </div>
                </div>

                {/* Inspector notes */}
                <div className="mt-5 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Detection Summary & Notes
                  </h4>
                  <p className="text-slate-650 text-xs leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    {selectedDmg.notes}
                  </p>
                </div>
              </div>

              {/* Diagnostics Workflow Action Options */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Maintenance Tracking
                  </span>
                  {selectedDmg.workOrderId ? (
                    <Link
                      to={`/maintenance?id=${selectedDmg.workOrderId}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition shadow-xs"
                      title="View trackable maintenance work order"
                    >
                      <FaTools className="text-emerald-600" /> #{selectedDmg.workOrderId} ({selectedDmg.status})
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 mt-1 inline-block bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                      {selectedDmg.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleAction(selectedDmg.id, "Flagged (False)")}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <FaTrashAlt className="text-[10px]" /> Dismiss
                  </button>

                  <button
                    onClick={() => handleDownloadPdf(selectedDmg.id)}
                    disabled={isDownloadingPdf === selectedDmg.id}
                    className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                    title="Download Official PDF Inspection Report"
                  >
                    {isDownloadingPdf === selectedDmg.id ? (
                      <FaSyncAlt className="animate-spin text-xs" />
                    ) : (
                      <FaFilePdf className="text-[11px]" />
                    )}
                    PDF Report
                  </button>

                  {!selectedDmg.workOrderId && (
                    <button
                      onClick={() => handleDispatchWorkOrder(selectedDmg)}
                      disabled={dispatchingWoId === selectedDmg.id}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      {dispatchingWoId === selectedDmg.id ? (
                        <FaSyncAlt className="animate-spin text-xs" />
                      ) : (
                        <FaTools className="text-[10px]" />
                      )}
                      Dispatch Work Order
                    </button>
                  )}

                  {selectedDmg.workOrderId && (
                    <Link
                      to={`/maintenance?id=${selectedDmg.workOrderId}`}
                      className="px-4 py-2.5 bg-[#0f294a] hover:bg-[#1a3f6a] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <FaTools className="text-[10px]" /> Open Work Order <FaArrowRight className="text-[9px]" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
