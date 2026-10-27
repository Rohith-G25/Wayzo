from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.utils.gps import haversine_distance

class HospitalService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_nearby_hospitals(self, lat: float, lon: float) -> List[Dict[str, Any]]:
        """
        Query seeded hospitals, calculate Haversine distance,
        estimate ETA, and return them sorted by proximity.
        """
        cursor = self.db.hospitals.find()
        hospitals_list = await cursor.to_list(length=100)
        
        results = []
        for hosp in hospitals_list:
            hosp_lat = hosp["latitude"]
            hosp_lon = hosp["longitude"]
            
            # Calculate distance in km
            dist_km = haversine_distance(lat, lon, hosp_lat, hosp_lon)
            
            # Calculate simulated ETA (average speed 40 km/h + 2 mins base delay)
            eta_mins = int((dist_km / 40.0) * 60.0) + 2
            
            # Ensure nice readable strings
            distance_str = f"{dist_km:.1f} km"
            eta_str = f"{eta_mins} mins" if eta_mins > 1 else "1 min"
            
            results.append({
                "nearestHospital": hosp["name"],
                "distance": distance_str,
                "eta": eta_str,
                "ambulanceStatus": hosp.get("ambulance_status", "Available"),
                "contact": hosp.get("contact"),
                "latitude": hosp_lat,
                "longitude": hosp_lon,
                "raw_distance": dist_km  # used for sorting
            })
            
        # Sort by distance
        results.sort(key=lambda x: x["raw_distance"])
        
        # Remove raw distance before returning
        for res in results:
            res.pop("raw_distance")
            
        return results
