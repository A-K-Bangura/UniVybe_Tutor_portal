const raw = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
export const apiUrl = typeof raw === "string" ? raw.replace(/\/+$/, "") : "";
export const configError =
  !apiUrl ||
  !/^https?:\/\/[^/]+.*\/api\/v1$/.test(apiUrl) ||
  (import.meta.env.PROD &&
    !/^https:/.test(apiUrl) &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname))
    ? "Set VITE_API_URL to the complete API root ending in /api/v1."
    : null;
