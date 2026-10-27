import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaMapMarkedAlt,
  FaFilter,
  FaVideo,
  FaCamera,
  FaExclamationTriangle,
  FaCrosshairs,
  FaSyncAlt,
  FaInfoCircle,
  FaTimes,
  FaCheck,
  FaExternalLinkAlt,
  FaLayerGroup,
  FaSearchLocation,
  FaCompass,
  FaRoad,
  FaExpand,
  FaQuestionCircle,
  FaSatellite,
  FaClipboard,
  FaTools,
  FaFilePdf,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";
import AuthenticatedImage from "../../components/Common/AuthenticatedImage";

// Fix standard Leaflet icon paths
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/**
 * Controller component inside MapContainer to dynamically fit bounds or recenter
 */
function MapBoundsController({ bounds, center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.min_lat && bounds.max_lat && bounds.min_lon && bounds.max_lon) {
      const leafletBounds = L.latLngBounds(
        [bounds.min_lat, bounds.min_lon],
        [bounds.max_lat, bounds.max_lon]
      );
      if (leafletBounds.isValid()) {
        map.fitBounds(leafletBounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true,
        });
      }
    } else if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom || 13, { animate: true });
    }
  }, [bounds, center, zoom, map]);

  return null;
}

/**
 * Helper to generate custom styled Leaflet divIcons distinguishing
 * severity levels and media type (Video vs Image).
 */
