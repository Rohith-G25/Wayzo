import axios from "axios";

// Normalize environment variables with defaults
const RAW_BACKEND = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
export const BACKEND_BASE = RAW_BACKEND.replace(/\/+$/, "");

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `${BACKEND_BASE}/api/v1`;

export const getAuthToken = () => {
  return localStorage.getItem("wayzo_access_token") || null;
};

export const getRefreshToken = () => {
  return localStorage.getItem("wayzo_refresh_token") || null;
};

export const setAuthSession = (accessToken, refreshToken, user) => {
  if (accessToken) localStorage.setItem("wayzo_access_token", accessToken);
  if (refreshToken) localStorage.setItem("wayzo_refresh_token", refreshToken);
  if (user) localStorage.setItem("wayzo_user", JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem("wayzo_access_token");
  localStorage.removeItem("wayzo_refresh_token");
  localStorage.removeItem("wayzo_user");
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    "Accept": "application/json",
  },
});

// Request interceptor: Attach Bearer Authorization header
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 and auto-refresh tokens
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized for requests other than login/refresh
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearAuthSession();
        window.dispatchEvent(new CustomEvent("wayzo:auth-expired"));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token: new_refresh, user } = refreshResponse.data;
        setAuthSession(access_token, new_refresh, user);

        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null, access_token);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthSession();
        window.dispatchEvent(new CustomEvent("wayzo:auth-expired"));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const formattedError = {
      message:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "An unexpected network error occurred",
      status: error.response?.status || null,
      data: error.response?.data || null,
    };
    console.warn("[API Response Error]", formattedError);
    return Promise.reject(formattedError);
  }
);

export default api;
