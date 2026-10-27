import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { FaExclamationTriangle, FaVideo, FaHospital, FaCheckCircle } from "react-icons/fa";

// Create custom leaflet marker pins based on category
const createPinIcon = (category, severity = "Medium") => {
  let bgColor = "bg-blue-600";
  let pulseRing = "border-blue-400";

  if (category === "damage") {
    if (severity === "Critical" || severity === "High") {
      bgColor = "bg-red-600";
      pulseRing = "border-red-400";
    } else {
      bgColor = "bg-amber-500";
      pulseRing = "border-amber-300";
    }
  } else if (category === "camera") {
    bgColor = "bg-indigo-600";
    pulseRing = "border-indigo-400";
  } else if (category === "hospital") {
    bgColor = "bg-emerald-600";
    pulseRing = "border-emerald-400";
  }

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-6 h-6 rounded-full border-2 ${pulseRing} animate-ping opacity-75"></div>
        <div class="w-4 h-4 rounded-full border-2 border-white ${bgColor} shadow-md flex items-center justify-center">
          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
        </div>
      </div>
    `,
    className: "custom-gis-pin",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

export default function RoadMap({
  center = [28.6139, 77.2090], // Default Delhi coordinates or customizable
  zoom = 12,
  height = "420px",
  markers = [],
  showRadius = false,
  radiusMeters = 3000,
  onMarkerClick = null,
}) {
  return (
    <div
      style={{ height }}
      className="w-full relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        className="z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showRadius && (
          <Circle
            center={center}
            radius={radiusMeters}
            pathOptions={{
              color: "#0f294a",
              fillColor: "#0f294a",
              fillOpacity: 0.08,
              dashArray: "4, 6",
            }}
          />
        )}

        {markers.map((marker, index) => {
          const lat = marker.latitude || marker.lat;
          const lng = marker.longitude || marker.lng;
          if (!lat || !lng) return null;

          return (
            <Marker
              key={marker.id || index}
              position={[lat, lng]}
              icon={createPinIcon(marker.category || "damage", marker.severity)}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(marker),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[180px] text-xs">
                  <div className="flex items-center justify-between mb-1.5 border-b border-slate-100 pb-1">
                    <span className="font-bold text-slate-800 text-[11px]">
                      {marker.title || marker.name || "Incident Spot"}
                    </span>
                    {marker.severity && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          marker.severity === "Critical"
                            ? "bg-red-100 text-red-700"
                            : marker.severity === "High"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {marker.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[10px] mb-1">
                    {marker.description || marker.location || "Road section monitored by SmartRoadAI"}
                  </p>
                  <div className="text-[9px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-50">
                    GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
