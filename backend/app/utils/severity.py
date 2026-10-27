# Heuristic Severity Assessment Configuration
# NOTE: This calculation is a geometric heuristic combining bounding-box relative area
# and neural network confidence. It is not a certified structural/civil engineering assessment.
SEVERITY_HEURISTIC_DISCLAIMER = (
    "Heuristic calculation based on bounding-box surface area and model confidence; "
    "not a certified civil/pavement engineering assessment."
)

def calculate_severity(bbox: list[float], confidence: float, img_width: int = 640, img_height: int = 640) -> str:
    """
    Calculate severity based on bounding box size, confidence, and detected area.
    bbox format: [x_min, y_min, x_max, y_max]
    
    WARNING: This is an empirical heuristic, NOT a validated pavement engineering structural test.
    """
    if len(bbox) < 4:
        return "Low"

    x_min, y_min, x_max, y_max = bbox
    
    # Check if coordinates are normalized (0 to 1) or pixel coordinates
    is_normalized = all(0.0 <= val <= 1.0 for val in bbox)
    
    if is_normalized:
        width = x_max - x_min
        height = y_max - y_min
        area = width * height
    else:
        width = max(0.0, x_max - x_min)
        height = max(0.0, y_max - y_min)
        safe_width = img_width if img_width > 0 else 640
        safe_height = img_height if img_height > 0 else 640
        area = (width * height) / (safe_width * safe_height)

    # Base severity score calculation
    # Weights: Area (60%), Confidence (40%)
    severity_score = (area * 8.0) + (confidence * 2.0)
    
    if severity_score >= 1.5 or (area > 0.15 and confidence > 0.8):
        return "Critical"
    elif severity_score >= 0.8 or (area > 0.08 and confidence > 0.7):
        return "High"
    elif severity_score >= 0.4 or (area > 0.03 and confidence > 0.5):
        return "Medium"
    else:
        return "Low"

def estimate_repair_cost(class_name: str, severity: str, bbox: list[float], img_width: int = 640, img_height: int = 640) -> str:
    """
    Estimate the repair cost in INR based on damage type and severity.
    
    NOTE: Heuristic cost estimation based on typical municipal asphalt patching
    and crack-sealing rate schedules.
    """
    if len(bbox) < 4:
        return "₹2000"
        
    x_min, y_min, x_max, y_max = bbox
    is_normalized = all(0.0 <= val <= 1.0 for val in bbox)
    
    if is_normalized:
        width = x_max - x_min
        height = y_max - y_min
        area = width * height
    else:
        width = max(0.0, x_max - x_min)
        height = max(0.0, y_max - y_min)
        safe_width = img_width if img_width > 0 else 640
        safe_height = img_height if img_height > 0 else 640
        area = (width * height) / (safe_width * safe_height)

    # Cost calculation based on road defect class and severity
    base_costs = {
        "pothole": {
            "Low": 3000,
            "Medium": 6000,
            "High": 15000,
            "Critical": 25000
        },
        "alligator_crack": {
            "Low": 2500,
            "Medium": 5500,
            "High": 12000,
            "Critical": 20000
        },
        "alligator crack": {
            "Low": 2500,
            "Medium": 5500,
            "High": 12000,
            "Critical": 20000
        },
        "longitudinal_crack": {
            "Low": 1500,
            "Medium": 3500,
            "High": 7000,
            "Critical": 11000
        },
        "longitudinal crack": {
            "Low": 1500,
            "Medium": 3500,
            "High": 7000,
            "Critical": 11000
        },
        "transverse_crack": {
            "Low": 1500,
            "Medium": 3500,
            "High": 7000,
            "Critical": 11000
        },
        "transverse crack": {
            "Low": 1500,
            "Medium": 3500,
            "High": 7000,
            "Critical": 11000
        },
        "crack": {
            "Low": 1500,
            "Medium": 3500,
            "High": 7000,
            "Critical": 12000
        },
        "default": {
            "Low": 2000,
            "Medium": 4500,
            "High": 10000,
            "Critical": 18000
        }
    }
    
    norm_key = class_name.lower().replace("-", "_").strip()
    if norm_key not in base_costs:
        norm_key = "default"
        
    base_cost = base_costs[norm_key].get(severity, base_costs["default"].get(severity, 2000))
    
    # Scale cost slightly based on fine area size
    cost_multiplier = 1.0 + (min(area, 0.5) * 0.5)
    final_cost = int(base_cost * cost_multiplier)
    
    # Round to nearest 500 for clean formatting
    rounded_cost = round(final_cost / 500) * 500
    
    return f"₹{rounded_cost}"

