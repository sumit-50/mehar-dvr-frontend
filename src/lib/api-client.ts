const DEFAULT_API_BASE = "https://ri3m0h5s1onu9d995upymqcx.187.77.187.120.sslip.io/api";
const API_BASE = (import.meta as any).env?.["VITE_API_URL"] || DEFAULT_API_BASE;

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

  let base = API_BASE;
  // Automatically upgrade to HTTPS if current page is loaded over HTTPS to prevent mixed content blocking
  if (typeof window !== "undefined" && window.location.protocol === "https:" && base.startsWith("http://")) {
    base = base.replace(/^http:\/\//i, "https://");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;
  
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
