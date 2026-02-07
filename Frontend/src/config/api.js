// Centralized API configuration
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default API_URL;

// Helper to build API URLs
export function apiUrl(path) {
  return `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
}

// Helper to build upload URLs with cache busting
export function uploadUrl(filename, bustCache = false) {
  const base = `${API_URL}/uploads/${filename}`;
  return bustCache ? `${base}?t=${Date.now()}` : base;
}
