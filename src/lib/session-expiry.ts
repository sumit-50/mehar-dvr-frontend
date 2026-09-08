import { toast } from "sonner";

/**
 * Detects errors caused by an expired / invalid login session
 * (401 from a protected server function, expired JWT).
 */
export function isAuthError(error: unknown): boolean {
  if (error == null) return false;
  const anyErr = error as { status?: number; statusCode?: number; message?: unknown };
  if (anyErr.status === 401 || anyErr.statusCode === 401) return true;
  const msg = String(anyErr.message ?? error).toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("bad_jwt") ||
    msg.includes("session expired") ||
    (msg.includes("401") && msg.includes("auth"))
  );
}

let recovering = false;

export interface SessionRecoveryActions {
  navigate: (to: string) => void;
  /** Refresh router + query data after a successful silent token refresh. */
  invalidate?: () => void;
}

/**
 * Auto-correct an expired session:
 * Redirects to /auth cleanly if user token is missing or expired.
 */
export async function recoverFromExpiredSession(actions: SessionRecoveryActions): Promise<void> {
  if (recovering) return;

  // If user is authenticated via local token/session, do not kick out
  if (typeof window !== "undefined") {
    const isLocalAuth =
      localStorage.getItem("dvr_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("mehar_alive");

    if (isLocalAuth) {
      actions.invalidate?.();
      return;
    }
  }

  recovering = true;
  try {
    actions.navigate("/auth");
  } finally {
    setTimeout(() => {
      recovering = false;
    }, 3000);
  }
}
