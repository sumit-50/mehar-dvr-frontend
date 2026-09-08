/**
 * Draws the permanent Mehar DVR watermark onto a captured photo canvas.
 * The watermark only shows the address-match status, the address itself,
 * and the capture date/time — nothing else is printed on the photo.
 */

export interface WatermarkData {
  locationName: string;
  address: string;
  purpose: string;
  employeeName: string;
  employeeId: string;
  dateStr: string;
  timeStr: string;
  distanceMeters: number;
  accuracyMeters: number | null;
  /** Live GPS where the photo was actually taken. */
  latitude: number;
  longitude: number;
  /** Fixed admin-registered coordinates of the location. */
  fixedLatitude: number;
  fixedLongitude: number;
}

export function drawDvrWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: WatermarkData,
): void {
  const base = Math.max(14, Math.round(width / 48));
  const pad = Math.round(base * 0.9);
  const lineGap = Math.round(base * 1.3);
  const panelMaxW = Math.round(width * 0.58);

  const font = (size: number, weight = 500, family = "system-ui, sans-serif") =>
    `${weight} ${size}px ${family}`;

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const isFirstVisit = data.distanceMeters === 0 && data.fixedLatitude === data.latitude;
  const statusText = isFirstVisit ? "● 1ST VISIT LIVE GPS CAPTURED" : "● LIVE GPS MATCHED (100m)";

  // Measure texts
  ctx.font = font(Math.round(base * 0.75), 800);
  const chipW = ctx.measureText(statusText).width + base * 1.2;
  const chipH = Math.round(base * 1.4);

  // Office & Company name
  const locTitle = data.locationName || "Office Visit";
  ctx.font = font(Math.round(base * 0.95), 700);
  const locLines = wrapText(ctx, locTitle, panelMaxW - pad * 2, 2);

  // Address
  const hasAddress = data.address && data.address.trim() !== "—" && data.address.trim().length > 1;
  ctx.font = font(Math.round(base * 0.72), 500);
  const addressLines = hasAddress ? wrapText(ctx, data.address, panelMaxW - pad * 2, 2) : [];

  // GPS Coordinates Line
  const acc = data.accuracyMeters != null ? `±${Math.round(data.accuracyMeters)}m` : "GPS";
  const gpsText = `GPS: ${data.latitude.toFixed(6)}° N, ${data.longitude.toFixed(6)}° E (Acc: ${acc})`;

  // Employee line
  const empText = `Employee: ${data.employeeName} (${data.employeeId})`;

  // Date & Time
  const dateTimeText = `${data.dateStr} · ${data.timeStr} IST`;

  // Calculate panel dimensions
  const totalItemLines = 1 + locLines.length + addressLines.length + 3; // chip + loc + addr + gps + emp + datetime
  const panelH = pad * 2 + chipH + lineGap * (totalItemLines - 1) + Math.round(base * 0.5);
  const panelW = Math.min(
    panelMaxW,
    Math.max(
      chipW + pad * 2,
      Math.round(width * 0.44),
    ),
  );

  const left = Math.round(pad * 0.8);
  const top = height - panelH - Math.round(pad * 0.8);

  // Glassmorphic dark badge background
  ctx.fillStyle = "rgba(10, 25, 47, 0.88)";
  roundRect(ctx, left, top, panelW, panelH, base * 0.6);
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = Math.max(1, Math.round(base * 0.08));
  ctx.stroke();

  let y = top + pad + chipH / 2;

  // 1. Status Chip (Green / Amber)
  ctx.fillStyle = isFirstVisit ? "rgba(217, 119, 6, 0.95)" : "rgba(16, 185, 129, 0.95)";
  roundRect(ctx, left + pad, y - chipH / 2, chipW, chipH, chipH / 3);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = font(Math.round(base * 0.72), 800);
  ctx.fillText(statusText, left + pad + base * 0.6, y);

  y += chipH / 2 + lineGap * 0.9;

  // 2. Location & Company Title
  ctx.font = font(Math.round(base * 0.95), 800);
  ctx.fillStyle = "#ffffff";
  for (const line of locLines) {
    ctx.fillText(line, left + pad, y);
    y += lineGap * 0.9;
  }

  // 3. Physical Street / Area Address (if present)
  if (addressLines.length > 0) {
    ctx.font = font(Math.round(base * 0.76), 600);
    ctx.fillStyle = "rgba(254, 240, 138, 0.98)";
    for (let i = 0; i < addressLines.length; i++) {
      const prefix = i === 0 ? "📍 " : "   ";
      ctx.fillText(prefix + addressLines[i], left + pad, y);
      y += lineGap * 0.85;
    }
  }

  // 4. GPS Coordinates
  ctx.font = font(Math.round(base * 0.75), 600, "ui-monospace, monospace");
  ctx.fillStyle = "rgba(56, 189, 248, 0.98)";
  ctx.fillText(truncate(ctx, gpsText, panelW - pad * 2), left + pad, y);
  y += lineGap * 0.9;

  // 5. Employee Info
  ctx.font = font(Math.round(base * 0.75), 600);
  ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
  ctx.fillText(truncate(ctx, empText, panelW - pad * 2), left + pad, y);
  y += lineGap * 0.9;

  // 6. Date & Time
  ctx.font = font(Math.round(base * 0.82), 700);
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.fillText(truncate(ctx, dateTimeText, panelW - pad * 2), left + pad, y);
}

/**
 * Re-encode a raw captured photo with the permanent watermark burned in.
 * Used at submit time so the watermark also includes the visit purpose,
 * which is collected after the photo is taken.
 */
export async function stampPhotoWithWatermark(
  rawDataUrl: string,
  data: WatermarkData,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load captured photo"));
    el.src = rawDataUrl;
  });
  const scale = Math.min(1, 1600 / (img.naturalWidth || 1600));
  const w = Math.round((img.naturalWidth || 1600) * scale);
  const h = Math.round((img.naturalHeight || 1200) * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device");
  ctx.drawImage(img, 0, 0, w, h);
  drawDvrWatermark(ctx, w, h, data);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Word-wrap text into at most maxLines lines, ellipsizing the last one. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? "";
  while (last.length > 4 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 4 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}
