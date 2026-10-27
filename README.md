# Wayzo — AI-Powered Road Damage Monitoring

Wayzo is an AI-powered road damage monitoring platform designed to detect road defects, visualize their locations, and manage maintenance workflows.

## Features

* **AI Road Damage Detection:** Detects potholes and road cracks using YOLOv8.
* **Image Inspection:** Upload road images for automated damage detection.
* **Video Inspection:** Analyze video footage for road defects.
* **Interactive Damage Map:** Visualize inspections with available GPS coordinates.
* **Analytics Dashboard:** Review inspection statistics and damage trends.
* **Maintenance Management:** Create and track road repair work orders.
* **PDF Reports:** Generate inspection and summary reports.
* **Authentication and Role-Based Access:** Manage access for administrators, inspectors, and maintenance users.

## Technology Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Leaflet
* Chart.js

### Backend

* Python
* FastAPI
* YOLOv8
* OpenCV
* MongoDB
* ReportLab

## Project Structure

```text
Wayzo/
├── backend/
│   ├── app/
│   ├── ml/
│   │   └── weights/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Local Development

### 1. Backend

Open a terminal at the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configure your environment variables using `backend/.env.example`. Add your own local MongoDB connection and a secure JWT secret.

Start the backend:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend

Open another terminal at the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, typically `http://localhost:5173`.

Configure the frontend API environment variables using `frontend/.env.example`.

## AI Model

Wayzo uses YOLOv8 model weights for road damage detection. Ensure the required model file is present at the path configured by the backend.

Detection results are automated estimates and should be reviewed before making infrastructure maintenance decisions.

## Security

* Never commit real `.env` files, credentials, tokens, or database passwords.
* Use environment variables for deployment configuration.
* Configure production CORS to allow only trusted frontend origins.
* Use HTTPS for production deployments.

## Project Status

Wayzo is under development and being prepared for deployment. Features and deployment requirements should be verified in the target environment.

## License

No license has been specified yet.

````

### Step 2: Save the file

Press:

```text
Ctrl + S
````

### Step 3: Complete the Git merge

Return to PowerShell and run these commands **one at a time**:

```powershell
git add README.md
```

```powershell
git status
```

If Git no longer reports an unresolved conflict, run:

```powershell
git add .
git commit -m "Merge remote README and finalize Wayzo documentation"
```

### Step 4: Push to GitHub

```powershell
git push -u origin main
```

**If any command produces an error, stop and send me its output.** Don't force-push.
