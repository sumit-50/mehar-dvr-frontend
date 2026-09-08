/** Client-safe shared types for Mehar DVR. */

export interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  phone: string | null;
  /** Storage path of the profile photo in the private `avatars` bucket. */
  avatar_url: string | null;
  status: "active" | "inactive";
  role?: string;
  created_at: string;
}

export interface DvrLocation {
  id: string;
  /** Company / organization name (shown in dropdowns). */
  company_name: string;
  location_name: string;
  location_code: string;
  address: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  /** pending = employee-submitted, awaiting admin approval */
  status: "active" | "inactive" | "pending" | "rejected";
  company_description: string;
  owner_name: string;
  owner_number: string;
  /** Employee who requested this office (null for admin-created locations). */
  submitted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DvrVisit {
  id: string;
  employee_id: string;
  location_id: string;
  visit_purpose: string;
  remarks: string | null;
  actual_latitude: number;
  actual_longitude: number;
  fixed_latitude: number;
  fixed_longitude: number;
  distance: number;
  gps_accuracy: number | null;
  photo_path: string | null;
  visit_date: string;
  visit_time: string;
  status: "submitted" | "verified" | "rejected";
  created_at: string;
  /** Signed URL attached by server functions at read time. */
  photo_url?: string | null;
}

export interface VisitWithRefs extends DvrVisit {
  location?: Pick<
    DvrLocation,
    | "id"
    | "company_name"
    | "location_name"
    | "location_code"
    | "address"
    | "company_description"
    | "owner_name"
    | "owner_number"
    | "latitude"
    | "longitude"
    | "allowed_radius"
    | "status"
  > | null;
  employee?: Pick<EmployeeProfile, "name" | "employee_id" | "email"> | null;
}

export interface SessionInfo {
  userId: string;
  profile: EmployeeProfile | null;
  isAdmin: boolean;
  /** Short-lived signed URL for the user's profile photo, if one is set. */
  avatarUrl: string | null;
}

export interface LocationWithStats extends DvrLocation {
  total_visits: number;
}

export interface EmployeeWithAssignments extends EmployeeProfile {
  roles: string[];
  location_ids: string[];
  total_visits: number;
}
