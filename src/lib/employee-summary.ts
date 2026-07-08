export type EmployeeSummaryRow = {
  id: string; name: string;
  today: number; thisMonth: number; lastMonth: number;
  total: number; totalSales: number; sessions: number;
};

export async function buildEmployeeSummary(supabase: any, role: "stylist" | "staff"): Promise<EmployeeSummaryRow[]> {
  // employees = users with matching user_roles.role
  const { data: rolesRows } = await supabase.from("user_roles").select("user_id").eq("role", role);
  const ids = (rolesRows ?? []).map((r: any) => r.user_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", ids);
  const { data: recs } = await supabase
    .from("commission_records")
    .select("employee_id, employee_role, source_type, sale_amount, commission_amount, event_date, usage_log_id")
    .in("employee_id", ids)
    .eq("employee_role", role);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  return (profs ?? []).map((p: any) => {
    const mine = (recs ?? []).filter((r: any) => r.employee_id === p.id);
    const t = (r: any) => new Date(r.event_date).getTime();
    const sessions = new Set(mine.filter((r: any) => r.usage_log_id).map((r: any) => r.usage_log_id)).size;
    return {
      id: p.id,
      name: p.name ?? p.email ?? "—",
      today: mine.filter((r: any) => t(r) >= todayStart && t(r) < tomorrowStart)
        .reduce((a: number, r: any) => a + Number(r.commission_amount), 0),
      thisMonth: mine.filter((r: any) => t(r) >= monthStart)
        .reduce((a: number, r: any) => a + Number(r.commission_amount), 0),
      lastMonth: mine.filter((r: any) => t(r) >= lastMonthStart && t(r) < monthStart)
        .reduce((a: number, r: any) => a + Number(r.commission_amount), 0),
      total: mine.reduce((a: number, r: any) => a + Number(r.commission_amount), 0),
      totalSales: mine.reduce((a: number, r: any) => a + Number(r.sale_amount), 0),
      sessions,
    };
  }).sort((a: any, b: any) => b.total - a.total);
}
