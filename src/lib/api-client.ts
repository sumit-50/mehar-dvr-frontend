const API_BASE = (import.meta as any).env?.["VITE_API_URL"] || "http://localhost:5000/api";

export async function apiFetch<T = any>(
  path: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("dvr_token") || localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  
  const init: RequestInit = {
    method: options.method || (options.body ? "POST" : "GET"),
    headers,
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}
