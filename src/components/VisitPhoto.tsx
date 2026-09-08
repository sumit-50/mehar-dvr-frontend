import { useState, useEffect } from "react";
import { CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisitPhotoProps {
  src?: string | null | undefined;
  alt: string;
  className?: string;
}

export function VisitPhoto({ src, alt, className }: VisitPhotoProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isInvalid = !src || src === "data:image/jpeg;base64,placeholder" || hasError;

  if (isInvalid) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-1.5 bg-muted/80 text-xs text-muted-foreground select-none border border-border/40",
          className,
        )}
        title="No photo available"
      >
        <CameraOff className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        <span className="text-[11px] font-medium">No photo</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn("object-cover", className)}
    />
  );
}
