import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type SettingsRow = { category: string; stylist_percent: number | string; staff_percent: number | string };

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!ok) throw new Error("Forbidden");
}

/** Look up which of the two commission roles ('stylist' or 'staff') a user has. Defaults to 'staff'. */
async function loadRoleMap(admin: any, userIds: string[]): Promise<Map<string, "stylist" | "staff">> {
  const map = new Map<string, "stylist" | "staff">();
  if (!userIds.length) return map;
  const { data } = await admin.from("user_roles").select("user_id, role").in("user_id", userIds);
  for (const r of data ?? []) {
    if (r.role === "stylist") map.set(r.user_id, "stylist");
    else if (r.role === "staff" && !map.has(r.user_id)) map.set(r.user_id, "staff");
  }
  for (const id of userIds) if (!map.has(id)) map.set(id, "staff");
  return map;
}

function computeAmount(sale: number, pct: number): number {
  return Math.round(sale * pct) / 100;
}

/**
 * Rebuild ALL commission records from scratch using current commission_settings.
 * - Sale commission: one record per (customer_package, first-session staff).
 * - Session commission: one record per (usage_log, staff).
 * Category comes from packages.category. Percentages come from commission_settings.
 * Employee role ('stylist' | 'staff') resolved from user_roles (defaults to 'staff').
 */
export const syncCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rangeFrom?: string; rangeTo?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin.from("commission_settings").select("*");
    const smap = new Map<string, SettingsRow>((settings ?? []).map((s: any) => [s.category, s]));

    // customer_packages joined with package info
    let cpq = supabaseAdmin.from("customer_packages").select(`
      id, package_id, purchase_date,
      package:packages(id, price, total_sessions, category)
    `);
    if (data.rangeFrom) cpq = cpq.gte("purchase_date", data.rangeFrom);
    if (data.rangeTo) cpq = cpq.lte("purchase_date", data.rangeTo);
    const { data: cps } = await cpq;
    const cpMap = new Map<string, any>((cps ?? []).map((c: any) => [c.id, c]));

    // usage_logs + session_staff
    let ulq = supabaseAdmin.from("usage_logs")
      .select("id, customer_package_id, used_at, session_staff(staff_user_id)")
      .order("used_at", { ascending: true });
    if (data.rangeFrom) ulq = ulq.gte("used_at", data.rangeFrom);
    if (data.rangeTo) ulq = ulq.lte("used_at", data.rangeTo);
    const { data: uls } = await ulq;

    // Collect all staff user ids
    const staffIds = new Set<string>();
    for (const ul of uls ?? []) {
      for (const s of (ul as any).session_staff ?? []) staffIds.add(s.staff_user_id);
    }
    const roleMap = await loadRoleMap(supabaseAdmin, Array.from(staffIds));

    const rows: any[] = [];

    // ---- Session commission rows ----
    for (const ul of uls ?? []) {
      const cp = cpMap.get((ul as any).customer_package_id);
      if (!cp || !cp.package) continue;
      const pkg = cp.package;
      const category = pkg.category ?? "package";
      const s = smap.get(category);
      if (!s) continue;
      const total = Math.max(1, Number(pkg.total_sessions ?? 1));
      const sessionAmount = Number(pkg.price ?? 0) / total;

      for (const link of (ul as any).session_staff ?? []) {
        const role = roleMap.get(link.staff_user_id) ?? "staff";
        const pct = role === "stylist" ? Number(s.stylist_percent) : Number(s.staff_percent);
        rows.push({
          source_type: "session",
          customer_package_id: cp.id,
          usage_log_id: (ul as any).id,
          employee_id: link.staff_user_id,
          employee_role: role,
          category,
          sale_amount: sessionAmount,
          commission_percent: pct,
          commission_amount: computeAmount(sessionAmount, pct),
          event_date: (ul as any).used_at,
        });
      }
    }

    // ---- Sale commission rows: attribute to FIRST session's staff ----
    // Build first-session map from uls (already ordered ascending)
    const firstByCp = new Map<string, any>();
    for (const ul of uls ?? []) {
      const cpid = (ul as any).customer_package_id;
      if (!firstByCp.has(cpid)) firstByCp.set(cpid, ul);
    }
    for (const [cpid, ul] of firstByCp.entries()) {
      const cp = cpMap.get(cpid);
      if (!cp || !cp.package) continue;
      const pkg = cp.package;
      const category = pkg.category ?? "package";
      const s = smap.get(category);
      if (!s) continue;
      const saleAmount = Number(pkg.price ?? 0);
      for (const link of (ul as any).session_staff ?? []) {
        const role = roleMap.get(link.staff_user_id) ?? "staff";
        const pct = role === "stylist" ? Number(s.stylist_percent) : Number(s.staff_percent);
        rows.push({
          source_type: "sale",
          customer_package_id: cpid,
          usage_log_id: null,
          employee_id: link.staff_user_id,
          employee_role: role,
          category,
          sale_amount: saleAmount,
          commission_percent: pct,
          commission_amount: computeAmount(saleAmount, pct),
          event_date: cp.purchase_date ?? (ul as any).used_at,
        });
      }
    }

    // Wipe range and re-insert (idempotent)
    let delQ = supabaseAdmin.from("commission_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (data.rangeFrom) delQ = delQ.gte("event_date", data.rangeFrom);
    if (data.rangeTo) delQ = delQ.lte("event_date", data.rangeTo);
    await delQ;

    if (rows.length) {
      // Chunk to avoid huge payloads
      const chunk = 500;
      for (let i = 0; i < rows.length; i += chunk) {
        const { error } = await supabaseAdmin.from("commission_records").insert(rows.slice(i, i + chunk));
        if (error) throw error;
      }
    }
    return { inserted: rows.length };
  });

