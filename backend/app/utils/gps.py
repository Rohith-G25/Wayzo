import math
import random
from typing import Tuple, Optional, Dict
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def get_decimal_from_dms(dms, ref) -> float:
    """Convert Degrees-Minutes-Seconds GPS coordinates to decimal degrees."""
    degrees = float(dms[0])
    minutes = float(dms[1])
    seconds = float(dms[2])
    
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def validate_coordinates(lat: Optional[float], lon: Optional[float]) -> Optional[Tuple[float, float]]:
    """
    Validate latitude (-90 to 90) and longitude (-180 to 180).
    Returns (latitude, longitude) as floats rounded to 6 decimal places if strictly valid,
    otherwise returns None. Safely rejects None, NaNs, infinities, strings that cannot be parsed,
    and out-of-range coordinates.
    """
    try:
        if lat is None or lon is None:
            return None
        f_lat = float(lat)
        f_lon = float(lon)
        if math.isnan(f_lat) or math.isnan(f_lon) or math.isinf(f_lat) or math.isinf(f_lon):
            return None
        if -90.0 <= f_lat <= 90.0 and -180.0 <= f_lon <= 180.0:
            return round(f_lat, 6), round(f_lon, 6)
        return None
    except (ValueError, TypeError):
        return None

def extract_gps_metadata(image_path: str) -> Optional[Tuple[float, float]]:
    """
    Extract GPS Latitude and Longitude from image EXIF metadata.
    Returns (latitude, longitude) or None if not found or parsing failed.
    """
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        if not exif_data:
            return None
            
        gps_info = {}
        for tag, value in exif_data.items():
            decoded = TAGS.get(tag, tag)
            if decoded == "GPSInfo":
                for gps_tag in value:
                    sub_decoded = GPSTAGS.get(gps_tag, gps_tag)
                    gps_info[sub_decoded] = value[gps_tag]
                    
        if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
            lat_ref = gps_info.get("GPSLatitudeRef", "N")
            lon_ref = gps_info.get("GPSLongitudeRef", "E")
            
            raw_lat = get_decimal_from_dms(gps_info["GPSLatitude"], lat_ref)
            raw_lon = get_decimal_from_dms(gps_info["GPSLongitude"], lon_ref)
            
            return validate_coordinates(raw_lat, raw_lon)
    except Exception:
        # Fail silently in production, metadata extraction is optional
        pass
    return None

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two GPS points in kilometers.
    """
    # Earth radius in kilometers
    R = 6371.0
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
        
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance

def get_mock_road_name(lat: float, lon: float) -> str:
    """
    Resolve a realistic-looking mock road name based on GPS coordinates.
    """
    road_prefixes = ["NH-", "State Highway ", "Major District Road ", "Sector ", "Block ", "Avenue "]
    road_names = [
        "Mahatma Gandhi Marg", "Ring Road Bypass", "Gurgaon-Delhi Expressway", 
        "Connaught Place Outer Circle", "Netaji Subhash Chandra Bose Road",
        "Sardar Patel Path", "Kalyani Highway", "Okhla Link Road",
        "Jawaharlal Nehru Road", "Brigade Route", "Indiranagar 100 Feet Road"
    ]
    road_suffixes = ["Lane 1", "Block C Junction", "Near Toll Plaza", "Flyover Approach", "Underpass Exit", ""]
    
    # Use coordinates to seed the random generator for consistency per location
    seed = int((abs(lat) * 1000) + (abs(lon) * 1000))
    rnd = random.Random(seed)
    
    prefix = rnd.choice(road_prefixes)
    if prefix in ["NH-", "State Highway ", "Sector ", "Block "]:
        prefix += str(rnd.randint(1, 100)) + " "
        
    name = rnd.choice(road_names)
    suffix = rnd.choice(road_suffixes)
    
    full_road = f"{prefix}{name}"
    if suffix:
        full_road += f", {suffix}"
        
    return full_road
