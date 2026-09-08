import React, { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/mehar-logo.png.asset.json";

const logoUrl = logoAsset.url;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS device (Safari does not support beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      setIsInstallable(true);
    }

    // Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<"accepted" | "dismissed" | "ios_guide"> => {
    if (isIOS) {
      return "ios_guide";
    }

    if (!deferredPrompt) {
      return "dismissed";
    }

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    triggerInstall,
  };
}

export function PWAInstallPrompt({ className }: { className?: string }) {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem("dvr_pwa_banner_dismissed") === "true";
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  if (isInstalled || !isInstallable || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    const outcome = await triggerInstall();
    if (outcome === "ios_guide") {
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("dvr_pwa_banner_dismissed", "true");
    } catch {}
  };

  return (
    <>
      {/* Floating Bottom PWA Banner */}
      <aside
        aria-label="Install App Banner"
        className={cn(
          "fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-primary/30 bg-slate-950/95 p-3.5 text-white shadow-2xl backdrop-blur-md transition-all sm:bottom-6 sm:right-6 sm:left-auto sm:w-[380px] animate-in slide-in-from-bottom-5 duration-300",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={logoUrl}
              alt="Mehar DVR"
              className="h-10 w-10 rounded-xl bg-white object-contain p-1 ring-1 ring-white/20 shadow-md"
            />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold">
              ✓
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white">
              Install Mehar DVR App
              <span className="rounded-full bg-primary/20 text-primary-foreground border border-primary/30 px-1.5 py-0.2 text-[9px] font-mono">
                PWA
              </span>
            </h4>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              Instant access, camera watermarking & offline GPS logs
            </p>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 h-8.5 shadow-md shadow-primary/25 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            {isIOS ? "Add to iPhone Home Screen" : "Install Android / iOS App"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="rounded-xl text-slate-400 hover:text-white text-xs h-8.5 px-3"
          >
            Later
          </Button>
        </div>
      </aside>

      {/* iOS Safari Guided Add-to-Home-Screen Dialog */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm rounded-3xl p-6 bg-slate-950 text-white border-slate-800 shadow-2xl">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 ring-4 ring-primary/5">
              <Smartphone className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-base font-bold text-white">
              Install Mehar DVR on iOS
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 mt-1">
              Follow these simple 2 steps in Safari to add the app to your iPhone or iPad:
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-3 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/20 font-bold text-primary text-xs">
                1
              </div>
              <p className="text-slate-200 leading-relaxed">
                Tap the <strong className="text-white font-semibold">Share</strong> button{" "}
                <Share className="inline h-4 w-4 text-sky-400 align-text-bottom mx-0.5" /> in the Safari toolbar (bottom or top).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/20 font-bold text-primary text-xs">
                2
              </div>
              <p className="text-slate-200 leading-relaxed">
                Scroll down and tap{" "}
                <strong className="text-white font-semibold">Add to Home Screen</strong>{" "}
                <PlusSquare className="inline h-4 w-4 text-emerald-400 align-text-bottom mx-0.5" />.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowIOSModal(false)}
            className="w-full rounded-xl bg-primary text-primary-foreground font-bold text-xs h-10"
          >
            Got it, thanks!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
