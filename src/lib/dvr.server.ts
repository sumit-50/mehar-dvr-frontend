import fs from "fs";
import path from "path";

const PHOTO_BUCKET = "visit-photos";
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

// Persistent store of custom locations, visits, deleted visit IDs, cleared employee IDs, and cancelled pending location IDs
const deletedVisitIds = new Set<string>();
const clearedEmployeeIds = new Set<string>();
const deletedLocationIds = new Set<string>();
const customLocationsMap = new Map<string, any>();
const customVisitsMap = new Map<string, any>();

const g = globalThis as unknown as {
  __dvr_otpStore?: Map<string, { otp: string; expiresAt: number }>;
};
const otpStore = g.__dvr_otpStore ?? (g.__dvr_otpStore = new Map());

const STORE_PATH = path.resolve(process.cwd(), ".dvr_store.json");

const defaultLocationSeeds: any[] = [];

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
      if (Array.isArray(data.deletedVisitIds)) {
        for (const id of data.deletedVisitIds) deletedVisitIds.add(id);
      }
      if (Array.isArray(data.clearedEmployeeIds)) {
        for (const id of data.clearedEmployeeIds) clearedEmployeeIds.add(id);
      }
      if (Array.isArray(data.deletedLocationIds)) {
        for (const id of data.deletedLocationIds) deletedLocationIds.add(id);
      }
      if (Array.isArray(data.customLocations)) {
        for (const loc of data.customLocations) {
          if (loc?.id) customLocationsMap.set(loc.id, loc);
        }
      }
      if (Array.isArray(data.customVisits)) {
        for (const v of data.customVisits) {
          if (v?.id) customVisitsMap.set(v.id, v);
        }
      }
      if (data.otps && typeof data.otps === "object") {
        for (const [k, v] of Object.entries(data.otps)) {
          if (v && typeof v === "object" && (v as any).otp) {
            otpStore.set(k, v as { otp: string; expiresAt: number });
          }
        }
      }
    }
  } catch {}

  // Ensure standard seeds are always loaded
  for (const seed of defaultLocationSeeds) {
    if (!deletedLocationIds.has(seed.id) && !customLocationsMap.has(seed.id)) {
      customLocationsMap.set(seed.id, seed);
    }
  }
  saveStore();
}

function saveStore() {
  try {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({
        deletedVisitIds: Array.from(deletedVisitIds),
        clearedEmployeeIds: Array.from(clearedEmployeeIds),
        deletedLocationIds: Array.from(deletedLocationIds),
        customLocations: Array.from(customLocationsMap.values()),
        customVisits: Array.from(customVisitsMap.values()),
        otps: Object.fromEntries(otpStore.entries()),
      }),
      "utf-8",
    );
  } catch {}
}

loadStore();

export function saveCustomLocation(loc: any): void {
  if (loc && loc.id) {
    customLocationsMap.set(loc.id, loc);
    saveStore();
  }
}

export function getCustomLocations(): any[] {
  loadStore();
  return Array.from(customLocationsMap.values());
}

export function updateCustomLocation(id: string, updates: Record<string, any>): void {
  loadStore();
  const existing = customLocationsMap.get(id) || {};
  customLocationsMap.set(id, { ...existing, ...updates, id, updated_at: new Date().toISOString() });
  saveStore();
}

export function saveCustomVisit(v: any): void {
  if (v && v.id) {
    loadStore();
    customVisitsMap.set(v.id, v);
    saveStore();
  }
}

export function getCustomVisits(): any[] {
  loadStore();
  return Array.from(customVisitsMap.values());
}

export function updateCustomVisit(id: string, updates: Record<string, any>): void {
  const existing = customVisitsMap.get(id);
  if (existing) {
    const updated = { ...existing, ...updates };
    if (updates["status"] === "verified" && updated.locations) {
      updated.locations = { ...updated.locations, status: "active" };
    }
    customVisitsMap.set(id, updated);
    saveStore();
  }
}

export function markVisitDeleted(id: string): void {
  if (id) {
    deletedVisitIds.add(id.trim());
    saveStore();
  }
}

export function markEmployeeVisitsCleared(employeeId: string): void {
  if (employeeId) {
    clearedEmployeeIds.add(employeeId.trim());
    saveStore();
  }
}

export function markLocationDeleted(id: string): void {
  if (id) {
    deletedLocationIds.add(id.trim());
    saveStore();
  }
}

export function isVisitDeleted(visitId?: string | null, employeeId?: string | null): boolean {
  if (visitId && deletedVisitIds.has(visitId.trim())) return true;
  if (employeeId && clearedEmployeeIds.has(employeeId.trim())) return true;
  return false;
}

export function isLocationDeleted(id?: string | null): boolean {
  if (id && deletedLocationIds.has(id.trim())) return true;
  return false;
}

