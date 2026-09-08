import { z } from "zod";
import { VISIT_PURPOSES } from "./geo";

export const locationSchema = z.object({
  id: z.string().min(1).optional(),
  company_name: z.string().trim().max(120).optional().default(""),
  location_name: z.string().trim().min(2, "Name is required").max(120),
  location_code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .max(24)
    .regex(/^[A-Za-z0-9-_]+$/, "Only letters, numbers, dashes"),
  address: z.string().trim().max(300).default(""),
  company_description: z.string().trim().optional().default(""),
  owner_name: z.string().trim().max(80).optional().default(""),
  owner_number: z.string().trim().max(20).optional().default(""),
  latitude: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  allowed_radius: z.number().int().min(10, "Minimum 10 m").max(5000, "Maximum 5000 m"),
  status: z.enum(["active", "inactive", "pending"]).default("active"),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const visitSubmitSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  purpose: z.string().trim().min(1, "Visit purpose is required").max(120),
  customPurpose: z.string().trim().max(120).optional(),
  remarks: z.string().trim().optional(),
  ownerName: z.string().trim().max(80).optional(),
  ownerNumber: z.string().trim().max(20).optional(),
  companyDescription: z.string().trim().optional(),
  actualLatitude: z.number().min(-90).max(90),
  actualLongitude: z.number().min(-180).max(180),
  gpsAccuracy: z.number().min(0).max(10000),
  photo: z.string().min(100, "Photo is required"),
});
export type VisitSubmitInput = z.infer<typeof visitSubmitSchema>;

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  employeeId: z
    .string()
    .trim()
    .min(3, "Employee ID is required")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: z.string().optional().default("employee"),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const visitFiltersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locationId: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  status: z.enum(["submitted", "verified", "rejected"]).optional(),
  search: z.string().trim().max(120).optional(),
});
export type VisitFilters = z.infer<typeof visitFiltersSchema>;

export const identifierSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
});

/** Employee's request to add a new visit office (goes to admin for approval). */
export const officeRequestSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(120),
  officeName: z.string().trim().min(2, "Office / branch name is required").max(120),
  companyDescription: z.string().trim().max(300).optional().default(""),
  ownerName: z.string().trim().max(80).optional().default(""),
  ownerNumber: z.string().trim().max(20).optional().default(""),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gpsAccuracy: z.number().min(0).max(10000).optional().default(15),
});
export type OfficeRequestInput = z.infer<typeof officeRequestSchema>;

/** Employee stamps a pending office with their live GPS for one-time admin approval. */
export const officeGpsSchema = z.object({
  locationId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gpsAccuracy: z.number().min(0).max(10000).optional().default(15),
});

/** One-time office details (owner + description) filled for admin review — pending offices only. */
export const officeDetailsSchema = z.object({
  locationId: z.string().min(1),
  companyDescription: z.string().trim().max(300).optional().default(""),
  ownerName: z.string().trim().max(80).optional().default(""),
  ownerNumber: z.string().trim().max(20).optional().default(""),
});

export function isKnownPurpose(purpose: string): boolean {
  return (VISIT_PURPOSES as readonly string[]).includes(purpose);
}
