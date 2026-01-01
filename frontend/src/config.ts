declare global {
  interface Window {
    _env_?: {
      VITE_API_URL?: string
    }
  }
}

export const config = {
  API_URL: window._env_?.VITE_API_URL || import.meta.env.VITE_API_URL || "http://localhost:8000",
}