const SettingsSchema = z.object({
  updates: z.array(z.object({
    category: z.string(),
    stylist_percent: z.number(),
    staff_percent: z.number(),
  })),
});

export const updateCommissionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const u of data.updates) {
      const { data: old } = await supabaseAdmin
        .from("commission_settings").select("*").eq("category", u.category).maybeSingle();
      await supabaseAdmin.from("commission_settings")
        .update({
          stylist_percent: u.stylist_percent,
          staff_percent: u.staff_percent,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }).eq("category", u.category);
      await supabaseAdmin.from("commission_audit_log").insert({
        actor_id: userId,
        action: "update_setting",
        category: u.category,
        old_stylist_percent: old?.stylist_percent ?? null,
        old_staff_percent: old?.staff_percent ?? null,
        new_stylist_percent: u.stylist_percent,
        new_staff_percent: u.staff_percent,
      });
    }
    return { ok: true };
  });

export const resetCommissionDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const defaults = [
      { category: "service", stylist_percent: 7, staff_percent: 3 },
      { category: "product", stylist_percent: 3.75, staff_percent: 3.75 },
      { category: "package", stylist_percent: 2.5, staff_percent: 2.5 },
      { category: "ginseng_box", stylist_percent: 5, staff_percent: 5 },
      { category: "freedom", stylist_percent: 5, staff_percent: 5 },
    ];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const d of defaults) {
      await supabaseAdmin.from("commission_settings").update({
        stylist_percent: d.stylist_percent, staff_percent: d.staff_percent,
        updated_by: userId, updated_at: new Date().toISOString(),
      }).eq("category", d.category);
    }
    await supabaseAdmin.from("commission_audit_log").insert({
      actor_id: userId, action: "reset_defaults", notes: "All categories reset to defaults",
    });
    return { ok: true };
  });

export const generatePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { month: number; year: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const start = new Date(Date.UTC(data.year, data.month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(data.year, data.month, 1)).toISOString();

    const { data: recs, error } = await supabase
      .from("commission_records")
      .select("employee_id, employee_role, commission_amount")
      .gte("event_date", start)
      .lt("event_date", end);
    if (error) throw error;

    const totals = new Map<string, number>();
    for (const r of recs ?? []) {
      const k = `${r.employee_id}::${r.employee_role}`;
      totals.set(k, (totals.get(k) ?? 0) + Number(r.commission_amount));
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Array.from(totals.entries()).map(([k, total]) => {
      const [employee_id, employee_role] = k.split("::");
      return {
        employee_id, employee_role, month: data.month, year: data.year,
        total_commission: total, bonus: 0, deduction: 0, net_pay: total,
      };
    });
    if (!rows.length) return { created: 0 };
    const { error: upErr } = await supabaseAdmin
      .from("payrolls")
      .upsert(rows, { onConflict: "employee_id,employee_role,month,year", ignoreDuplicates: false });
    if (upErr) throw upErr;
    return { created: rows.length };
  });

export const updatePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id: string; bonus?: number; deduction?: number; remarks?: string;
    payment_status?: "paid" | "pending"; payment_date?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("payrolls").select("*").eq("id", data.id).single();
    if (!cur) throw new Error("Payroll not found");
    const bonus = data.bonus ?? Number(cur.bonus);
    const deduction = data.deduction ?? Number(cur.deduction);
    const net = Number(cur.total_commission) + Number(bonus) - Number(deduction);
    const update: any = {
      bonus, deduction, net_pay: net,
      remarks: data.remarks ?? cur.remarks,
    };
    if (data.payment_status) {
      update.payment_status = data.payment_status;
      update.payment_date = data.payment_status === "paid" ? (data.payment_date ?? new Date().toISOString()) : null;
    }
    const { error } = await supabaseAdmin.from("payrolls").update(update).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Recalculate a date range: delete + rebuild + audit log. */
export const recalculateRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { from: string; to: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Count existing in range for audit
    const { count: before } = await supabaseAdmin
      .from("commission_records").select("*", { count: "exact", head: true })
      .gte("event_date", data.from).lte("event_date", data.to);

    // Reuse sync engine with the range
    const result = await runSync(supabaseAdmin, data.from, data.to);

    await supabaseAdmin.from("commission_audit_log").insert({
      actor_id: userId, action: "recalculate_range",
      notes: `Range ${data.from} to ${data.to}: removed ${before ?? 0}, created ${result.inserted}`,
    });
    return { removed: before ?? 0, created: result.inserted };
  });

