# SmartRoadAI Backend API

A production-ready FastAPI backend for the AI-powered Smart Road Monitoring System. It incorporates OpenCV, Ultralytics YOLOv8 for real-time pothole/crack detection, and Motor (async MongoDB driver) with a self-healing database initialization layer.

## Technology Stack

- **Framework**: Python 3.12, FastAPI, Uvicorn
- **Object Detection & Processing**: Ultralytics YOLOv8, OpenCV, Pillow, NumPy
- **Database**: MongoDB (via Motor async driver, supports MongoDB Atlas)
- **Data Validation & Config**: Pydantic v2, Pydantic Settings, Python-dotenv
- **Middleware**: CORS (Cross-Origin Resource Sharing)

## Directory Structure

```text
backend/
├── app/
│   ├── main.py            # FastAPI Entry Point (CORS, Static Files, lifespan context)
│   ├── config.py          # App configuration settings using Pydantic Settings
│   ├── database.py        # MongoDB connection management & collection seeding
│   ├── dependencies.py    # FastAPI Dependency Injection provider
│   ├── routes/            # API Route definitions
│   │   ├── detection.py   # Image and Video uploads, historical detections
│   │   ├── camera.py      # Camera status list
│   │   ├── maintenance.py # Maintenance tickets creation & query endpoints
│   │   ├── analytics.py   # Consolidated stats endpoint
│   │   ├── alerts.py      # City-wide hazardous road alerts
│   │   └── hospital.py    # Nearby trauma hospital dispatch search
│   ├── services/          # Pure Domain Logic
│   │   ├── detection_service.py   # YOLO prediction loader, image & video parser
│   │   ├── maintenance_service.py # Ticket logging operations
│   │   ├── hospital_service.py    # GPS Haversine proximity calculations
│   │   └── analytics_service.py   # Database statistics compiler
│   ├── models/            # Database Document definitions (Pydantic models)
│   ├── schemas/           # API Request/Response schemas
│   └── utils/             # Independent utilities (GPS EXIF, Severity, Image IO)
├── ml/
│   └── weights/           # Trained YOLO model storage (best.pt)
├── uploads/               # Dynamic uploads storage (statically served under /uploads)
├── requirements.txt       # Core python dependencies
├── .env.example           # Configurations template
└── .env                   # Configuration file (ignored by git)
```

## Getting Started

### 1. Prerequisites
- Python 3.12+ installed
- MongoDB installed locally or a MongoDB Atlas connection URI ready

### 2. Installation
Move to the backend folder and create a virtual environment:
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```
Install dependencies:
```bash
pip install -r requirements.txt
```

### 3. Environment Setup
Copy the configuration template:
```bash
cp .env.example .env
```
Ensure your MongoDB connection string in `.env` is correct.

### 4. Running the Server
Run the FastAPI development server:
```bash
uvicorn app.main:app --reload
```
The server will boot up and automatically:
1. Verify the MongoDB connection and seed initial collections (Cameras, Hospitals, Alerts, Statistics, Detections) if empty.
2. Initialize directories under `uploads/` for dynamic file handling.
3. Validate and load the YOLO weights model located at `ml/weights/best.pt`. If no model exists, it will automatically bootstrap using the official `yolov8n.pt` and cache it.

The interactive documentation will be available at:
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## API Endpoints List

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/v1/detect/image` | Upload image, extract GPS EXIF, run YOLO inference, calculate severity & cost, log ticket. |
| **POST** | `/api/v1/detect/video` | Upload video, run frame-by-frame YOLO inference drawing bounds, save processed file. |
| **GET** | `/api/v1/detections` | Get all historical detection entries. |
| **GET** | `/api/v1/statistics` | Consolidate and fetch dashboard statistics. |
| **POST** | `/api/v1/maintenance` | Manually log a maintenance request. |
| **GET** | `/api/v1/maintenance` | Get list of logged maintenance tickets. |
| **GET** | `/api/v1/cameras` | Get traffic cameras status and coordinates. |
| **GET** | `/api/v1/alerts` | Get active city road damage hazard alerts. |
| **GET** | `/api/v1/hospitals` | Find nearby emergency response hospitals sorted by GPS distance. |
