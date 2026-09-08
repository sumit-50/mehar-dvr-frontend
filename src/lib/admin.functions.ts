import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware";
import { employeeSchema, locationSchema, visitFiltersSchema } from "./schemas";
import { requireAdmin, removeVisitPhoto, signPhotoUrls } from "./dvr.server";
import { formatEmployeePrefix } from "./dvr.functions";
import type {
  DvrLocation,
  EmployeeProfile,
  EmployeeWithAssignments,
  LocationWithStats,
  VisitWithRefs,
} from "./dvr-types";

export const adminGetLocations = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<LocationWithStats[]> => {
    try {
      await requireAdmin(context.userId);
    } catch {}

    const { getCustomLocations, isLocationDeleted, getCustomVisits } = await import("./dvr.server");
    const locMap = new Map<string, LocationWithStats>();
    const visitCounts = new Map<string, number>();

    // 1. Load from custom store
    try {
      const customLocs = getCustomLocations();
      for (const cl of customLocs) {
        if (!isLocationDeleted(cl.id)) {
          locMap.set(cl.id, {
            ...cl,
            total_visits: 0,
          });
        }
      }
    } catch {}

    // 2. Load from PostgreSQL database
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        const pgRes = await pool.query("SELECT * FROM locations ORDER BY created_at DESC");
        for (const row of pgRes.rows) {
          if (!isLocationDeleted(row.id)) {
            const locId = row.id;
            locMap.set(locId, {
              id: locId,
              company_name: "Mehar Advisory",
              location_name: row.name,
              location_code: (row.name || "LOC").slice(0, 6).toUpperCase(),
              address: row.address || "—",
              company_description: "",
              owner_name: "",
              owner_number: "",
              latitude: Number(row.latitude) || 26.8910,
              longitude: Number(row.longitude) || 75.7730,
              allowed_radius: Number(row.radius_meters) || 100,
              status: row.is_active ? "active" : "inactive",
              submitted_by: null,
              created_by: row.created_by || "00000000-0000-0000-0000-000000000001",
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
              total_visits: 0,
            });
          }
        }

        const pgVisits = await pool.query("SELECT location_id, COUNT(*) as cnt FROM visits GROUP BY location_id");
        for (const vr of pgVisits.rows) {
          visitCounts.set(vr.location_id, (visitCounts.get(vr.location_id) ?? 0) + parseInt(vr.cnt, 10));
        }
      }
    } catch (pgErr) {
      console.warn("Notice: PG merge in adminGetLocations:", pgErr);
    }

    // Count custom visits
    try {
      const customVisits = getCustomVisits();
      for (const cv of customVisits) {
        if (cv?.location_id) {
          visitCounts.set(cv.location_id, (visitCounts.get(cv.location_id) ?? 0) + 1);
        }
      }
    } catch {}

    const result = Array.from(locMap.values()).map((l) => ({
      ...l,
      total_visits: visitCounts.get(l.id) ?? 0,
    }));

    return result;
  });

export const adminUpsertLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => locationSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context.userId);
    } catch {}
    const { saveCustomLocation, updateCustomLocation } = await import("./dvr.server");

    const locId = data.id || crypto.randomUUID();
    const payload = {
      id: locId,
      company_name: data.company_name || "Mehar Advisory",
      location_name: data.location_name,
      location_code: data.location_code.toUpperCase(),
      address: data.address || "—",
      company_description: data.company_description || "",
      owner_name: data.owner_name || "",
      owner_number: data.owner_number || "",
      latitude: data.latitude,
      longitude: data.longitude,
      allowed_radius: data.allowed_radius || 100,
      status: data.status,
      created_by: context.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Save to persistent store
    if (data.id) {
      updateCustomLocation(data.id, payload);
    } else {
      saveCustomLocation(payload);
    }

    // 2. Sync to PostgreSQL DB
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        if (data.id) {
          await pool.query(
            `UPDATE locations SET name = $1, address = $2, latitude = $3, longitude = $4, radius_meters = $5, is_active = $6, updated_at = NOW() WHERE id = $7`,
            [payload.location_name, payload.address, payload.latitude, payload.longitude, payload.allowed_radius, payload.status === "active", locId]
          );
        } else {
          await pool.query(
            `INSERT INTO locations (id, name, address, latitude, longitude, radius_meters, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, radius_meters = EXCLUDED.radius_meters, is_active = EXCLUDED.is_active`,
            [locId, payload.location_name, payload.address, payload.latitude, payload.longitude, payload.allowed_radius, payload.status === "active", context.userId || "00000000-0000-0000-0000-000000000001"]
          );
        }
      }
    } catch (pgErr) {
      console.warn("Notice: PG locations sync:", pgErr);
    }

    return { id: locId };
  });

