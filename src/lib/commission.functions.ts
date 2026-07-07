import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: ReturnType<typeof requireSupabaseAuth extends never ? never : any>["_"]; userId: string }) {
  // no-op typing; we call the check via ctx.supabase
}

// Sync commissions for any invoice items missing records
export const syncCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { since?: string; invoiceId?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleOk) throw new Error("Forbidden");

    let q = supabase
      .from("invoices")
      .select("id, invoice_date, stylist_id, assistant_id, invoice_items(id, item_type, line_total)");
    if (data.invoiceId) q = q.eq("id", data.invoiceId);
    if (data.since) q = q.gte("invoice_date", data.since);

    const { data: invoices, error } = await q;
    if (error) throw error;

    const { data: settings, error: sErr } = await supabase.from("commission_settings").select("*");
    if (sErr) throw sErr;
    const settingsMap = new Map(settings!.map((s) => [s.category, s]));

    const rows: any[] = [];
    for (const inv of invoices ?? []) {
      for (const item of inv.invoice_items ?? []) {
        const s = settingsMap.get(item.item_type);
        if (!s) continue;
        if (inv.stylist_id) {
          rows.push({
            invoice_id: inv.id,
            invoice_item_id: item.id,
            employee_id: inv.stylist_id,
            employee_role: "stylist",
            category: item.item_type,
            sale_amount: item.line_total,
            commission_percent: s.stylist_percent,
            commission_amount: Math.round(Number(item.line_total) * Number(s.stylist_percent)) / 100,
            invoice_date: inv.invoice_date,
          });
        }
        if (inv.assistant_id) {
          rows.push({
            invoice_id: inv.id,
            invoice_item_id: item.id,
            employee_id: inv.assistant_id,
            employee_role: "assistant",
            category: item.item_type,
            sale_amount: item.line_total,
            commission_percent: s.staff_percent,
            commission_amount: Math.round(Number(item.line_total) * Number(s.staff_percent)) / 100,
            invoice_date: inv.invoice_date,
          });
        }
      }
    }

    if (!rows.length) return { inserted: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr, count } = await supabaseAdmin
      .from("commission_records")
      .upsert(rows, { onConflict: "invoice_item_id,employee_role", ignoreDuplicates: true, count: "exact" });
    if (insErr) throw insErr;
    return { inserted: count ?? rows.length };
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
    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const u of data.updates) {
      const { data: old } = await supabaseAdmin
        .from("commission_settings").select("*").eq("category", u.category).maybeSingle();
      await supabaseAdmin
        .from("commission_settings")
        .update({
          stylist_percent: u.stylist_percent,
          staff_percent: u.staff_percent,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("category", u.category);
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
    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleOk) throw new Error("Forbidden");

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
        stylist_percent: d.stylist_percent, staff_percent: d.staff_percent, updated_by: userId, updated_at: new Date().toISOString(),
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
    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleOk) throw new Error("Forbidden");

    const start = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const endDate = new Date(data.year, data.month, 1);
    const end = endDate.toISOString().slice(0, 10);

    const { data: recs, error } = await supabase
      .from("commission_records")
      .select("employee_id, employee_role, commission_amount")
      .gte("invoice_date", start)
      .lt("invoice_date", end);
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
  .inputValidator((data: { id: string; bonus?: number; deduction?: number; remarks?: string; payment_status?: "paid" | "unpaid"; payment_date?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("payrolls").select("*").eq("id", data.id).single();
    if (!cur) throw new Error("Payroll not found");
    const bonus = data.bonus ?? cur.bonus;
    const deduction = data.deduction ?? cur.deduction;
    const net = Number(cur.total_commission) + Number(bonus) - Number(deduction);
    const update: any = {
      bonus, deduction, net_pay: net,
      remarks: data.remarks ?? cur.remarks,
      updated_at: new Date().toISOString(),
    };
    if (data.payment_status) {
      update.payment_status = data.payment_status;
      update.payment_date = data.payment_status === "paid" ? (data.payment_date ?? new Date().toISOString().slice(0, 10)) : null;
    }
    const { error } = await supabaseAdmin.from("payrolls").update(update).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const recalculateRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { from: string; to: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!roleOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delete existing records in range and rebuild with current settings
    const { data: delRows, error: dErr } = await supabaseAdmin
      .from("commission_records").delete().gte("invoice_date", data.from).lte("invoice_date", data.to).select("id");
    if (dErr) throw dErr;

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_date, stylist_id, assistant_id, invoice_items(id, item_type, line_total)")
      .gte("invoice_date", data.from).lte("invoice_date", data.to);

    const { data: settings } = await supabaseAdmin.from("commission_settings").select("*");
    const smap = new Map((settings ?? []).map((s) => [s.category, s]));

    const rows: any[] = [];
    for (const inv of invoices ?? []) {
      for (const item of inv.invoice_items ?? []) {
        const s = smap.get(item.item_type);
        if (!s) continue;
        if (inv.stylist_id) rows.push({
          invoice_id: inv.id, invoice_item_id: item.id, employee_id: inv.stylist_id,
          employee_role: "stylist", category: item.item_type, sale_amount: item.line_total,
          commission_percent: s.stylist_percent,
          commission_amount: Math.round(Number(item.line_total) * Number(s.stylist_percent)) / 100,
          invoice_date: inv.invoice_date,
        });
        if (inv.assistant_id) rows.push({
          invoice_id: inv.id, invoice_item_id: item.id, employee_id: inv.assistant_id,
          employee_role: "assistant", category: item.item_type, sale_amount: item.line_total,
          commission_percent: s.staff_percent,
          commission_amount: Math.round(Number(item.line_total) * Number(s.staff_percent)) / 100,
          invoice_date: inv.invoice_date,
        });
      }
    }
    if (rows.length) {
      await supabaseAdmin.from("commission_records").insert(rows);
    }
    await supabaseAdmin.from("commission_audit_log").insert({
      actor_id: userId, action: "recalculate_range",
      notes: `Range ${data.from} to ${data.to}: removed ${delRows?.length ?? 0}, created ${rows.length}`,
    });
    return { removed: delRows?.length ?? 0, created: rows.length };
  });
