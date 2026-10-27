import { api, BACKEND_BASE, API_BASE_URL, getAuthToken } from "./api";

export const detectionService = {
  /**
   * Check backend health and model loading state
   */
  async checkHealth() {
    try {
      const response = await fetch(`${BACKEND_BASE}/health`);
      return await response.json();
    } catch {
      return { status: "offline", model_cached: false };
    }
  },

  /**
   * Run YOLO image inference with GPS location
   * @param {File} file
   * @param {number|null} latitude
   * @param {number|null} longitude
   */
  async uploadImage(file, latitude = null, longitude = null) {
    const formData = new FormData();
    formData.append("file", file);
    if (latitude !== null && latitude !== undefined && !isNaN(latitude)) {
      formData.append("latitude", latitude.toString());
    }
    if (longitude !== null && longitude !== undefined && !isNaN(longitude)) {
      formData.append("longitude", longitude.toString());
    }

    return await api.post("/detect/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  /**
   * Run synchronous YOLO video inference (sampled frames)
   * @param {File} file
   * @param {number|null} latitude
   * @param {number|null} longitude
   */
  async uploadVideo(file, latitude = null, longitude = null) {
    const formData = new FormData();
    formData.append("file", file);
    if (latitude !== null && latitude !== undefined && !isNaN(latitude)) {
      formData.append("latitude", latitude.toString());
    }
    if (longitude !== null && longitude !== undefined && !isNaN(longitude)) {
      formData.append("longitude", longitude.toString());
    }

    return await api.post("/detect/video", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 180000,
    });
  },

  /**
   * Start an asynchronous background video inspection job
   * @param {File} file
   * @param {number|null} latitude
   * @param {number|null} longitude
   * @param {number|null} sampleIntervalSec
   */
  async startVideoJob(file, latitude = null, longitude = null, sampleIntervalSec = 1.0) {
    const formData = new FormData();
    formData.append("file", file);
    if (latitude !== null && latitude !== undefined && !isNaN(latitude)) {
      formData.append("latitude", latitude.toString());
    }
    if (longitude !== null && longitude !== undefined && !isNaN(longitude)) {
      formData.append("longitude", longitude.toString());
    }
    if (sampleIntervalSec) {
      formData.append("sample_interval_sec", sampleIntervalSec.toString());
    }

    return await api.post("/detect/video/start", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  /**
   * Poll current progress and status of a video inspection job
   * @param {string} jobId
   */
  async getVideoJobStatus(jobId) {
    return await api.get(`/detect/video/status/${jobId}`);
  },

  /**
   * Get all historical detections with optional pagination
   */
  async getDetections(limit = 50, skip = 0) {
    return await api.get("/detect/detections", {
      params: { limit, skip },
    });
  },

  /**
   * Get paginated inspection history envelope with metadata
   */
  async getHistory(limit = 20, skip = 0) {
    return await api.get("/detect/history", {
      params: { limit, skip },
    });
  },

  /**
   * Get validated geographic inspection records for GIS mapping
   * @param {Object} filters
   * @param {string} [filters.media_type="all"]
   * @param {string} [filters.severity="all"]
   * @param {string} [filters.category="all"]
   * @param {number} [filters.limit=200]
   */
  async getGeoInspections(filters = {}) {
    return await api.get("/detect/geo-inspections", {
      params: filters,
    });
  },

  /**
   * Get consolidated system statistics
   */
  async getStatistics() {
    return await api.get("/statistics");
  },

  /**
   * Get traffic surveillance cameras
   */
  async getCameras() {
    return await api.get("/cameras");
  },

  /**
   * Get active road hazard alerts
   */
  async getAlerts() {
    return await api.get("/alerts");
  },

  /**
   * Get logged maintenance tickets and work orders with filtering
   * @param {Object} params - { status, priority, category, team, limit, skip }
   */
  async getMaintenanceTickets(params = {}) {
    return await api.get("/maintenance", { params });
  },

  /**
   * Get live maintenance statistics and KPI aggregations
   */
  async getMaintenanceStatistics() {
    return await api.get("/maintenance/statistics");
  },

  /**
   * Get specific work order details by ID
   * @param {string} orderId
   */
  async getWorkOrder(orderId) {
    return await api.get(`/maintenance/${orderId}`);
  },

  /**
   * Create a new maintenance work order
   * @param {Object} workOrderData
   */
  async createWorkOrder(workOrderData) {
    return await api.post("/maintenance", workOrderData);
  },

  /**
   * Dedicated dispatch from an existing inspection
   * @param {string} inspectionId
   * @param {Object} overrides
   */
  async createWorkOrderFromInspection(inspectionId, overrides = {}) {
    return await api.post("/maintenance/from-inspection", {
      inspection_id: inspectionId,
      ...overrides
    });
  },

  /**
   * Update work order lifecycle status (Open -> Assigned -> In Progress -> Completed/Cancelled)
   * @param {string} orderId
   * @param {Object} statusData - { status, notes, actual_cost, completion_notes }
   */
  async updateWorkOrderStatus(orderId, statusData) {
    return await api.patch(`/maintenance/${orderId}/status`, statusData);
  },

  /**
   * Update work order assignments or details
   * @param {string} orderId
   * @param {Object} updateData - { priority, assigned_team, description, target_completion_date }
   */
  async updateWorkOrder(orderId, updateData) {
    return await api.patch(`/maintenance/${orderId}`, updateData);
  },

  /**
   * Backward-compatible alias for creating a maintenance ticket
   * @param {Object} ticketData
   */
  async createMaintenanceTicket(ticketData) {
    return await api.post("/maintenance", ticketData);
  },

  /**
   * Get nearby emergency hospitals sorted by GPS distance
   * @param {number} latitude
   * @param {number} longitude
   */
  async getNearbyHospitals(latitude = 28.6139, longitude = 77.2090) {
    return await api.get("/hospitals", {
      params: { latitude, longitude },
    });
  },

  /**
   * Helper to resolve uploaded media asset URL without query-string token exposure
   * @param {string} relativePath
   */
  getMediaUrl(relativePath) {
    if (!relativePath) return "";
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      return relativePath;
    }
    const cleanPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    return `${BACKEND_BASE}${cleanPath}`;
  },

  /**
   * Request an ephemeral, single-purpose 60-second media ticket
   */
  async getMediaTicket() {
    const res = await api.post("/media/ticket");
    return res.ticket;
  },

  /**
   * Resolve an authenticated stream URL using a short-lived 60-second media ticket
   * @param {string} relativePath
   */
  async getAuthenticatedStreamUrl(relativePath) {
    if (!relativePath) return "";
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      return relativePath;
    }
    const cleanPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    try {
      const ticket = await this.getMediaTicket();
      return `${BACKEND_BASE}${cleanPath}?ticket=${encodeURIComponent(ticket)}`;
    } catch (e) {
      console.warn("Could not retrieve media ticket, falling back to base media URL:", e);
      return `${BACKEND_BASE}${cleanPath}`;
    }
  },

  /**
   * Download a professional PDF inspection report with authentication
   * @param {string} detectionId
   */
  async downloadInspectionReport(detectionId) {
    const blobData = await api.get(`/reports/inspection/${detectionId}`, {
      responseType: "blob",
    });
    const blob = new Blob([blobData], { type: "application/pdf" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", `Wayzo-Report-${detectionId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Download an executive summary PDF report with optional date range and authentication
   * @param {string|null} startDate
   * @param {string|null} endDate
   */
  async downloadSummaryReport(startDate = null, endDate = null) {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const blobData = await api.get("/reports/summary", {
      params,
      responseType: "blob",
    });
    const blob = new Blob([blobData], { type: "application/pdf" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    const dateLabel =
      startDate || endDate
        ? `${startDate || "All"}-${endDate || "Latest"}`
        : "Global";
    link.setAttribute("download", `Wayzo-Summary-Report-${dateLabel}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Authentication & User Management API Methods
   */
  async login(email, password) {
    return await api.post("/auth/login", { email, password });
  },

  async getCurrentUser() {
    return await api.get("/auth/me");
  },

  async getUsers() {
    return await api.get("/auth/users");
  },

  async createUser(userData) {
    return await api.post("/auth/users", userData);
  },

  async updateUser(userId, userData) {
    return await api.patch(`/auth/users/${userId}`, userData);
  },

  async deleteUser(userId) {
    return await api.delete(`/auth/users/${userId}`);
  },
};

export default detectionService;