/** Seed demo data (packages, staff, stylists, customer_packages, usage_logs) so pages have content. */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotent: skip if we already have customer_packages
    const { count } = await supabaseAdmin.from("customer_packages").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: false, reason: "Data already exists" };

    // Create demo auth users via admin API for stylists, staff, and a customer
    const emails = [
      { email: "stylist1@salon.com", name: "May Thu", role: "stylist" as const },
      { email: "stylist2@salon.com", name: "Aye Chan", role: "stylist" as const },
      { email: "staff1@salon.com", name: "Ko Ko", role: "staff" as const },
      { email: "staff2@salon.com", name: "Nyi Nyi", role: "staff" as const },
      { email: "customer1@salon.com", name: "Su Su", role: "customer" as const },
      { email: "customer2@salon.com", name: "Hla Hla", role: "customer" as const },
    ];
    const created: Record<string, string> = {};
    for (const u of emails) {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing.users.find((x: any) => x.email === u.email);
      let id: string;
      if (found) {
        id = found.id;
      } else {
        const { data: nu, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email, password: "Demo!2026", email_confirm: true, user_metadata: { name: u.name },
        });
        if (error) throw error;
        id = nu.user.id;
      }
      await supabaseAdmin.from("profiles").upsert({ id, email: u.email, name: u.name });
      await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: u.role }, { onConflict: "user_id,role" });
      created[u.email] = id;
    }

    // Packages across the 5 categories
    const pkgSeed = [
      { name: "Hair Cut & Blow-dry", category: "service", price: 25000, total_sessions: 1 },
      { name: "Keratin Treatment 6x", category: "package", price: 300000, total_sessions: 6 },
      { name: "Argan Oil Bottle", category: "product", price: 40000, total_sessions: 1 },
      { name: "Ginseng Scalp Box", category: "ginseng_box", price: 180000, total_sessions: 4 },
      { name: "Freedom Membership", category: "freedom", price: 500000, total_sessions: 12 },
    ];
    const pkgIds: Record<string, string> = {};
    for (const p of pkgSeed) {
      const { data } = await supabaseAdmin.from("packages").insert(p).select("id").single();
      pkgIds[p.name] = data!.id;
    }

    // Customer packages
    const cps = [
      { customer_id: created["customer1@salon.com"], package_name: "Keratin Treatment 6x" },
      { customer_id: created["customer1@salon.com"], package_name: "Hair Cut & Blow-dry" },
      { customer_id: created["customer2@salon.com"], package_name: "Ginseng Scalp Box" },
      { customer_id: created["customer2@salon.com"], package_name: "Freedom Membership" },
      { customer_id: created["customer1@salon.com"], package_name: "Argan Oil Bottle" },
    ];
    const cpIds: string[] = [];
    for (const c of cps) {
      const p = pkgSeed.find((x) => x.name === c.package_name)!;
      const { data } = await supabaseAdmin.from("customer_packages").insert({
        customer_id: c.customer_id,
        package_id: pkgIds[c.package_name],
        sessions_remaining: p.total_sessions,
        total_sessions: p.total_sessions,
      }).select("id").single();
      cpIds.push(data!.id);
    }

    // Usage logs — one or two sessions each
    const staffIds = [
      created["stylist1@salon.com"], created["stylist2@salon.com"],
      created["staff1@salon.com"], created["staff2@salon.com"],
    ];
    let logIdx = 0;
    for (const cpId of cpIds) {
      const sessions = logIdx % 2 === 0 ? 2 : 1;
      for (let i = 0; i < sessions; i++) {
        const { data: ul } = await supabaseAdmin.from("usage_logs").insert({
          customer_package_id: cpId,
          admin_id: userId,
          used_at: new Date(Date.now() - (logIdx * 3 + i) * 86400000).toISOString(),
        }).select("id").single();
        const stylist = staffIds[logIdx % 2];
        const staff = staffIds[2 + (logIdx % 2)];
        await supabaseAdmin.from("session_staff").insert([
          { usage_log_id: ul!.id, staff_user_id: stylist },
          { usage_log_id: ul!.id, staff_user_id: staff },
        ]);
      }
      logIdx++;
    }

    // Build commission records
    await runSync(supabaseAdmin, undefined, undefined);
    return { seeded: true };
  });

