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
import { cn } from "@/lib/utils";

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
    <div className="mx-auto max-w-2xl space-y-3.5 sm:space-y-4 animate-fade-up">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-[10px] sm:text-[11px] font-bold mb-1">
          <UserRound className="h-3 w-3 text-sky-600 shrink-0" />
          <span>Account Settings</span>
        </div>
        <h1 className="font-display text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
          My Profile
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
          Update your profile photo, details and account password.
        </p>
      </div>

      {/* Profile photo */}
      <section className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-5 shadow-xs backdrop-blur-md space-y-3">
        <h2 className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-extrabold text-slate-900">
          <Camera className="h-4 w-4 text-sky-600" />
          <span>Profile Photo</span>
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-4">
          {shownAvatar ? (
            <img
              src={shownAvatar}
              alt="Profile photo"
              className="h-20 w-20 sm:h-22 sm:w-22 rounded-full object-cover ring-2 ring-sky-200 shadow-xs shrink-0"
            />
          ) : (
            <div className="flex h-20 w-20 sm:h-22 sm:w-22 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
              <span className="font-display text-xl sm:text-2xl font-black tracking-tight">
                {initials(displayName)}
              </span>
            </div>
          )}
          <div className="space-y-2 flex-1 min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePick}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200"
              >
                <Camera className="mr-1.5 h-3.5 w-3.5 text-sky-600" />
                {shownAvatar ? "Change Photo" : "Add Photo"}
              </Button>
              {preview && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSavePhoto}
                  disabled={photoBusy}
                  className="h-8 px-3 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-xs"
                >
                  {photoBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save Photo
                </Button>
              )}
              {!preview && currentSavedAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl"
                  onClick={handleRemovePhoto}
                  disabled={photoBusy}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
            <p className="text-[10.5px] sm:text-xs text-slate-500">
              {preview
                ? "Preview ready — tap Save Photo to update."
                : "JPG or PNG, automatically cropped to a square."}
            </p>
          </div>
        </div>
      </section>

      {/* Account details (Read-Only) */}
      <section className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-5 shadow-xs backdrop-blur-md space-y-3">
        <h2 className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-extrabold text-slate-900">
          <UserRound className="h-4 w-4 text-sky-600" />
          <span>Account Details</span>
        </h2>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</span>
            <p className="mt-0.5 font-bold text-slate-900 text-xs sm:text-sm truncate">{displayName}</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</span>
            <div className="mt-0.5">
              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 text-xs inline-block">
                {displayEmpId}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
            <p className="mt-0.5 font-medium text-slate-800 truncate">{displayEmail}</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</span>
            <p className="mt-0.5 font-medium text-slate-800">
              {displayPhone ? (
                displayPhone
              ) : (
                <span className="text-slate-400 italic font-normal text-xs">Not Provided</span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:col-span-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Role</span>
            <div className="mt-1 flex items-center gap-1.5 font-bold text-xs">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isAdmin ? "bg-purple-500" : "bg-emerald-500",
                )}
              />
              <span className={isAdmin ? "text-purple-700" : "text-emerald-700"}>
                {isAdmin ? "Super Admin" : "Field Visiting Employee"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 sm:p-5 shadow-xs backdrop-blur-md space-y-3">
        <h2 className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-extrabold text-slate-900">
          <KeyRound className="h-4 w-4 text-sky-600" />
          <span>Change Password</span>
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-password" className="text-[11px] sm:text-xs font-bold text-slate-700">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pr-9 h-8.5 text-xs bg-slate-50/60 border-slate-200 rounded-xl"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-password" className="text-[11px] sm:text-xs font-bold text-slate-700">
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat the new password"
              className="h-8.5 text-xs bg-slate-50/60 border-slate-200 rounded-xl"
              autoComplete="new-password"
            />
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={pwBusy || !newPassword || !confirmPassword}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-xs"
            >
              {pwBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Update Password
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