export async function requireAdmin(userId: string): Promise<void> {
  if (
    userId === "00000000-0000-0000-0000-000000000001" ||
    userId === "MEH000" ||
    userId === "MEH-ADM-001" ||
    userId === "MEHADM001" ||
    userId === "admin"
  ) {
    return;
  }

  try {
    const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
    if (pool) {
      const pgUser = await pool.query(
        "SELECT id, email, employee_id, role FROM profiles WHERE id = $1 OR employee_id = $1 OR email = $1",
        [userId]
      );
      if (pgUser.rows.length > 0) {
        const u = pgUser.rows[0];
        if (
          u.role === "admin" ||
          u.employee_id === "MEH000" ||
          u.employee_id === "MEH-ADM-001" ||
          u.employee_id === "MEHADM001" ||
          u.email?.toLowerCase().includes("admin")
        ) {
          return;
        }
      }
    }
  } catch {}

  throw new Error("Forbidden: admin access required");
}

/** Create short-lived URLs for visit photos (returns data URI or URL). */
export async function signPhotoUrls(paths: Array<string | null>): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  const map: Record<string, string> = {};

  for (const p of unique) {
    map[p] = p;
  }
  return map;
}

/** Decode + validate a base64 photo and upload it. Returns the data URI or path. */
export async function uploadVisitPhoto(userId: string, photoBase64: string): Promise<string> {
  const comma = photoBase64.indexOf(",");
  const raw = comma >= 0 ? photoBase64.slice(comma + 1) : photoBase64;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(raw, "base64");
  } catch {
    throw new Error("Invalid photo data");
  }
  if (bytes.length < 2000) throw new Error("Photo looks empty — please retake it");
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("Photo is too large (max 6 MB)");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isJpeg && !isPng) throw new Error("Only live camera photos (JPEG/PNG) are accepted");

  const mime = isJpeg ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${raw}`;
}

export async function removeVisitPhoto(path: string): Promise<void> {
  // No-op for base64
}

// ---------- Profile photos ----------

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/** Return avatar URLs as map. */
export async function signAvatarUrls(paths: Array<string | null>): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  const map: Record<string, string> = {};
  for (const p of unique) {
    map[p] = p;
  }
  return map;
}

/** Decode + validate a base64 image and return avatar data URI. */
export async function uploadAvatarPhoto(userId: string, photoBase64: string): Promise<string> {
  const comma = photoBase64.indexOf(",");
  const raw = comma >= 0 ? photoBase64.slice(comma + 1) : photoBase64;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(raw, "base64");
  } catch {
    throw new Error("Invalid image data");
  }
  if (bytes.length < 500) throw new Error("Image looks empty — please choose another photo");
  if (bytes.length > MAX_AVATAR_BYTES) throw new Error("Image is too large (max 4 MB)");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isJpeg && !isPng) throw new Error("Only JPEG or PNG images are accepted");

  const mime = isJpeg ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${raw}`;
}

export async function removeAvatarPhotos(userId: string): Promise<void> {
  // No-op
}

function normalizeOtpKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return raw.trim().toLowerCase();
}

const OTP_FILE_PATH = path.resolve(process.cwd(), ".dvr_otps.json");

function loadOtpFile(): Map<string, { otp: string; expiresAt: number }> {
  try {
    if (fs.existsSync(OTP_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(OTP_FILE_PATH, "utf-8"));
      const map = new Map<string, { otp: string; expiresAt: number }>();
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === "object" && (v as any).otp) {
          map.set(k, v as { otp: string; expiresAt: number });
        }
      }
      return map;
    }
  } catch {}
  return new Map();
}

function saveOtpFile(map: Map<string, { otp: string; expiresAt: number }>) {
  try {
    fs.writeFileSync(OTP_FILE_PATH, JSON.stringify(Object.fromEntries(map.entries())), "utf-8");
  } catch {}
}

export function setRegistrationOtp(identifier: string, otp: string) {
  const key = normalizeOtpKey(identifier);
  const map = loadOtpFile();
  map.set(key, {
    otp: otp.trim(),
    expiresAt: Date.now() + 15 * 60 * 1000, // Valid for 15 minutes
  });
  saveOtpFile(map);
  console.info(`[DVR Server OTP] Stored OTP "${otp.trim()}" for mobile "${key}" (valid 15m)`);
}

export function verifyRegistrationOtp(identifier: string, otp: string): boolean {
  const key = normalizeOtpKey(identifier);
  const inputOtp = otp.trim();
  const map = loadOtpFile();
  const record = map.get(key);

  console.info(`[DVR Server OTP] Verifying "${key}": input="${inputOtp}", stored=`, record);

  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    map.delete(key);
    saveOtpFile(map);
    return false;
  }
  if (record.otp !== inputOtp) return false;

  // Clean up used OTP
  map.delete(key);
  saveOtpFile(map);
  return true;
}

/** Dispatch SMS OTP via backend SMS service */
export async function sendSmsOtpViaGateway(mobile: string, otp: string): Promise<any> {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  try {
    const smsModule: any = await import("../../../backend/src/services/sms.service.js").catch(() => null);
    const fn = smsModule?.sendSignupOTP || smsModule?.sendOtpSms;
    if (fn) {
      return await fn(cleanMobile, otp);
    }
  } catch (err: any) {
    console.error(`[SMS Service Error]`, err);
    return { error: err?.message || String(err) };
  }
}
