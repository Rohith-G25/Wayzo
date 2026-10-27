import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaVideo,
  FaUpload,
  FaTrashAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaPlay,
  FaClock,
  FaRoad,
  FaLayerGroup,
  FaCrosshairs,
  FaInfoCircle,
  FaSyncAlt,
  FaTimes,
  FaArrowRight,
  FaFileVideo,
  FaCalendarAlt,
  FaShieldAlt,
  FaMapMarkerAlt,
  FaMapMarkedAlt,
  FaCompass,
  FaFilePdf,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";
import AuthenticatedImage from "../../components/Common/AuthenticatedImage";

const MAX_FILE_SIZE_MB = 100;
const SUPPORTED_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv"];

export default function VideoInspection() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sampleInterval, setSampleInterval] = useState(1.0);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [isGettingGps, setIsGettingGps] = useState(false);

  // Job processing state
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // { status, progress, message, defects_found, result, error }
  const [isProcessing, setIsProcessing] = useState(false);

  // Completed Inspection Results state
  const [inspectionResult, setInspectionResult] = useState(null);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);

  // Historical video inspections
  const [videoHistory, setVideoHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async (detectionId) => {
    if (!detectionId) return;
    setIsDownloadingPdf(true);
    try {
      await detectionService.downloadInspectionReport(detectionId);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert(err.message || "Failed to download PDF inspection report.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const fetchVideoHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await detectionService.getDetections(50, 0);
      if (Array.isArray(res)) {
        const videosOnly = res.filter(
          (r) => r.media_type === "video" || !!r.video_metadata
        );
        setVideoHistory(videosOnly);
        // If no active result selected yet, load latest video inspection
        setInspectionResult((prev) => {
          if (prev) return prev;
          if (videosOnly.length === 0) return null;
          const latest = videosOnly[0];
          return {
            detection_id: latest.detection_id,
            filename: latest.filename,
            duration_seconds: latest.video_metadata?.duration_seconds || 0,
            total_frames: latest.video_metadata?.total_video_frames || 0,
            sampled_frames: latest.video_metadata?.sampled_frames || 0,
            damages_detected: latest.video_metadata?.damages_detected || latest.detections?.length || 0,
            highest_severity: latest.highest_severity || "None",
            severity_score: latest.severity_score || 0,
            estimated_cost: latest.estimated_cost || "₹0",
            category_counts: latest.video_metadata?.category_counts || latest.category_counts || {},
            frame_detections: latest.frame_detections || [],
            detections: latest.detections || [],
            timestamp: latest.timestamp,
            preview_image_url: latest.image_url,
            processed_video_path: latest.processed_video_path,
            severity_disclaimer: latest.severity_disclaimer,
          };
        });
      }
    } catch (err) {
      console.warn("[VideoInspection] Failed to fetch video history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchVideoHistory();
  }, [fetchVideoHistory]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const validateFile = (file) => {
    if (!file) return false;
    const name = file.name.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!hasValidExt) {
      setFileError(
        `Unsupported video format. Please select an MP4, MOV, AVI, or MKV file.`
      );
      return false;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      setFileError(
        `File size (${sizeMb.toFixed(1)} MB) exceeds the maximum limit of ${MAX_FILE_SIZE_MB} MB.`
      );
      return false;
    }

    setFileError(null);
    return true;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startInspection = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setFileError(null);
    setJobStatus({
      status: "processing",
      progress: 5,
      message: "Uploading video and initializing OpenCV decoder...",
      defects_found: 0,
    });

    try {
      // Initiate background job with genuine or null coordinates
      const latNum = manualLat !== "" && !isNaN(parseFloat(manualLat)) ? parseFloat(manualLat) : null;
      const lngNum = manualLng !== "" && !isNaN(parseFloat(manualLng)) ? parseFloat(manualLng) : null;
      const startRes = await detectionService.startVideoJob(
        selectedFile,
        latNum,
        lngNum,
        sampleInterval
      );

      const jobId = startRes.job_id;
      setActiveJobId(jobId);

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      let consecutiveErrors = 0;

      // Begin polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await detectionService.getVideoJobStatus(jobId);
          consecutiveErrors = 0; // reset on successful status retrieval
          setJobStatus(statusRes);

          if (statusRes.status === "completed") {
            clearInterval(pollIntervalRef.current);
            setIsProcessing(false);
            if (statusRes.result) {
              setInspectionResult(statusRes.result);
              setSelectedFrameIdx(0);
              fetchVideoHistory();
            }
          } else if (statusRes.status === "failed") {
            clearInterval(pollIntervalRef.current);
            setIsProcessing(false);
            setFileError(statusRes.error || "Video inspection encountered an error.");
          }
        } catch (pollErr) {
          consecutiveErrors += 1;
          console.warn(`[VideoInspection] Polling error (${consecutiveErrors}/5):`, pollErr);
          if (consecutiveErrors >= 5 || pollErr?.status === 404) {
            clearInterval(pollIntervalRef.current);
            setIsProcessing(false);
            setFileError(
              pollErr?.message ||
              "Video inspection was interrupted or job expired (the server may have restarted). Please re-run your inspection."
            );
          }
        }
      }, 1500);
    } catch (err) {
      console.error("[VideoInspection] Start job failed:", err);
      setIsProcessing(false);
      setFileError(
        err.response?.data?.detail || err.message || "Failed to start video inspection."
      );
    }
  };

  const currentFrames = inspectionResult?.frame_detections || [];
  const activeFrame = currentFrames[selectedFrameIdx] || currentFrames[0];
  const activeFrameDetections = activeFrame?.detections || [];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".mp4,.avi,.mov,.mkv"
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f294a]/10 flex items-center justify-center text-[#0f294a]">
              <FaVideo className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                  Video Road Damage Inspection
                </h1>
                <span className="text-[10px] font-mono bg-[#0f294a]/10 text-[#0f294a] px-2.5 py-0.5 rounded-full font-bold border border-[#0f294a]/20">
                  Sampled Inference (OpenCV + YOLOv8s)
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Frame-by-frame deep neural analysis for dashcam and drone road inspection surveys
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/map"
            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-semibold rounded-xl text-xs flex items-center gap-2 border border-blue-200 transition"
          >
            <FaMapMarkedAlt className="text-xs text-blue-700" /> Interactive GIS Map
          </Link>
          <Link
            to="/road-damage"
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 border border-slate-200 transition"
          >
            <FaRoad className="text-xs" /> Switch to Image Inspection
          </Link>
          <button
            onClick={fetchVideoHistory}
            disabled={isLoadingHistory}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
            title="Reload Video Inspection Logs"
          >
            <FaSyncAlt className={`text-xs ${isLoadingHistory ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Upload & Configuration Section */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Drag & Drop Video Upload Zone */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FaUpload className="text-[#0f294a]" /> Upload Road Inspection Video
              </h2>
              <span className="text-[10px] font-mono text-slate-400">
                Max {MAX_FILE_SIZE_MB} MB • Up to 120s
              </span>
            </div>

            {/* Error banner */}
            {fileError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FaExclamationTriangle className="text-red-500 flex-shrink-0" />
                  <span>{fileError}</span>
                </div>
                <button
                  onClick={() => setFileError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <FaTimes />
                </button>
              </div>
            )}

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[220px] ${
                  isDragging
                    ? "border-[#0f294a] bg-[#0f294a]/5 scale-[0.99]"
                    : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 bg-slate-50/30"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#0f294a]/5 flex items-center justify-center text-[#0f294a] mb-3">
                  <FaFileVideo className="text-2xl" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  Drag and drop road dashcam video here
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  or click to browse your files (MP4, MOV, AVI, MKV)
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-500">
                    MP4
                  </span>
                  <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-500">
                    MOV
                  </span>
                  <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-500">
                    AVI
                  </span>
                </div>
              </div>
            ) : (
              /* Selected File Preview Box */
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0f294a] text-white flex items-center justify-center text-xl shadow-sm">
                      <FaFileVideo />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-1">
                        {selectedFile.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>•</span>
                        <span className="font-mono uppercase text-[10px] bg-slate-200 px-1.5 py-0.2 rounded">
                          {selectedFile.name.split(".").pop()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {!isProcessing && (
                    <button
                      onClick={handleRemoveFile}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remove selected video"
                    >
                      <FaTrashAlt className="text-xs" />
                    </button>
                  )}
                </div>

                {/* Sampling Rate Configuration */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 block">
                      Frame Sampling Rate
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Controls frame density and CPU throughput
                    </span>
                  </div>

                  <select
                    value={sampleInterval}
                    onChange={(e) => setSampleInterval(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    className="bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg px-3 py-1.5 outline-none"
                  >
                    <option value={0.5}>Every 0.5s (High Precision)</option>
                    <option value={1.0}>Every 1.0s (Standard • Recommended)</option>
                    <option value={2.0}>Every 2.0s (Fast Survey)</option>
                  </select>
                </div>

                {/* Optional Survey Coordinates */}
                <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-700 block">
                        Road Survey GPS Coordinates (Optional)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Geo-tag this dashcam survey on the Road Damage GIS Map
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) return;
                        setIsGettingGps(true);
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setManualLat(pos.coords.latitude.toFixed(6));
                            setManualLng(pos.coords.longitude.toFixed(6));
                            setIsGettingGps(false);
                          },
                          () => setIsGettingGps(false),
                          { timeout: 8000 }
                        );
                      }}
                      disabled={isProcessing || isGettingGps}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition"
                    >
                      <FaCompass className={isGettingGps ? "animate-spin" : ""} />
                      {isGettingGps ? "Locating..." : "Use Current GPS"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="Latitude (e.g. 13.0827)"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      disabled={isProcessing}
                      className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#0f294a]"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Longitude (e.g. 80.2707)"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      disabled={isProcessing}
                      className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#0f294a]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button & Disclaimer */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <FaInfoCircle className="text-slate-400 flex-shrink-0" />
              <span>Frames are resized to max 960px to preserve system responsiveness.</span>
            </div>

            <button
              onClick={startInspection}
              disabled={!selectedFile || isProcessing}
              className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm w-full sm:w-auto justify-center ${
                !selectedFile || isProcessing
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-[#0f294a] hover:bg-[#1a3f6a] text-white cursor-pointer"
              }`}
            >
              <FaPlay className="text-[10px]" /> Start AI Video Inspection
            </button>
          </div>
        </div>

        {/* Right: Live Processing Status / Inspection Overview */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[300px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FaClock className="text-[#0f294a]" /> Inspection Status & Progress
              </h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  isProcessing
                    ? "bg-amber-500/10 text-amber-700 border border-amber-500/20 animate-pulse"
                    : inspectionResult
                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {isProcessing
                  ? "ANALYZING VIDEO"
                  : inspectionResult
                  ? "READY"
                  : "IDLE"}
              </span>
            </div>

            {isProcessing ? (
              <div className="space-y-5 py-4">
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-slate-700">
                      {jobStatus?.message || "Running RDD2022-YOLOv8s Model..."}
                    </span>
                    <span className="font-mono text-[#0f294a] font-bold">
                      {jobStatus?.progress || 0}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0f294a] rounded-full transition-all duration-300"
                      style={{ width: `${jobStatus?.progress || 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">PROCESSED FRAMES</span>
                    <span className="text-slate-800 font-bold text-sm">
                      {jobStatus?.processed_frames || 0} / {jobStatus?.total_sampled_frames || "?"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">DEFECTS LOCALIZED</span>
                    <span className="text-red-600 font-bold text-sm">
                      {jobStatus?.defects_found || 0}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <FaInfoCircle className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>
                    Inference is running sequentially across sampled video frames. Processing is not real-time to preserve CPU/memory stability.
                  </span>
                </div>
              </div>
            ) : inspectionResult ? (
              /* Summary KPIs of currently loaded video */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#0f294a] bg-[#0f294a]/5 px-2.5 py-1 rounded border border-[#0f294a]/10">
                    {inspectionResult.detection_id || "DET-VID-001"}
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    {inspectionResult.timestamp
                      ? new Date(inspectionResult.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recent"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Duration
                    </span>
                    <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">
                      {inspectionResult.duration_seconds?.toFixed(1) || "0.0"}s
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Frames
                    </span>
                    <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">
                      {inspectionResult.sampled_frames || 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-red-500 uppercase font-bold block">
                      Defects
                    </span>
                    <span className="text-base font-black text-red-600 font-mono mt-0.5 block">
                      {inspectionResult.damages_detected || 0}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-amber-500 uppercase font-bold block">
                      Severity
                    </span>
                    <span
                      className={`text-base font-black font-mono mt-0.5 block ${
                        inspectionResult.highest_severity === "Critical"
                          ? "text-red-600"
                          : inspectionResult.highest_severity === "High"
                          ? "text-amber-600"
                          : "text-blue-600"
                      }`}
                    >
                      {inspectionResult.highest_severity || "None"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 font-medium">Estimated Repair Cost:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {inspectionResult.estimated_cost || "₹0"}
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleDownloadPdf(inspectionResult.detection_id)}
                    disabled={isDownloadingPdf}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isDownloadingPdf ? (
                      <FaSyncAlt className="animate-spin text-xs" />
                    ) : (
                      <FaFilePdf />
                    )}
                    Download PDF Inspection Report
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 space-y-2">
                <FaVideo className="text-4xl text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold block">No Video Inspection Active</span>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Upload a road recording on the left to start automated computer vision inspection.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
            <span>Model: RDD2022-YOLOv8s</span>
            <span>Non-blocking FastAPI Job System</span>
          </div>
        </div>
      </div>

      {/* Results Workspace: Defect Breakdown, Frame Timeline, and Frame Diagnostics */}
      {inspectionResult && (
        <div className="grid grid-cols-12 gap-6">
          {/* Defect Category Breakdown */}
          <div className="col-span-12 xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <FaLayerGroup className="text-[#0f294a]" /> Defect Category Breakdown
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Aggregated Video Totals</span>
            </div>

            <div className="space-y-4">
              {/* Pothole */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span> Potholes
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {inspectionResult.category_counts?.["Pothole"] || 0} defects
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full"
                    style={{
                      width: `${
                        inspectionResult.damages_detected > 0
                          ? Math.round(
                              ((inspectionResult.category_counts?.["Pothole"] || 0) /
                                inspectionResult.damages_detected) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Longitudinal Crack */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> Longitudinal Cracks
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {inspectionResult.category_counts?.["Longitudinal Crack"] || 0} defects
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${
                        inspectionResult.damages_detected > 0
                          ? Math.round(
                              ((inspectionResult.category_counts?.["Longitudinal Crack"] || 0) /
                                inspectionResult.damages_detected) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Transverse Crack */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Transverse Cracks
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {inspectionResult.category_counts?.["Transverse Crack"] || 0} defects
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${
                        inspectionResult.damages_detected > 0
                          ? Math.round(
                              ((inspectionResult.category_counts?.["Transverse Crack"] || 0) /
                                inspectionResult.damages_detected) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Alligator Crack */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span> Alligator Cracks
                  </span>
                  <span className="font-mono text-slate-800 font-bold">
                    {inspectionResult.category_counts?.["Alligator Crack"] || 0} defects
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${
                        inspectionResult.damages_detected > 0
                          ? Math.round(
                              ((inspectionResult.category_counts?.["Alligator Crack"] || 0) /
                                inspectionResult.damages_detected) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Heuristic Disclaimer */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 mt-4">
              <FaInfoCircle className="text-blue-500 mt-0.5 flex-shrink-0 text-sm" />
              <div className="leading-relaxed">
                <span className="font-bold block text-[11px] text-blue-800 uppercase tracking-wide">
                  Heuristic Notice
                </span>
                <span className="text-[11px] text-blue-700">
                  {inspectionResult.severity_disclaimer ||
                    "Heuristic calculation based on bounding-box surface area and model confidence; not a certified civil/pavement engineering assessment."}
                </span>
              </div>
            </div>

            {/* Video History Archive List */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Saved Video Inspections ({videoHistory.length})
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {videoHistory.map((v) => {
                  const isCur = v.detection_id === inspectionResult.detection_id;
                  return (
                    <div
                      key={v.detection_id}
                      onClick={() => {
                        setInspectionResult({
                          detection_id: v.detection_id,
                          filename: v.filename,
                          duration_seconds: v.video_metadata?.duration_seconds || 0,
                          total_frames: v.video_metadata?.total_video_frames || 0,
                          sampled_frames: v.video_metadata?.sampled_frames || 0,
                          damages_detected:
                            v.video_metadata?.damages_detected || v.detections?.length || 0,
                          highest_severity: v.highest_severity || "None",
                          severity_score: v.severity_score || 0,
                          estimated_cost: v.estimated_cost || "₹0",
                          category_counts:
                            v.video_metadata?.category_counts || v.category_counts || {},
                          frame_detections: v.frame_detections || [],
                          detections: v.detections || [],
                          timestamp: v.timestamp,
                          preview_image_url: v.image_url,
                          processed_video_path: v.processed_video_path,
                          severity_disclaimer: v.severity_disclaimer,
                        });
                        setSelectedFrameIdx(0);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                        isCur
                          ? "bg-white border-[#0f294a] shadow-sm ring-1 ring-[#0f294a]/20"
                          : "bg-slate-50 border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-800 block">
                          {v.detection_id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {v.video_metadata?.duration_seconds?.toFixed(1) || "0"}s •{" "}
                          {v.video_metadata?.damages_detected || 0} defects
                        </span>
                      </div>
                      <span
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          v.highest_severity === "Critical"
                            ? "bg-red-100 text-red-800"
                            : v.highest_severity === "High"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {v.highest_severity || "Low"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center & Right: Interactive Frame Timeline & Selected Frame Diagnostic Viewer */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            {/* Timeline Strip */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <FaClock className="text-[#0f294a]" /> Sampled Frame Timeline (
                    {currentFrames.length} Frames Analyzed)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click any frame along the timeline to inspect bounding boxes and localized detections
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Interval: 1 FPS</span>
              </div>

              {/* Horizontal Scrollable Frame Timeline Cards */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1">
                {currentFrames.map((frame, idx) => {
                  const isSel = idx === selectedFrameIdx;
                  const hasDefects = frame.defect_count > 0;
                  return (
                    <button
                      key={frame.frame_number || idx}
                      onClick={() => setSelectedFrameIdx(idx)}
                      className={`flex-shrink-0 p-2.5 rounded-xl border text-left transition-all ${
                        isSel
                          ? "bg-white border-[#0f294a] ring-2 ring-[#0f294a]/20 shadow-md"
                          : hasDefects
                          ? "bg-red-50/40 border-red-200 hover:bg-white"
                          : "bg-slate-50 border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                        <span className="font-bold text-slate-700">
                          {frame.formatted_time || `00:${idx}`}
                        </span>
                        {hasDefects ? (
                          <span className="px-1.5 py-0.2 bg-red-600 text-white rounded font-bold text-[9px]">
                            {frame.defect_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[9px]">0</span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-1 font-mono">
                        Frame {frame.frame_number}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Frame Detail Diagnostic Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#0f294a] bg-[#0f294a]/5 px-2 py-0.5 rounded border border-[#0f294a]/10">
                    DIAGNOSTIC FRAME INSPECTOR
                  </span>
                  <h4 className="text-lg font-bold text-slate-800 mt-1">
                    Frame #{activeFrame?.frame_number || 0} @ {activeFrame?.formatted_time || "00:00"}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      activeFrame?.defect_count > 0
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {activeFrame?.defect_count > 0
                      ? `${activeFrame.defect_count} Defect(s) Localized`
                      : "Clear Road Surface"}
                  </span>
                </div>
              </div>

              {/* Annotated Frame Display & Bounding Box Details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Visual Preview */}
                <div className="md:col-span-7">
                  <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                    {activeFrame?.preview_image || inspectionResult.preview_image_url ? (
                      <AuthenticatedImage
                        src={detectionService.getMediaUrl(
                          activeFrame?.preview_image || inspectionResult.preview_image_url
                        )}
                        alt={`Road damage detection frame ${activeFrame?.frame_number}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-6">
                        <FaRoad className="text-5xl text-slate-600 mx-auto mb-2" />
                        <span className="text-xs">Preview Frame Not Rendered</span>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 text-[9px] font-mono text-white bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm">
                      RDD2022 Frame Annotation
                    </span>
                  </div>
                </div>

                {/* Localized Defect Instances for this Frame */}
                <div className="md:col-span-5 space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Defects on this Frame ({activeFrameDetections.length})
                  </span>

                  {activeFrameDetections.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {activeFrameDetections.map((det, dIdx) => {
                        const dClass = det.class || "Defect";
                        const dConf = det.confidence ? Math.round(det.confidence * 100) : 0;
                        const dSev = det.severity || "Medium";
                        const dCost = det.estimated_cost || "₹5,000";
                        const bbox = Array.isArray(det.bounding_box)
                          ? det.bounding_box.map((n) => Math.round(n)).join(", ")
                          : "N/A";

                        return (
                          <div
                            key={dIdx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{dClass}</span>
                              <span
                                className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                  dSev === "Critical"
                                    ? "bg-red-100 text-red-800"
                                    : dSev === "High"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {dSev}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                              <span>Conf: <strong className="text-emerald-700">{dConf}%</strong></span>
                              <span>Est: <strong className="text-slate-700">{dCost}</strong></span>
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono bg-white p-1 rounded border border-slate-200">
                              BBox: [{bbox}]
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                      <FaCheckCircle className="text-2xl text-emerald-500/40 mx-auto mb-2" />
                      <span>No anomalies detected on this frame.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
