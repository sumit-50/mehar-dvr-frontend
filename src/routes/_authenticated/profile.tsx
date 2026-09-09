import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, KeyRound, Loader2, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { changeMyPassword, getSessionInfo, removeMyAvatar, updateMyAvatar } from "@/lib/dvr.functions";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Mehar DVR" },
      { name: "description", content: "Manage your Mehar DVR profile photo, details and password." },
      { property: "og:title", content: "My Profile — Mehar DVR" },
      { property: "og:description", content: "Update your profile photo, name and change your password." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProfilePage,
});

function initials(name?: string | null): string {
  if (!name || !name.trim()) return "?";
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Center-crop + resize any image file to a small square JPEG data URL. */
async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => reject(new Error("Failed to process image"));
      img.src = src;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSessionInfo(),
  });

  // Also query PostgreSQL backend session info
  const { data: backendSession } = useQuery({
    queryKey: ["backend-session"],
    queryFn: async () => {
      try {
        const res = await apiFetch("/auth/session-info");
        if (res?.profile) {
          const finalName = res.profile.full_name || res.profile.name || "";
          if (finalName && finalName !== "Employee") {
            localStorage.setItem("dvr_user_name", finalName);
          }
          if (res.profile.employee_id) {
            localStorage.setItem("dvr_user_id", res.profile.employee_id);
          }
          if (res.profile.phone) {
            localStorage.setItem("dvr_user_phone", res.profile.phone);
          }
          if (res.profile.email) {
            localStorage.setItem("dvr_user_email", res.profile.email);
          }
          if (res.profile.avatar_url || res.avatarUrl) {
            localStorage.setItem("dvr_user_avatar", res.profile.avatar_url || res.avatarUrl);
          }
        }
        return res;
      } catch {
        return null;
      }
    },
    staleTime: 10000,
  });

  const localName = typeof window !== "undefined" ? localStorage.getItem("dvr_user_name") : null;
  const localEmail = typeof window !== "undefined" ? localStorage.getItem("dvr_user_email") : null;
  const localId = typeof window !== "undefined" ? localStorage.getItem("dvr_user_id") : null;
  const localPhone = typeof window !== "undefined" ? localStorage.getItem("dvr_user_phone") : null;
  const localRole = typeof window !== "undefined" ? localStorage.getItem("dvr_user_role") : null;
  const localAvatar = typeof window !== "undefined" ? localStorage.getItem("dvr_user_avatar") : null;

  const profile = backendSession?.profile || session?.profile || null;
  const rawEmpId = (profile?.employee_id || localId || "").trim().toUpperCase();
  const isAdmin = Boolean(
    session?.isAdmin || 
    backendSession?.isAdmin || 
    localRole === "admin" || 
    profile?.role === "admin" ||
    rawEmpId === "MEH000" || 
    rawEmpId === "MEH-ADM-001" ||
    (profile?.email && profile.email.toLowerCase().startsWith("admin"))
  );

  const rawDisplayName = profile?.full_name || profile?.name || localName || "";
  const displayName = rawDisplayName || (isAdmin ? "Yogendra (Admin)" : "Employee");

  const displayEmail = profile?.email || localEmail || "—";
  
  // Format creative Employee ID
  let displayEmpId = rawEmpId;
  if (!displayEmpId || displayEmpId === "MEH000" || displayEmpId === "MEH-ADM-001") {
    displayEmpId = isAdmin ? "MEHADM001" : "MEH101";
  }

  // Handle phone number cleanly - never display dummy or unadded numbers
  const rawPhone = (profile?.phone || localPhone || "").trim();
  const isInvalidPhone = !rawPhone || rawPhone === "9876543210" || rawPhone === "null" || rawPhone === "undefined" || rawPhone === "—";
  const displayPhone = isInvalidPhone ? null : (rawPhone.startsWith("+") ? rawPhone : `+91 ${rawPhone}`);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Synchronize localStorage when profile loads and clean up any dummy phone numbers
  useEffect(() => {
    // Clear dummy phone if cached in browser
    if (localStorage.getItem("dvr_user_phone") === "9876543210" || localStorage.getItem("dvr_user_phone") === "null") {
      localStorage.removeItem("dvr_user_phone");
    }

    if (session?.profile) {
      if (session.profile.name && session.profile.name !== "Employee") {
        localStorage.setItem("dvr_user_name", session.profile.name);
      }
      if (session.profile.email) {
        localStorage.setItem("dvr_user_email", session.profile.email);
      }
      if (session.profile.employee_id) {
        localStorage.setItem("dvr_user_id", session.profile.employee_id);
      }
      if (session.profile.phone && session.profile.phone !== "9876543210") {
        localStorage.setItem("dvr_user_phone", session.profile.phone);
      }
      if (session.avatarUrl || session.profile.avatar_url) {
        localStorage.setItem("dvr_user_avatar", (session.avatarUrl || session.profile.avatar_url)!);
      }
    }
  }, [session?.profile, session?.avatarUrl]);

  // Password update state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const currentSavedAvatar = backendSession?.profile?.avatar_url || backendSession?.avatarUrl || session?.avatarUrl || session?.profile?.avatar_url || localAvatar || null;
  const shownAvatar = preview ?? currentSavedAvatar;

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG or PNG)");
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setPreview(dataUrl);
    } catch {
      toast.error("Could not read this image — try another photo");
    }
  }

  async function handleSavePhoto() {
    if (!preview) return;
    setPhotoBusy(true);
    let updatedAny = false;
    let errorMsg = "";

    try {
      // 1. PostgreSQL backend endpoint
      try {
        const res = await apiFetch("/auth/avatar", {
          method: "POST",
          body: { photo: preview },
        });
        if (res?.success || res?.avatar_url) updatedAny = true;
      } catch (err: any) {
        console.warn("backend avatar endpoint notice:", err);
      }

      // 2. Server function backup
      try {
        await updateMyAvatar({ data: { photo: preview } });
        updatedAny = true;
      } catch (err: any) {
        console.warn("updateMyAvatar server fn notice:", err);
        if (!updatedAny) errorMsg = err instanceof Error ? err.message : "Photo upload failed";
      }

      if (updatedAny) {
        toast.success("Profile photo updated successfully!");
        localStorage.setItem("dvr_user_avatar", preview);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["session"] }),
          queryClient.invalidateQueries({ queryKey: ["backend-session"] }),
        ]);
      } else {
        toast.error(errorMsg || "Photo upload failed. Please try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoBusy(true);
    try {
      // 1. Backend REST endpoint
      try {
        await apiFetch("/auth/avatar", { method: "DELETE" });
      } catch (err) {
        console.warn("REST remove avatar notice:", err);
      }

      // 2. Server function backup
      try {
        await removeMyAvatar({});
      } catch (err) {
        console.warn("removeMyAvatar server fn notice:", err);
      }

      localStorage.removeItem("dvr_user_avatar");
      toast.success("Profile photo removed");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["backend-session"] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPwBusy(true);
    let updatedAny = false;
    let errorMsg = "";

    try {
      // 1. PostgreSQL backend endpoint
      try {
        const res = await apiFetch("/auth/change-password", {
          method: "POST",
          body: { password: newPassword },
        });
        if (res?.success) updatedAny = true;
      } catch (err: any) {
        console.warn("backend change-password endpoint notice:", err);
      }

      // 2. Server function backup
      try {
        await changeMyPassword({ data: { password: newPassword } });
        updatedAny = true;
      } catch (err: any) {
        console.warn("changeMyPassword server fn notice:", err);
      }

      if (updatedAny) {
        toast.success("Password changed successfully! Please use it on your next sign in.");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(errorMsg || "Failed to update password. Please check your connection.");
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile photo, details and account password.
        </p>
      </div>

      {/* Profile photo */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Camera className="h-4.5 w-4.5 text-primary" /> Profile photo
        </h2>
        <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {shownAvatar ? (
            <img
              src={shownAvatar}
              alt="Profile photo"
              className="h-24 w-24 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 ring-2 ring-border">
              {displayName ? (
                <span className="font-display text-2xl font-bold text-primary">
                  {initials(displayName)}
                </span>
              ) : (
                <UserRound className="h-10 w-10 text-primary" />
              )}
            </div>
          )}
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePick}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
              >
                <Camera className="mr-2 h-4 w-4" />
                {shownAvatar ? "Change photo" : "Add photo"}
              </Button>
              {preview && (
                <Button type="button" onClick={handleSavePhoto} disabled={photoBusy}>
                  {photoBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save photo
                </Button>
              )}
              {!preview && currentSavedAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRemovePhoto}
                  disabled={photoBusy}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {preview
                ? "Preview ready — tap Save photo to apply it."
                : "JPG or PNG, automatically cropped to a square."}
            </p>
          </div>
        </div>
      </section>

      {/* Account details (Read-Only) */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <UserRound className="h-4.5 w-4.5 text-primary" /> Account details
        </h2>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</dt>
            <dd className="mt-1 font-bold text-foreground text-base">{displayName}</dd>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee ID</dt>
            <dd className="mt-1 font-bold font-mono text-primary text-base">{displayEmpId}</dd>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</dt>
            <dd className="mt-1 font-medium text-foreground">{displayEmail}</dd>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</dt>
            <dd className="mt-1 font-medium text-foreground">
              {displayPhone ? (
                displayPhone
              ) : (
                <span className="text-muted-foreground italic font-normal text-xs">Not Provided</span>
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 sm:col-span-2">
            <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Role</dt>
            <dd className={`mt-1 inline-flex items-center gap-1.5 font-semibold ${
              isAdmin ? "text-purple-600 dark:text-purple-400" : "text-primary"
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                isAdmin ? "bg-purple-500" : "bg-emerald-500"
              }`} />
              {isAdmin ? "Administrator / Super Admin" : "Field Visiting Employee"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <KeyRound className="h-4.5 w-4.5 text-primary" /> Change password
        </h2>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat the new password"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={pwBusy || !newPassword || !confirmPassword}>
            {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
