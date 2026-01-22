export const apiBase =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8080" : "");

export const wsUrl =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? "ws://localhost:8080"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);
