import { useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CameraLiveInfo {
  locationName: string;
  address?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  isFirstVisit?: boolean | undefined;
  /** Live distance from the fixed location, meters (null until GPS fix). */
  distanceMeters: number | null;
  accuracyMeters: number | null;
  hasFix: boolean;
  /** Why the shutter is locked right now; null = photo can be captured. */
  blockReason: string | null;
}

interface CameraCaptureProps {
  live: CameraLiveInfo;
  onCaptured: (blob: Blob, dataUrl: string) => void;
  onClose: () => void;
}

export function CameraCapture({ live, onCaptured, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [now, setNow] = useState(() => new Date());

  // Live ticking clock for the on-screen details overlay
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function open() {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Browser blocks live camera over plain HTTP. Tap below to capture with phone camera app.");
        return;
      }
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) setError("Live camera streaming blocked or unavailable. Tap below to use your phone camera app.");
      }
    }
    open();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  function capture() {
    if (live.blockReason) return; // hard gate — location must match
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, 1600 / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Raw capture — the permanent watermark is burned in at submit time
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          onCaptured(blob, dataUrl);
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  const matched = !live.blockReason && live.hasFix;
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const hasAddress = live.address && live.address.trim() !== "—" && live.address.trim().length > 1;

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        onCaptured(file, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-white/90 truncate max-w-[80vw]">Live Camera — {live.locationName}</p>
        <button onClick={onClose} aria-label="Close camera" className="rounded-full bg-white/10 p-2 text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-sm text-white/80">
            <p className="max-w-xs text-xs text-white/70">{error}</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg active:scale-95">
              <Camera className="h-5 w-5" />
              <span>Take Photo with Camera App</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}

        {/* Live corner overlay — bottom-left */}
        {!error && (
          <div className="pointer-events-none absolute bottom-24 left-3 max-w-[70%] rounded-xl border border-sky-400/30 bg-slate-950/80 p-2.5 text-white backdrop-blur-md shadow-2xl space-y-1">
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide",
                matched
                  ? live.isFirstVisit
                    ? "bg-amber-500/30 text-amber-300 border border-amber-400/40"
                    : "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                  : live.hasFix
                    ? "bg-red-500/30 text-red-300 border border-red-400/40"
                    : "bg-amber-500/30 text-amber-300 border border-amber-400/40",
              )}
            >
              {matched
                ? live.isFirstVisit
                  ? "● 1ST VISIT LIVE GPS"
                  : "● LIVE GPS MATCHED (100m)"
                : live.hasFix
                  ? "● LOCATION MISMATCH"
                  : "● ACQUIRING GPS SIGNAL"}
            </span>

            <p className="line-clamp-1 text-xs font-bold text-white">
              {live.locationName}
            </p>

            {hasAddress && (
              <p className="line-clamp-1 text-[10px] text-slate-300">
                {live.address}
              </p>
            )}

            {live.latitude != null && live.longitude != null && (
              <p className="font-mono text-[10px] text-sky-300">
                GPS: {live.latitude.toFixed(6)}° N, {live.longitude.toFixed(6)}° E (±{Math.round(live.accuracyMeters ?? 0)}m)
              </p>
            )}

            <p className="text-[10px] font-semibold text-white/90">
              {dateStr} · {timeStr} IST
            </p>
          </div>
        )}
      </div>

      {/* Shutter lock status */}
      <div className="px-4 pt-3 text-center">
        {error ? null : live.blockReason ? (
          <p className="text-xs font-semibold text-red-300">{live.blockReason} — photo locked</p>
        ) : (
          <p className="text-xs font-semibold text-emerald-300">
            {live.isFirstVisit ? "Live GPS pinpointed — ready to capture 1st visit proof" : "Live GPS matched within 100m — ready to capture photo"}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 px-4 pb-6 pt-3">
        <button
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label="Switch camera"
          className="rounded-full bg-white/10 p-3 text-white"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
        <button
          onClick={capture}
          disabled={!!error || !!live.blockReason}
          aria-label="Capture photo"
          className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-primary p-1 text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:saturate-50"
        >
          <Camera className="h-7 w-7" />
        </button>
        <div className="w-11" />
      </div>
    </div>
  );
}