const createPinIcon = (item, isSelected = false) => {
  const isVideo = item.media_type === "video";
  const severity = item.highest_severity || "Low";
  const count = item.defect_count || 0;

  // Severity color schemes
  let colorBg = "bg-blue-600";
  let pulseRing = "border-blue-400";
  let badgeColor = "bg-blue-500";

  if (severity === "Critical") {
    colorBg = "bg-red-600";
    pulseRing = "border-red-500";
    badgeColor = "bg-red-500";
  } else if (severity === "High") {
    colorBg = "bg-orange-600";
    pulseRing = "border-orange-400";
    badgeColor = "bg-orange-500";
  } else if (severity === "Medium") {
    colorBg = "bg-amber-500";
    pulseRing = "border-amber-300";
    badgeColor = "bg-amber-400";
  }

  // Media type indicator
  const mediaRing = isVideo ? "ring-2 ring-purple-500 ring-offset-1" : "";
  const mediaBadge = isVideo
    ? `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[7px] font-black border border-white shadow">V</span>`
    : `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[7px] font-black border border-white shadow">I</span>`;

  const scaleClass = isSelected ? "scale-125 z-50 ring-4 ring-white shadow-xl" : "hover:scale-110";

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center custom-map-pin transition-transform duration-200 ${scaleClass}">
        ${(severity === "Critical" || severity === "High") ? `<div class="absolute w-8 h-8 rounded-full border-2 ${pulseRing} animate-ping opacity-60"></div>` : ""}
        <div class="w-6 h-6 rounded-full border-2 border-white ${colorBg} ${mediaRing} shadow-md flex items-center justify-center text-white font-mono text-[9px] font-black">
          ${count > 0 ? count : "•"}
        </div>
        ${mediaBadge}
      </div>
    `,
    className: "wayzo-geo-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export default function DamageMap() {
  const [inspections, setInspections] = useState([]);
  const [unlocated, setUnlocated] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterMediaType, setFilterMediaType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // Selection & Drawer states
  const [selectedItem, setSelectedItem] = useState(null);
  const [showUnlocatedDrawer, setShowUnlocatedDrawer] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [previewModalImg, setPreviewModalImg] = useState(null);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Map state
  const [mapCenter, setMapCenter] = useState([13.0827, 80.2707]);
  const [mapBounds, setMapBounds] = useState(null);
  const mapRef = useRef(null);

  // Work order dispatch states
  const [dispatchingId, setDispatchingId] = useState(null);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState(null);

  // PDF report download state
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

  const handleDispatchWorkOrder = async (item) => {
    if (!item || !item.detection_id) return;
    setDispatchingId(item.detection_id);
    setDispatchSuccessMsg(null);
    try {
      const res = await detectionService.createWorkOrderFromInspection(item.detection_id, {
        road_name: `Roadway near [${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}]`,
        priority: item.highest_severity || "High",
        estimated_cost: item.estimated_cost || "₹15,000",
        damage_category: item.categories?.[0] || "Pothole",
        description: `Dispatched from GIS Damage Map for ${item.categories?.join(', ') || 'road surface defects'}. Verified GPS: ${item.latitude?.toFixed(5)}, ${item.longitude?.toFixed(5)}.`
      });
      const created = res?.data || res;
      const woId = created.work_order_id || created.ticket_id;
      const woStatus = created.status || "Open";

      // Update selected item in local drawer
      setSelectedItem((prev) => ({
        ...prev,
        work_order_id: woId,
        work_order_status: woStatus
      }));

      // Update located list
      setInspections((prev) =>
        prev.map((loc) =>
          loc.detection_id === item.detection_id
            ? { ...loc, work_order_id: woId, work_order_status: woStatus }
            : loc
        )
      );

      setDispatchSuccessMsg(`Work order ${woId} dispatched successfully!`);
      setTimeout(() => setDispatchSuccessMsg(null), 5000);
    } catch (err) {
      console.error("Failed to dispatch work order:", err);
      alert(err.message || err.data?.detail || "Failed to create work order.");
    } finally {
      setDispatchingId(null);
    }
  };

  // Fetch geographic records from backend
  const fetchGeoData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await detectionService.getGeoInspections({
        media_type: filterMediaType,
        severity: filterSeverity,
        category: filterCategory,
        limit: 300,
      });

      setInspections(res.located_inspections || []);
      setUnlocated(res.unlocated_inspections || []);
      setMeta(res.meta || null);

      if (res.meta?.bounds && res.located_inspections?.length > 0) {
        setMapBounds(res.meta.bounds);
      } else if (res.meta?.center) {
        setMapCenter(res.meta.center);
        setMapBounds(null);
      }
    } catch (err) {
      console.warn("Failed to load geographic inspection records:", err);
      setError(
        err.message ||
          err.data?.detail ||
          "Could not retrieve geographic road damage telemetry."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGeoData();
  }, [filterMediaType, filterSeverity, filterCategory]);

  // Fit map to currently filtered markers
  const handleFitToMarkers = () => {
    if (meta?.bounds && inspections.length > 0) {
      setMapBounds({ ...meta.bounds, _ts: Date.now() });
    } else if (inspections.length > 0) {
      const lats = inspections.map((i) => i.latitude);
      const lons = inspections.map((i) => i.longitude);
      setMapBounds({
        min_lat: Math.min(...lats),
        max_lat: Math.max(...lats),
        min_lon: Math.min(...lons),
        max_lon: Math.max(...lons),
        _ts: Date.now(),
      });
    }
  };

  // Copy coordinates helper
  const handleCopyCoords = (lat, lon) => {
    const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Quick summary statistics
  const criticalCount = useMemo(
    () => inspections.filter((i) => i.highest_severity === "Critical").length,
    [inspections]
  );
  const videoCount = useMemo(
    () => inspections.filter((i) => i.media_type === "video").length,
    [inspections]
  );
  const imageCount = useMemo(
    () => inspections.filter((i) => i.media_type === "image").length,
    [inspections]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 relative overflow-hidden font-sans">
      {/* Top GIS Toolbar / Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-20 shrink-0 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#0f294a] tracking-tight flex items-center gap-2.5">
              <FaMapMarkedAlt className="text-blue-600" />
              Road Damage GIS Monitoring Map
            </h1>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
              RDD2022 Certified
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Real-time spatial mapping of AI-detected road hazards from vehicle camera & dashcam streams
          </p>
        </div>

        {/* Status Chip Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <div className="text-[11px] leading-tight">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Located Pins</span>
              <span className="font-bold text-slate-800 font-mono">{inspections.length}</span>
            </div>
          </div>

          <button
            onClick={() => setShowUnlocatedDrawer(!showUnlocatedDrawer)}
            className={`border rounded-xl px-3 py-1.5 flex items-center gap-2 shrink-0 transition ${
              unlocated.length > 0
                ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            <FaQuestionCircle className={unlocated.length > 0 ? "text-amber-500" : "text-slate-400"} />
            <div className="text-[11px] leading-tight text-left">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Unlocated</span>
              <span className="font-bold font-mono">{unlocated.length} records</span>
            </div>
          </button>

          <div className="bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <div className="text-[11px] leading-tight">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Critical</span>
              <span className="font-bold text-red-600 font-mono">{criticalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Ribbon */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-10 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Media Type Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
            <button
              onClick={() => setFilterMediaType("all")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                filterMediaType === "all"
                  ? "bg-[#0f294a] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterMediaType("image")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition ${
                filterMediaType === "image"
                  ? "bg-[#0f294a] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FaCamera className="text-[10px]" /> Images ({imageCount})
            </button>
            <button
              onClick={() => setFilterMediaType("video")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition ${
                filterMediaType === "video"
                  ? "bg-[#0f294a] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FaVideo className="text-[10px]" /> Videos ({videoCount})
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Category:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0f294a]"
            >
              <option value="all">All Defect Categories</option>
              <option value="Pothole">Potholes</option>
              <option value="Longitudinal Crack">Longitudinal Cracks</option>
              <option value="Transverse Crack">Transverse Cracks</option>
              <option value="Alligator Crack">Alligator Cracks</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#0f294a]"
            >
              <option value="all">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFitToMarkers}
            disabled={inspections.length === 0}
            title="Auto-fit map viewport to all located inspection markers"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
          >
            <FaCrosshairs className="text-blue-600 text-[11px]" />
            <span>Fit Markers</span>
          </button>

          <button
            onClick={() => setShowLegend(!showLegend)}
            title="Toggle map symbols and severity legend"
            className={`px-3 py-1.5 border rounded-lg font-bold flex items-center gap-1.5 transition ${
              showLegend
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <FaLayerGroup className="text-[11px]" />
            <span>Legend</span>
          </button>

          <button
            onClick={fetchGeoData}
            disabled={isLoading}
            title="Refresh GPS telemetry data from MongoDB"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-2xs transition"
          >
            <FaSyncAlt className={`text-xs ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="flex-1 relative w-full h-full">
        {/* Leaflet Map */}
        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsController
            bounds={mapBounds}
            center={mapCenter}
            zoom={12}
          />

          {/* Inspection Markers */}
          {inspections.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <Marker
                key={item.id}
                position={[item.latitude, item.longitude]}
                icon={createPinIcon(item, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedItem(item);
                  },
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[200px] text-xs font-sans">
                    <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100">
                      <span className="font-black text-[#0f294a] text-xs">
                        {item.detection_id}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          item.highest_severity === "Critical"
                            ? "bg-red-100 text-red-700"
                            : item.highest_severity === "High"
                            ? "bg-orange-100 text-orange-700"
                            : item.highest_severity === "Medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {item.highest_severity}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
                      <span className="font-bold text-slate-700 capitalize">
                        {item.media_type === "video" ? "Video Scan" : "Image Scan"}
                      </span>
                      <span>•</span>
                      <span>{item.defect_count} defect(s) detected</span>
                    </div>

                    {item.preview_image_url && (
                      <div className="rounded overflow-hidden border border-slate-100 mb-2 bg-slate-900 aspect-video max-h-24">
                        <AuthenticatedImage
                          src={detectionService.getMediaUrl(item.preview_image_url)}
                          alt="Defect preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 font-mono mb-2">
                      GPS: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </div>

                    <button
                      onClick={() => setSelectedItem(item)}
                      className="w-full py-1.5 bg-[#0f294a] hover:bg-[#183b68] text-white rounded font-bold text-[11px] text-center transition"
                    >
                      Inspect Full Telemetry
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Empty State Overlay */}
        {!isLoading && inspections.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-10 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-6 shadow-xl max-w-md text-center pointer-events-auto">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-lg">
                <FaSearchLocation />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                No Geographic Inspections Found
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                No road inspections with valid GPS coordinates matched the selected filters.
                Upload an image or video with location coordinates to view markers on this map.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setFilterMediaType("all");
                    setFilterSeverity("all");
                    setFilterCategory("all");
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Reset Active Filters
                </button>
                {unlocated.length > 0 && (
                  <button
                    onClick={() => setShowUnlocatedDrawer(true)}
                    className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition"
                  >
                    View {unlocated.length} Unlocated Records
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Map Legend */}
        <AnimatePresence>
          {showLegend && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 shadow-lg z-10 max-w-xs text-xs"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <FaLayerGroup className="text-blue-600" /> Map Legend
                </span>
                <button
                  onClick={() => setShowLegend(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FaTimes size={10} />
                </button>
              </div>

              {/* Severity Indicators */}
              <div className="space-y-1.5 mb-2.5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Severity Thresholds
                </span>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white shadow-2xs"></span>
                  <span>Critical (Immediate repair recommended)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-orange-600 border border-white shadow-2xs"></span>
                  <span>High Severity (Pavement cracking / pothole)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-2xs"></span>
                  <span>Medium Severity (Surface weathering)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white shadow-2xs"></span>
                  <span>Low Severity / Inspection Log</span>
                </div>
              </div>

              {/* Pin Icons Explanation */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Inspection Media
                </span>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[7px] font-black">
                    V
                  </span>
                  <span>Video Inspection (Multi-frame scan)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[7px] font-black">
                    I
                  </span>
                  <span>Single Image Inspection</span>
                </div>
                <p className="text-[9px] text-slate-400 italic pt-1">
                  *Number inside pin indicates total defect count.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inspection Detail Drawer (Right side slide-out) */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute top-0 right-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                      selectedItem.media_type === "video" ? "bg-purple-600" : "bg-blue-600"
                    }`}
                  >
                    {selectedItem.media_type === "video" ? <FaVideo /> : <FaCamera />}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#0f294a] tracking-tight">
                      {selectedItem.detection_id}
                    </h2>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(selectedItem.timestamp).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      selectedItem.highest_severity === "Critical"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : selectedItem.highest_severity === "High"
                        ? "bg-orange-100 text-orange-700 border border-orange-200"
                        : selectedItem.highest_severity === "Medium"
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {selectedItem.highest_severity}
                  </span>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>

              {/* Drawer Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Media Preview Box */}
                {(selectedItem.preview_image_url || selectedItem.image_url) && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative group aspect-video">
                    <AuthenticatedImage
                      src={detectionService.getMediaUrl(
                        selectedItem.preview_image_url || selectedItem.image_url
                      )}
                      alt="Annotated road defect preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() =>
                        setPreviewModalImg(
                          detectionService.getMediaUrl(
                            selectedItem.preview_image_url || selectedItem.image_url
                          )
                        )
                      }
                      className="absolute bottom-2.5 right-2.5 bg-black/75 hover:bg-black text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-xs transition"
                    >
                      <FaExpand size={10} /> Enlarge View
                    </button>
                  </div>
                )}

                {/* Coordinates Telemetry Card */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <FaCompass className="text-blue-600" /> GPS Coordinates
                    </span>
                    <span className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      {selectedItem.gps_source === "exif" ? (
                        <>
                          <FaSatellite className="text-emerald-500" /> EXIF Hardware GPS
                        </>
                      ) : selectedItem.gps_source === "manual" ? (
                        <>User Manual Input</>
                      ) : (
                        <>Registry Verified</>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-slate-200">
                    <div className="font-mono text-xs font-bold text-slate-800">
                      {selectedItem.latitude.toFixed(6)}, {selectedItem.longitude.toFixed(6)}
                    </div>
                    <button
                      onClick={() =>
                        handleCopyCoords(selectedItem.latitude, selectedItem.longitude)
                      }
                      className="text-slate-500 hover:text-blue-600 text-[11px] flex items-center gap-1 font-bold transition px-2 py-1 rounded bg-slate-50 hover:bg-slate-100"
                    >
                      {copiedCoords ? (
                        <>
                          <FaCheck className="text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <FaClipboard /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  <a
                    href={`https://www.google.com/maps?q=${selectedItem.latitude},${selectedItem.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 pt-0.5"
                  >
                    Open in External Maps <FaExternalLinkAlt size={9} />
                  </a>
                </div>

                {/* Defect Metrics Summary */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Total Defects
                    </span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      {selectedItem.defect_count}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Estimated Cost
                    </span>
                    <span className="text-lg font-black text-blue-700 font-mono">
                      {selectedItem.estimated_cost}
                    </span>
                  </div>
                </div>

                {/* Defect Category Breakdown */}
                {selectedItem.category_counts && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Defect Classification
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedItem.category_counts).map(([cat, count]) => (
                        <div
                          key={cat}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            count > 0
                              ? "bg-blue-50/50 border-blue-200 text-blue-900 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-400"
                          }`}
                        >
                          <span className="text-[11px] truncate">{cat}</span>
                          <span className="font-mono text-xs">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video Metadata (if video) */}
                {selectedItem.video_metadata && (
                  <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-200 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-purple-900">
                      <FaVideo /> Video Stream Metadata
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-purple-800 font-mono pt-1">
                      <div>Duration: {selectedItem.video_metadata.duration_seconds}s</div>
                      <div>Sampled: {selectedItem.video_metadata.sampled_frames} frames</div>
                    </div>
                  </div>
                )}

                {/* Work Order Link & Dispatch Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <FaTools className="text-blue-600" /> Maintenance Work Order:
                    </span>
                    {selectedItem.work_order_id ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {selectedItem.work_order_status || "Open"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">None Dispatched</span>
                    )}
                  </div>

                  {selectedItem.work_order_id ? (
                    <Link
                      to={`/maintenance?id=${selectedItem.work_order_id}`}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <FaTools /> View Work Order #{selectedItem.work_order_id}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleDispatchWorkOrder(selectedItem)}
                      disabled={dispatchingId === selectedItem.detection_id}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      {dispatchingId === selectedItem.detection_id ? (
                        <FaSyncAlt className="animate-spin text-xs" />
                      ) : (
                        <FaTools />
                      )}
                      Dispatch Maintenance Work Order
                    </button>
                  )}

                  {dispatchSuccessMsg && (
                    <p className="text-[10px] text-emerald-700 font-bold text-center">
                      ✓ {dispatchSuccessMsg}
                    </p>
                  )}
                </div>

                {/* Heuristic Notice Alert */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1 mb-0.5">
                    <FaInfoCircle className="text-amber-600" /> Civil Engineering Notice
                  </div>
                  Severity estimates and repair costs are heuristic approximations derived from neural
                  bounding-box surface area and detection frequency; not certified structural evaluations.
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
                <Link
                  to="/road-damage"
                  className="flex-1 py-2.5 bg-[#0f294a] hover:bg-[#183b68] text-white rounded-xl text-xs font-bold text-center transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <FaRoad /> Triage Queue
                </Link>
                {selectedItem.media_type === "video" && (
                  <Link
                    to="/video-inspection"
                    className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold text-center transition shadow-sm flex items-center gap-1.5"
                  >
                    <FaVideo /> Video Tool
                  </Link>
                )}
                <button
                  onClick={() => handleDownloadPdf(selectedItem.detection_id)}
                  disabled={isDownloadingPdf === selectedItem.detection_id}
                  className="py-2.5 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                  title="Download Official PDF Inspection Report"
                >
                  {isDownloadingPdf === selectedItem.detection_id ? (
                    <FaSyncAlt className="animate-spin text-xs" />
                  ) : (
                    <FaFilePdf />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unlocated Inspections Drawer (Bottom or Left slide-out) */}
        <AnimatePresence>
          {showUnlocatedDrawer && (
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute top-0 left-0 h-full w-full max-w-md bg-white border-r border-slate-200 shadow-2xl z-20 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                    <FaQuestionCircle />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      Unlocated Inspections Queue
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      Excluded from map to prevent fabricated coordinate placement
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUnlocatedDrawer(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <div className="p-3 bg-amber-50/30 border-b border-amber-100 text-[11px] text-amber-900 leading-relaxed">
                These inspections completed genuine RDD2022-YOLOv8s damage detection, but lack
                verified GPS coordinates. Under project integrity rules, they are not plotted on the map.
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {unlocated.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No unlocated inspection records found in the database.
                  </div>
                ) : (
                  unlocated.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                            item.media_type === "video" ? "bg-purple-600" : "bg-blue-600"
                          }`}
                        >
                          {item.media_type === "video" ? <FaVideo /> : <FaCamera />}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">
                            {item.detection_id}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {new Date(item.timestamp).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            • {item.defect_count} defects
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            item.highest_severity === "Critical"
                              ? "bg-red-100 text-red-700"
                              : item.highest_severity === "High"
                              ? "bg-orange-100 text-orange-700"
                              : item.highest_severity === "Medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.highest_severity}
                        </span>
                        {item.preview_image_url && (
                          <button
                            onClick={() =>
                              setPreviewModalImg(
                                detectionService.getMediaUrl(item.preview_image_url)
                              )
                            }
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded bg-slate-50 border border-slate-200 text-xs"
                            title="Preview image"
                          >
                            <FaExpand size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox / Enlarged Image Preview Modal */}
      <AnimatePresence>
        {previewModalImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setPreviewModalImg(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewModalImg(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition"
              >
                <FaTimes size={14} />
              </button>
              <AuthenticatedImage
                src={previewModalImg}
                alt="Enlarged annotated inspection frame"
                className="max-h-[85vh] w-auto object-contain mx-auto"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
