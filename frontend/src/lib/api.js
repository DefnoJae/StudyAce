import axios from "axios";

// Production builds must receive the deployed backend URL from Vercel.
// Local development can continue to use the backend on port 8000.
const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL?.trim();
const rawBackendUrl =
  configuredBackendUrl ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

if (!rawBackendUrl || rawBackendUrl.includes("your-render-backend-url")) {
  throw new Error(
    "REACT_APP_BACKEND_URL must be set to the deployed backend URL for production builds."
  );
}

const BACKEND_URL = rawBackendUrl.replace(/\/+$/, "");

// Standardize base URL so endpoints only need /auth/register, /auth/me, etc.
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Add a request interceptor to log the full URL being called (helps with debugging)
api.interceptors.request.use((config) => {
  console.log(`[API] ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
