import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  const raw = typeof err === "string" ? err : (err as any)?.message || JSON.stringify(err);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((p: any) => p?.message || p?.code || "Validation error")
        .filter(Boolean)
        .join(". ");
    }
    if (parsed && typeof parsed === "object" && parsed.message) {
      return parsed.message;
    }
  } catch {}
  return raw;
}
