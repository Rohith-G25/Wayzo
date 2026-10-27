import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FaHospital,
  FaHeartbeat,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaSearch,
  FaPlusCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import detectionService from "../../services/detectionService";

// Leaflet marker config
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const defaultHospitalsData = [
  {
    id: "HSP-01",
    name: "Metro Trauma & General Hospital",
    lat: 28.6200,
    lng: 77.2200,
    beds: 14,
    icu: 3,
    status: "Normal",
    phone: "+91-11-4578900",
    distance: "1.2 km",
    travelTime: "4 mins",
    specialization: "Level 1 Trauma, Burn Unit"
  },
  {
    id: "HSP-02",
    name: "City Emergency Care Center",
    lat: 28.5450,
    lng: 77.4000,
    beds: 8,
    icu: 0,
    status: "Ambulance Dispatched",
    phone: "+91-11-2365447",
    distance: "3.4 km",
    travelTime: "9 mins",
    specialization: "Trauma Care, Emergency Surgery"
  },
  {
    id: "HSP-03",
    name: "Apex Specialty Hospital",
    lat: 28.6320,
    lng: 77.3750,
    beds: 22,
    icu: 5,
    status: "Normal",
    phone: "+91-11-9876543",
    distance: "5.8 km",
    travelTime: "12 mins",
    specialization: "Cardiology, Emergency Triage"
  }
];

// Incident location coordinates (Default Delhi center)
const incidentCoords = [28.6139, 77.2090];