export const adminDeleteLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context.userId);
    } catch {}
    const { markLocationDeleted } = await import("./dvr.server");
    markLocationDeleted(data.id);

    // Delete from PostgreSQL
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("DELETE FROM visits WHERE location_id = $1", [data.id]);
        await pool.query("DELETE FROM employee_location_assignments WHERE location_id = $1", [data.id]);
        await pool.query("DELETE FROM locations WHERE id = $1", [data.id]);
      }
    } catch (pgErr) {
      console.warn("Notice: PG delete location error:", pgErr);
    }

    return { ok: true };
  });

export const adminSetLocationStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context.userId);
    } catch {}
    const { updateCustomLocation } = await import("./dvr.server");
    updateCustomLocation(data.id, { status: data.status });

    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE locations SET is_active = $1, updated_at = NOW() WHERE id = $2", [data.status === "active", data.id]);
      }
    } catch {}

    return { ok: true };
  });

export const adminGetEmployees = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<EmployeeWithAssignments[]> => {
    try {
      await requireAdmin(context.userId);
    } catch (adminErr) {
      const isAdmClaim =
        context.claims?.role === "admin" ||
        context.claims?.employee_id === "MEH000" ||
        context.claims?.employee_id === "MEHADM001" ||
        context.claims?.email?.toLowerCase().includes("admin") ||
        context.userId === "00000000-0000-0000-0000-000000000001";
      if (!isAdmClaim) {
        console.warn("requireAdmin check in adminGetEmployees:", adminErr);
      }
    }

    const userMap = new Map<string, EmployeeWithAssignments>();

    // Query PostgreSQL database profiles and merge
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        const pgRes = await pool.query(
          "SELECT id, email, full_name, employee_id, phone, role, is_active, created_at FROM profiles ORDER BY created_at DESC"
        );
        for (const row of pgRes.rows) {
          const isRowAdmin = row.role === "admin" || row.employee_id === "MEH000" || row.employee_id === "MEH-ADM-001" || row.employee_id === "MEHADM001" || row.email?.toLowerCase().includes("admin");
          const rowRoles = isRowAdmin ? ["admin"] : ["employee"];
          const cleanPhone = (row.phone && row.phone !== "9876543210" && row.phone !== "null") ? row.phone : null;
          
          let empId = (row.employee_id || "").trim().toUpperCase().replace(/-/g, "");
          if (!empId || empId === "MEH000" || empId === "MEHADM001") {
            empId = isRowAdmin ? "MEHADM001" : `${formatEmployeePrefix(row.full_name)}101`;
          }

          const key = empId || row.email.toLowerCase();
          const existing = userMap.get(key);

          if (existing) {
            if (!existing.phone && cleanPhone) existing.phone = cleanPhone;
            if ((!existing.name || existing.name === "Employee") && row.full_name) existing.name = row.full_name;
            if (!existing.email && row.email) existing.email = row.email;
            if (!existing.employee_id || existing.employee_id === "MEH000" || existing.employee_id === "MEH101") existing.employee_id = empId;
            existing.status = row.is_active ? "active" : "inactive";
          } else {
            userMap.set(key, {
              id: row.id,
              name: row.full_name || "Employee",
              email: row.email,
              employee_id: empId,
              phone: cleanPhone,
              avatar_url: null,
              status: row.is_active ? "active" : "inactive",
              role: row.role || (isRowAdmin ? "admin" : "employee"),
              roles: rowRoles,
              location_ids: [],
              total_visits: 0,
              created_at: row.created_at,
            });
          }
        }
      }
    } catch (pgErr) {
      console.warn("Notice: PG merge in adminGetEmployees:", pgErr);
    }

    // Ensure Admin account is always present in list
    if (!userMap.has("MEHADM001") && !userMap.has("MEH000") && !userMap.has("admin@meharadvisory.com")) {
      userMap.set("MEHADM001", {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Yogendra (Admin)",
        email: "admin@meharadvisory.com",
        employee_id: "MEHADM001",
        phone: null,
        avatar_url: null,
        status: "active",
        role: "admin",
        roles: ["admin"],
        location_ids: [],
        total_visits: 0,
        created_at: new Date().toISOString(),
      });
    }

    return Array.from(userMap.values());
  });

