import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Scissors, Clock, Calendar } from "lucide-react";
import { fmtMMK } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const stats = useQuery({
    queryKey: ["dashboard-stats", todayStart],
    queryFn: async () => {
      const [salesToday, cToday, cMonth, staffRoles, stylRoles, unpaid] = await Promise.all([
        // Today's package sales
        supabase.from("customer_packages")
          .select("package:packages(price)")
          .gte("purchase_date", todayStart).lt("purchase_date", tomorrowStart),
        supabase.from("commission_records").select("commission_amount")
          .gte("event_date", todayStart).lt("event_date", tomorrowStart),
        supabase.from("commission_records").select("commission_amount")
          .gte("event_date", monthStart),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "staff"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "stylist"),
        supabase.from("payrolls").select("net_pay").eq("payment_status", "pending"),
      ]);
      const todaysSales = ((salesToday.data ?? []) as any[])
        .reduce((a, r) => a + Number(r.package?.price ?? 0), 0);
      return {
        todaysSales,
        todaysCommission: (cToday.data ?? []).reduce((a, r) => a + Number(r.commission_amount), 0),
        monthlyCommission: (cMonth.data ?? []).reduce((a, r) => a + Number(r.commission_amount), 0),
        totalStaff: staffRoles.count ?? 0,
        totalStylists: stylRoles.count ?? 0,
        pendingPayment: (unpaid.data ?? []).reduce((a, r) => a + Number(r.net_pay), 0),
      };
    },
  });

  const charts = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: async () => {
      const { data: cr } = await supabase
        .from("commission_records")
        .select("event_date, commission_amount, employee_id, employee_role");
      const { data: cps } = await supabase.from("customer_packages")
        .select("purchase_date, package:packages(price)");
      const { data: profiles } = await supabase.from("profiles").select("id, name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["stylist", "staff"]);
      const nameMap = new Map<string, string>((profiles ?? []).map((p) => [p.id, p.name ?? ""]));
      const stylistIds = new Set((roles ?? []).filter((r) => r.role === "stylist").map((r) => r.user_id));
      const staffIds = new Set((roles ?? []).filter((r) => r.role === "staff").map((r) => r.user_id));

      const monthlyMap = new Map<string, { sales: number; commission: number }>();
      for (const r of cps ?? []) {
        const m = (r.purchase_date ?? "").slice(0, 7);
        const c = monthlyMap.get(m) ?? { sales: 0, commission: 0 };
        c.sales += Number((r as any).package?.price ?? 0);
        monthlyMap.set(m, c);
      }
      for (const r of cr ?? []) {
        const m = (r.event_date ?? "").slice(0, 7);
        const c = monthlyMap.get(m) ?? { sales: 0, commission: 0 };
        c.commission += Number(r.commission_amount);
        monthlyMap.set(m, c);
      }
      const monthly = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => ({ month: m, ...v }));

      const totalByEmployee = new Map<string, number>();
      for (const r of cr ?? []) {
        totalByEmployee.set(r.employee_id, (totalByEmployee.get(r.employee_id) ?? 0) + Number(r.commission_amount));
      }
      const topStylists = Array.from(stylistIds)
        .map((id) => ({ name: nameMap.get(id) ?? "—", total: totalByEmployee.get(id) ?? 0 }))
        .sort((a, b) => b.total - a.total).slice(0, 5);
      const topStaff = Array.from(staffIds)
        .map((id) => ({ name: nameMap.get(id) ?? "—", total: totalByEmployee.get(id) ?? 0 }))
        .sort((a, b) => b.total - a.total).slice(0, 5);

      return { monthly, topStylists, topStaff };
    },
  });

  const s = stats.data;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Salon commission overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Today's Sales" value={fmtMMK(s?.todaysSales ?? 0)} color="bg-blue-500" />
        <KpiCard icon={TrendingUp} label="Today's Commission" value={fmtMMK(s?.todaysCommission ?? 0)} color="bg-emerald-500" />
        <KpiCard icon={Calendar} label="Monthly Commission" value={fmtMMK(s?.monthlyCommission ?? 0)} color="bg-indigo-500" />
        <KpiCard icon={Users} label="Total Staff" value={String(s?.totalStaff ?? 0)} color="bg-amber-500" />
        <KpiCard icon={Scissors} label="Total Stylists" value={String(s?.totalStylists ?? 0)} color="bg-rose-500" />
        <KpiCard icon={Clock} label="Pending Payroll" value={fmtMMK(s?.pendingPayment ?? 0)} color="bg-slate-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Monthly Sales</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} />
                <Tooltip formatter={(v: number) => fmtMMK(v)} />
                <Bar dataKey="sales" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Commission Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.data?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} />
                <Tooltip formatter={(v: number) => fmtMMK(v)} />
                <Line type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Stylists</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.topStylists ?? []} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(v: number) => fmtMMK(v)} />
                <Bar dataKey="total" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Staff</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.topStaff ?? []} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(v: number) => fmtMMK(v)} />
                <Bar dataKey="total" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center text-white`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
