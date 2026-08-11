import axios from "axios";

// Clean any trailing slash from the environment variable
const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
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