// Internal helper that both syncCommissions and recalculateRange use.
async function runSync(admin: any, from?: string, to?: string) {
  const { data: settings } = await admin.from("commission_settings").select("*");
  const smap = new Map<string, SettingsRow>((settings ?? []).map((s: any) => [s.category, s]));

  let cpq = admin.from("customer_packages").select(`
    id, package_id, purchase_date,
    package:packages(id, price, total_sessions, category)
  `);
  if (from) cpq = cpq.gte("purchase_date", from);
  if (to) cpq = cpq.lte("purchase_date", to);
  const { data: cps } = await cpq;
  const cpMap = new Map<string, any>((cps ?? []).map((c: any) => [c.id, c]));

  let ulq = admin.from("usage_logs")
    .select("id, customer_package_id, used_at, session_staff(staff_user_id)")
    .order("used_at", { ascending: true });
  if (from) ulq = ulq.gte("used_at", from);
  if (to) ulq = ulq.lte("used_at", to);
  const { data: uls } = await ulq;

  const staffIds = new Set<string>();
  for (const ul of uls ?? []) for (const s of (ul as any).session_staff ?? []) staffIds.add(s.staff_user_id);
  const roleMap = await loadRoleMap(admin, Array.from(staffIds));

  const rows: any[] = [];
  for (const ul of uls ?? []) {
    const cp = cpMap.get((ul as any).customer_package_id);
    if (!cp || !cp.package) continue;
    const pkg = cp.package;
    const category = pkg.category ?? "package";
    const s = smap.get(category);
    if (!s) continue;
    const total = Math.max(1, Number(pkg.total_sessions ?? 1));
    const sessionAmount = Number(pkg.price ?? 0) / total;
    for (const link of (ul as any).session_staff ?? []) {
      const role = roleMap.get(link.staff_user_id) ?? "staff";
      const pct = role === "stylist" ? Number(s.stylist_percent) : Number(s.staff_percent);
      rows.push({
        source_type: "session", customer_package_id: cp.id, usage_log_id: (ul as any).id,
        employee_id: link.staff_user_id, employee_role: role, category,
        sale_amount: sessionAmount, commission_percent: pct,
        commission_amount: computeAmount(sessionAmount, pct),
        event_date: (ul as any).used_at,
      });
    }
  }
  const firstByCp = new Map<string, any>();
  for (const ul of uls ?? []) {
    const cpid = (ul as any).customer_package_id;
    if (!firstByCp.has(cpid)) firstByCp.set(cpid, ul);
  }
  for (const [cpid, ul] of firstByCp.entries()) {
    const cp = cpMap.get(cpid);
    if (!cp || !cp.package) continue;
    const pkg = cp.package;
    const category = pkg.category ?? "package";
    const s = smap.get(category);
    if (!s) continue;
    const saleAmount = Number(pkg.price ?? 0);
    for (const link of (ul as any).session_staff ?? []) {
      const role = roleMap.get(link.staff_user_id) ?? "staff";
      const pct = role === "stylist" ? Number(s.stylist_percent) : Number(s.staff_percent);
      rows.push({
        source_type: "sale", customer_package_id: cpid, usage_log_id: null,
        employee_id: link.staff_user_id, employee_role: role, category,
        sale_amount: saleAmount, commission_percent: pct,
        commission_amount: computeAmount(saleAmount, pct),
        event_date: cp.purchase_date ?? (ul as any).used_at,
      });
    }
  }

  let delQ = admin.from("commission_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (from) delQ = delQ.gte("event_date", from);
  if (to) delQ = delQ.lte("event_date", to);
  await delQ;

  if (rows.length) {
    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      const { error } = await admin.from("commission_records").insert(rows.slice(i, i + chunk));
      if (error) throw error;
    }
  }
  return { inserted: rows.length };
}