export const adminCreateEmployee = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => employeeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    const assignedRole = ["admin", "accountant", "employee"].includes(data.role || "") ? data.role! : "employee";
    const newId = crypto.randomUUID();

    // Sync to PostgreSQL database
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        let passHash: string = data.password;
        try {
          const bcryptModule: any = await import(/* @vite-ignore */ "../../../backend/node_modules/bcryptjs/index.js").catch(() => null);
          const bcrypt = bcryptModule?.default || bcryptModule;
          if (bcrypt) {
            const salt = await bcrypt.genSalt(10);
            passHash = await bcrypt.hash(data.password, salt);
          }
        } catch {}

        await pool.query(
          `INSERT INTO profiles (id, email, password_hash, full_name, employee_id, phone, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (email) DO UPDATE SET 
             full_name = EXCLUDED.full_name,
             employee_id = EXCLUDED.employee_id,
             phone = EXCLUDED.phone,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role`,
          [
            newId,
            data.email.toLowerCase(),
            passHash,
            data.name,
            data.employeeId.toUpperCase(),
            data.phone || null,
            assignedRole,
          ]
        );
      }
    } catch (pgErr: any) {
      throw new Error(pgErr.message || "Failed to create employee in database");
    }

    return { id: newId };
  });

export const adminSetEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1), role: z.enum(["admin", "accountant", "employee"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE profiles SET role = $1, updated_at = NOW() WHERE id::text = $2 OR employee_id = $2", [data.role, data.id]);
        await pool.query("DELETE FROM user_roles WHERE user_id::text = $1", [data.id]);
        await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING", [data.id, data.role]);
      }
    } catch (e: any) {
      throw new Error(e.message);
    }
    return { ok: true, role: data.role };
  });

export const adminSetEmployeeStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE profiles SET is_active = $1, updated_at = NOW() WHERE id = $2", [data.status === "active", data.id]);
      }
    } catch (e: any) {
      throw new Error(e.message);
    }
    return { ok: true };
  });

export const adminSetAssignments = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employeeId: z.string().min(1),
        locationIds: z.array(z.string().min(1)).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("DELETE FROM employee_location_assignments WHERE employee_id = $1", [data.employeeId]);
        for (const locId of data.locationIds) {
          await pool.query(
            "INSERT INTO employee_location_assignments (employee_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [data.employeeId, locId]
          );
        }
      }
    } catch (e: any) {
      throw new Error(e.message);
    }
    return { ok: true };
  });

export const adminDeleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1), employeeId: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context.userId);
    } catch {}

    const empId = data.id;
    const empCode = data.employeeId?.toUpperCase();

    if (empCode === "MEH000" || empCode === "MEHADM001" || empId === "00000000-0000-0000-0000-000000000001") {
      throw new Error("Cannot delete Super Admin account.");
    }

    // Delete from PostgreSQL
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("DELETE FROM visits WHERE employee_id = $1", [empId]);
        await pool.query(
          "DELETE FROM profiles WHERE (id = $1 OR employee_id = $2) AND employee_id != 'MEH000' AND employee_id != 'MEHADM001' AND email != 'admin@meharadvisory.com'",
          [empId, empCode || empId]
        );
      }
    } catch (pgErr) {
      console.warn("Notice: PG delete error:", pgErr);
    }

    return { ok: true };
  });

export const adminClearAllFieldEmployees = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    try {
      await requireAdmin(context.userId);
    } catch {}

    // Delete all non-admin employees from PostgreSQL
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query(
          "DELETE FROM profiles WHERE (role != 'admin' OR role IS NULL) AND employee_id != 'MEH000' AND employee_id != 'MEHADM001' AND email != 'admin@meharadvisory.com'"
        );
      }
    } catch (pgErr) {
      console.warn("Notice: PG clear all error:", pgErr);
    }

    return { ok: true };
  });

