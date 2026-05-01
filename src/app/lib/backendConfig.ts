/** База API без завершающего слэша (пути вида `${API_BASE_URL}/cdek/cities`). */
export const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || "/api",
).replace(/\/+$/, "");