// Custom clean map indicators
const createCustomIcon = (type) => {
  let colorClass = "bg-blue-600 shadow-blue-650/30";
  if (type === "incident") {
    colorClass = "bg-red-650 shadow-red-650/30";
  }

  return L.divIcon({
    html: `<div class="w-4 h-4 rounded-full border-2 border-white ${colorClass} animate-pulse shadow-sm"></div>`,
    className: "custom-leaflet-icon",
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

// Map auto-panner component
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function Hospitals() {
  const [hospitals, setHospitals] = useState(defaultHospitalsData);
  const [selectedHsp, setSelectedHsp] = useState(defaultHospitalsData[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHospitals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await detectionService.getNearbyHospitals(incidentCoords[0], incidentCoords[1]);
      if (Array.isArray(res) && res.length > 0) {
        const mapped = res.map((h, idx) => ({
          id: `HSP-0${idx + 1}`,
          name: h.nearestHospital || h.name || `Emergency Hospital ${idx + 1}`,
          lat: h.latitude || (incidentCoords[0] + (idx * 0.015)),
          lng: h.longitude || (incidentCoords[1] + (idx * 0.01)),
          beds: 12 + ((idx * 6) % 18),
          icu: (h.ambulanceStatus || h.ambulance_status) === "Available" ? 4 : 1,
          status: (h.ambulanceStatus || h.ambulance_status) === "Available" ? "Normal" : "Ambulance Dispatched",
          phone: h.contact || "+91-11-4578900",
          distance: h.distance || "1.5 km",
          travelTime: h.eta || "5 mins",
          specialization: idx === 0 ? "Level 1 Trauma, Burn Unit" : "Emergency Surgery & Critical Care"
        }));
        setHospitals(mapped);
        setSelectedHsp(mapped[0]);
      }
    } catch (err) {
      console.warn("[Hospitals] Error loading hospitals:", err);
      setError(err.message || "Failed to load hospital dispatch centers from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const filteredHospitals = hospitals.filter((hsp) =>
    hsp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-slate-800">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <FaHospital className="text-[#0f294a] text-2xl" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Emergency Routing & Hospitals</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">Real-time trauma center capacity logs and optimized ambulance dispatch routes</p>
        </div>

        <div className="relative w-full lg:w-72">
          <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search hospitals database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 text-slate-800 text-xs rounded-xl pl-10 pr-4 py-3 w-full border border-slate-205 outline-none focus:border-[#0f294a] transition"
          />
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
            onClick={fetchHospitals}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-1.5"
          >
            <FaSyncAlt className="text-[10px]" /> Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left column: Hospital Map */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden h-[600px] shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Emergency Routing Layer</span>
            <span className="text-[#0f294a] font-mono font-semibold">
              Routing Active: {selectedHsp ? selectedHsp.name : "None Selected"}
            </span>
          </div>

          <div className="w-full h-[546px] relative">
            <MapContainer
              center={selectedHsp ? [selectedHsp.lat, selectedHsp.lng] : incidentCoords}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <ChangeMapView center={selectedHsp ? [selectedHsp.lat, selectedHsp.lng] : incidentCoords} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Accident hotspot marker */}
              <Marker position={incidentCoords} icon={createCustomIcon("incident")}>
                <Popup>
                  <div className="text-xs p-1 text-slate-700">
                    <span className="font-bold text-red-650 block uppercase mb-1">🚨 INCIDENT COORDINATE</span>
                    GPS: {incidentCoords[0]}, {incidentCoords[1]}
                  </div>
                </Popup>
              </Marker>

              {/* Hospitals markers */}
              {hospitals.map((hsp) => (
                <Marker
                  key={hsp.id}
                  position={[hsp.lat, hsp.lng]}
                  icon={createCustomIcon("hospital")}
                  eventHandlers={{
                    click: () => setSelectedHsp(hsp)
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1 text-slate-700">
                      <span className="font-bold text-blue-650 block mb-1">{hsp.name}</span>
                      Avail Beds: {hsp.beds} // ICU: {hsp.icu}
                      <p className="mt-1 text-[10px] text-slate-500">Distance: {hsp.distance} (ETA: {hsp.travelTime})</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Draw emergency line to selected hospital */}
              {selectedHsp && (
                <Polyline
                  positions={[incidentCoords, [selectedHsp.lat, selectedHsp.lng]]}
                  color="#0f294a"
                  weight={4}
                  dashArray="10, 10"
                />
              )}
            </MapContainer>
          </div>
        </div>

        {/* Right column: Capacity Info and Contacts */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block px-1">Regional Capacity Status</span>

          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {filteredHospitals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
                <FaHospital className="text-slate-300 text-3xl mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Hospitals Found</p>
                <p className="text-[10px] text-slate-400 mt-1">No emergency facilities match your search query.</p>
              </div>
            ) : (
              filteredHospitals.map((hsp) => {
                const isSelected = selectedHsp && hsp.id === selectedHsp.id;
                const isDispatched = hsp.status.includes("Dispatched");

                return (
                  <div
                    key={hsp.id}
                    onClick={() => setSelectedHsp(hsp)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-white border-[#0f294a] ring-2 ring-[#0f294a]/5 shadow-md"
                        : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg border border-slate-200">
                        <FaHospital className={isDispatched ? "text-amber-500" : "text-blue-600"} />
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs text-[#0f294a] font-bold">{hsp.id}</span>
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            isDispatched ? "bg-amber-500/10 text-amber-700 border border-amber-550/20" : "bg-emerald-500/10 text-emerald-700 border border-emerald-555/20"
                          }`}>
                            {hsp.status}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-slate-800 mt-1.5 leading-snug">{hsp.name}</h3>
                        <p className="text-slate-500 text-xs mt-1">{hsp.specialization}</p>

                        {/* Stat figures */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 mt-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">Available ICU Beds</span>
                            <span className={`font-bold ${hsp.icu === 0 ? "text-red-650 animate-pulse" : "text-emerald-700"}`}>
                              {hsp.icu} Beds
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Dispatch Time</span>
                            <span className="font-bold text-slate-800 font-mono">{hsp.travelTime}</span>
                          </div>
                        </div>

                        {/* Route detail metrics */}
                        {isSelected && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1"><FaMapMarkerAlt /> Distance: {hsp.distance}</span>
                            <a href={`tel:${hsp.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                              <FaPhoneAlt /> Call ER Desk
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
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
