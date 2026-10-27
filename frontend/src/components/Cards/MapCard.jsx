import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { FaExternalLinkAlt, FaVideo, FaCamera, FaCrosshairs } from "react-icons/fa";
import detectionService from "../../services/detectionService";

// Helper component to auto-fit bounds on mount
function AutoBounds({ bounds, center }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.min_lat && bounds?.max_lat && bounds?.min_lon && bounds?.max_lon) {
      const b = L.latLngBounds(
        [bounds.min_lat, bounds.min_lon],
        [bounds.max_lat, bounds.max_lon]
      );
      if (b.isValid()) {
        map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
      }
    } else if (center) {
      map.setView(center, 12);
    }
  }, [bounds, center, map]);
  return null;
}

// Custom DivIcon for real detections
const createCustomIcon = (severity = "Low", isVideo = false) => {
  let colorClass = "bg-blue-600 shadow-blue-600/30";
  if (severity === "Critical") {
    colorClass = "bg-red-600 shadow-red-600/30";
  } else if (severity === "High") {
    colorClass = "bg-orange-600 shadow-orange-600/30";
  } else if (severity === "Medium") {
    colorClass = "bg-amber-500 shadow-amber-500/30";
  }

  const borderRing = isVideo ? "ring-2 ring-purple-500" : "";

  return L.divIcon({
    html: `<div class="w-4 h-4 rounded-full border-2 border-white ${colorClass} ${borderRing} animate-pulse shadow-sm"></div>`,
    className: "custom-leaflet-icon",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
};

export default function MapCard() {
  const [inspections, setInspections] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadRealPins() {
      try {
        const res = await detectionService.getGeoInspections({ limit: 40 });
        if (isMounted) {
          setInspections(res.located_inspections || []);
          setMeta(res.meta || null);
        }
      } catch (err) {
        console.warn("Could not load real map pins:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadRealPins();
    return () => {
      isMounted = false;
    };
  }, []);

  const defaultCenter = meta?.center || [13.0827, 80.2707];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            GIS Inspection Coordinate Overlay
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              {inspections.length} Genuine Pins
            </span>
          </h2>
          <p className="text-slate-400 text-[10px] mt-0.5 font-medium">
            Active GPS anomaly locations verified by RDD2022-YOLOv8s
          </p>
        </div>
        <Link
          to="/map"
          className="text-[11px] font-bold text-[#0f294a] hover:text-blue-700 bg-[#0f294a]/5 hover:bg-[#0f294a]/10 px-3 py-1.5 rounded-xl border border-[#0f294a]/10 transition flex items-center gap-1.5"
        >
          <span>Open Full GIS Map</span>
          <FaExternalLinkAlt size={9} />
        </Link>
      </div>

      <div className="h-[350px] w-full relative">
        <MapContainer
          center={defaultCenter}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {meta?.bounds && inspections.length > 0 && (
            <AutoBounds bounds={meta.bounds} center={defaultCenter} />
          )}

          {inspections.map((item) => (
            <Marker
              key={item.id}
              position={[item.latitude, item.longitude]}
              icon={createCustomIcon(item.highest_severity, item.media_type === "video")}
            >
              <Popup>
                <div className="p-1 text-xs text-slate-700 font-sans">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900">{item.detection_id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase font-black text-[9px] ${
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
                  <div className="text-[10px] text-slate-500 mb-1.5">
                    {item.media_type === "video" ? "Video Dashcam Scan" : "Image Road Scan"} •{" "}
                    {item.defect_count} defect(s)
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mb-2">
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </div>
                  <Link
                    to="/map"
                    className="block text-center py-1 bg-[#0f294a] text-white rounded text-[10px] font-bold hover:bg-[#183b68]"
                  >
                    View in GIS Explorer
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Empty state overlay */}
        {!loading && inspections.length === 0 && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center p-4 z-10">
            <div className="text-center max-w-xs">
              <p className="text-xs font-bold text-slate-700">No Located Inspections</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Upload image or video inspections with GPS coordinates to view live pins.
              </p>
              <Link
                to="/road-damage"
                className="mt-3 inline-block px-3 py-1.5 bg-[#0f294a] text-white text-[11px] font-bold rounded-lg shadow-sm"
              >
                Upload Road Media
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}