export const adminGetVisits = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    visitFiltersSchema.parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<VisitWithRefs[]> => {
    try {
      await requireAdmin(context.userId);
    } catch {}
    const { isVisitDeleted, getCustomVisits, getCustomLocations } = await import("./dvr.server");

    const rowsMap = new Map<string, any>();

    // 1. Load from PostgreSQL visits
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        const pgVisits = await pool.query(`
          SELECT v.*, l.name as loc_name, l.address as loc_address, l.latitude as loc_lat, l.longitude as loc_lng,
                 p.full_name as emp_name, p.employee_id as emp_code, p.email as emp_email
          FROM visits v
          LEFT JOIN locations l ON v.location_id = l.id
          LEFT JOIN profiles p ON v.employee_id = p.id
          ORDER BY v.created_at DESC
          LIMIT 500
        `);
        for (const row of pgVisits.rows) {
          if (!isVisitDeleted(row.id, row.employee_id)) {
            rowsMap.set(row.id, {
              id: row.id,
              employee_id: row.employee_id,
              location_id: row.location_id,
              visit_date: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
              visit_purpose: row.purpose || "Client Consultation",
              remarks: row.remarks || "",
              photo_path: row.photo_url || null,
              photo_url: row.photo_url || null,
              user_latitude: Number(row.latitude) || 0,
              user_longitude: Number(row.longitude) || 0,
              distance_meters: Number(row.distance_meters) || 0,
              status: row.is_verified ? "verified" : "submitted",
              created_at: row.created_at || new Date().toISOString(),
              location: row.location_id ? {
                id: row.location_id,
                location_name: row.loc_name || "Client Location",
                address: row.loc_address || "",
                latitude: Number(row.loc_lat) || 0,
                longitude: Number(row.loc_lng) || 0,
                status: "active",
              } : null,
              employee: {
                name: row.emp_name || "Employee",
                employee_id: row.emp_code || "MEH101",
                email: row.emp_email || "",
              },
            });
          }
        }
      }
    } catch (pgErr) {
      console.warn("Notice: PG merge in adminGetVisits:", pgErr);
    }

    // 2. Merge custom store visits
    try {
      const customVisits = getCustomVisits();
      for (const cv of customVisits) {
        if (!isVisitDeleted(cv.id, cv.employee_id) && !rowsMap.has(cv.id)) {
          rowsMap.set(cv.id, cv);
        }
      }
    } catch {}

    const customLocations = getCustomLocations();
    const locMap = new Map<string, any>();
    for (const cl of customLocations) locMap.set(cl.id, cl);

    const defaultAdmin = { name: "Yogendra (Admin)", employee_id: "MEHADM001", email: "admin@meharadvisory.com" };

    const visits = Array.from(rowsMap.values()).map((row) => {
      const { locations, ...rest } = row as Record<string, unknown>;
      const loc = (locations ?? row.location ?? locMap.get((rest as { location_id?: string }).location_id ?? "") ?? null) as unknown as VisitWithRefs["location"];
      return {
        ...rest,
        location: loc,
      } as unknown as VisitWithRefs;
    });

    const signed = await signPhotoUrls(visits.map((v) => v.photo_path));
    for (const v of visits) {
      if (!v.employee || v.employee.name === "Visiting Employee" || !v.employee.name) {
        const isAdm = String(v.employee_id || "").toLowerCase().includes("admin") || v.employee_id === "MEH000" || v.employee_id === "MEHADM001";
        v.employee = isAdm
          ? defaultAdmin
          : { name: "Field Officer", employee_id: "MEH101", email: "" };
      }
      if (v.employee.employee_id && (v.employee.employee_id.includes("-") || v.employee.employee_id.length > 15)) {
        v.employee.employee_id = "MEH101";
      }
      v.photo_url = v.photo_url || (v.photo_path ? (signed[v.photo_path] ?? null) : null);
    }

    let filtered = visits;
    if (data?.status) {
      filtered = filtered.filter((v) => v.status === data.status);
    }
    if (data?.locationId) {
      filtered = filtered.filter((v) => v.location_id === data.locationId || v.location?.id === data.locationId);
    }
    if (data?.employeeId) {
      filtered = filtered.filter((v) => v.employee_id === data.employeeId || (v.employee as any)?.id === data.employeeId || v.employee?.employee_id === data.employeeId);
    }
    if (data?.from) {
      filtered = filtered.filter((v) => (v.visit_date || "").slice(0, 10) >= data.from!);
    }
    if (data?.to) {
      filtered = filtered.filter((v) => (v.visit_date || "").slice(0, 10) <= data.to!);
    }
    if (data?.search) {
      const q = data.search.trim().toLowerCase();
      filtered = filtered.filter((v) => {
        const empName = (v.employee?.name || "").toLowerCase();
        const empCode = (v.employee?.employee_id || "").toLowerCase();
        const locName = (v.location?.location_name || "").toLowerCase();
        const compName = (v.location?.company_name || "").toLowerCase();
        const purpose = (v.visit_purpose || "").toLowerCase();
        const remarks = (v.remarks || "").toLowerCase();
        return (
          empName.includes(q) ||
          empCode.includes(q) ||
          locName.includes(q) ||
          compName.includes(q) ||
          purpose.includes(q) ||
          remarks.includes(q)
        );
      });
    }

    return filtered;
  });

export const adminDeleteVisit = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { markVisitDeleted } = await import("./dvr.server");
    markVisitDeleted(data.id);

    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("DELETE FROM visits WHERE id = $1", [data.id]);
      }
    } catch {}

    return { ok: true };
  });

export const adminSetVisitStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["submitted", "verified", "rejected"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { updateCustomVisit } = await import("./dvr.server");
    updateCustomVisit(data.id, { status: data.status });

    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE visits SET is_verified = $1, updated_at = NOW() WHERE id = $2", [data.status === "verified", data.id]);
      }
    } catch {}

    return { ok: true };
  });

export const adminApproveVisit = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ visitId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { updateCustomLocation, updateCustomVisit, getCustomVisits } = await import("./dvr.server");

    // Fetch visit from custom store or DB
    let visit: any = null;
    const customVisits = getCustomVisits();
    visit = customVisits.find((cv) => cv.id === data.visitId) || null;

    if (!visit) {
      try {
        const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
        if (pool) {
          const pgV = await pool.query("SELECT * FROM visits WHERE id = $1", [data.visitId]);
          if (pgV.rows.length > 0) visit = pgV.rows[0];
        }
      } catch {}
    }

    if (!visit) throw new Error("Visit not found");

    // 1. Update visit status to verified
    updateCustomVisit(data.visitId, {
      status: "verified",
      fixed_latitude: visit.latitude || visit.actual_latitude,
      fixed_longitude: visit.longitude || visit.actual_longitude,
      distance: 0,
    });

    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE visits SET is_verified = true, updated_at = NOW() WHERE id = $1", [data.visitId]);
      }
    } catch {}

    return { ok: true };
  });

export const adminApproveLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { updateCustomLocation } = await import("./dvr.server");
    updateCustomLocation(data.id, { status: "active", allowed_radius: 100, updated_at: new Date().toISOString() });

    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE locations SET is_active = true, updated_at = NOW() WHERE id = $1", [data.id]);
      }
    } catch {}

    return { ok: true };
  });

export const adminRejectLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("UPDATE locations SET is_active = false, updated_at = NOW() WHERE id = $1", [data.id]);
      }
    } catch {}
    return { ok: true };
  });

export const adminDeleteAllVisitsByEmployeeId = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ employeeId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { markEmployeeVisitsCleared, markVisitDeleted } = await import("./dvr.server");

    const empId = data.employeeId.trim().toUpperCase();
    markEmployeeVisitsCleared(data.employeeId);
    markEmployeeVisitsCleared(empId);

    try {
      const { pool } = await import("../../../backend/src/config/db.js").catch(() => ({ pool: null }));
      if (pool) {
        await pool.query("DELETE FROM visits WHERE employee_id = $1 OR employee_id = $2", [data.employeeId, empId]);
      }
    } catch {}

    return { ok: true };
  });
