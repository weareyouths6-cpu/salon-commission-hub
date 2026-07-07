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
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const stats = useQuery({
    queryKey: ["dashboard-stats", today],
    queryFn: async () => {
      const [invToday, cToday, cMonth, staffCnt, stylCnt, pending] = await Promise.all([
        supabase.from("invoices").select("total").eq("invoice_date", today),
        supabase.from("commission_records").select("commission_amount").eq("invoice_date", today),
        supabase.from("commission_records").select("commission_amount").gte("invoice_date", monthStart),
        supabase.from("assistants").select("id", { count: "exact", head: true }),
        supabase.from("stylists").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("total").eq("payment_status", "pending"),
      ]);
      return {
        todaysSales: (invToday.data ?? []).reduce((a, r) => a + Number(r.total), 0),
        todaysCommission: (cToday.data ?? []).reduce((a, r) => a + Number(r.commission_amount), 0),
        monthlyCommission: (cMonth.data ?? []).reduce((a, r) => a + Number(r.commission_amount), 0),
        totalStaff: staffCnt.count ?? 0,
        totalStylists: stylCnt.count ?? 0,
        pendingPayment: (pending.data ?? []).reduce((a, r) => a + Number(r.total), 0),
      };
    },
  });

  const charts = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: async () => {
      const { data: cr } = await supabase
        .from("commission_records")
        .select("invoice_date, commission_amount, employee_id, employee_role");
      const { data: inv } = await supabase.from("invoices").select("invoice_date, total");
      const { data: stylists } = await supabase.from("stylists").select("id, name");
      const { data: assistants } = await supabase.from("assistants").select("id, name");

      const monthlyMap = new Map<string, { sales: number; commission: number }>();
      for (const r of inv ?? []) {
        const m = r.invoice_date.slice(0, 7);
        const c = monthlyMap.get(m) ?? { sales: 0, commission: 0 };
        c.sales += Number(r.total);
        monthlyMap.set(m, c);
      }
      for (const r of cr ?? []) {
        const m = r.invoice_date.slice(0, 7);
        const c = monthlyMap.get(m) ?? { sales: 0, commission: 0 };
        c.commission += Number(r.commission_amount);
        monthlyMap.set(m, c);
      }
      const monthly = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => ({ month: m, ...v }));

      const totalByEmployee = new Map<string, number>();
      for (const r of cr ?? []) {
        const k = `${r.employee_role}::${r.employee_id}`;
        totalByEmployee.set(k, (totalByEmployee.get(k) ?? 0) + Number(r.commission_amount));
      }
      const topStylists = (stylists ?? [])
        .map((s) => ({ name: s.name, total: totalByEmployee.get(`stylist::${s.id}`) ?? 0 }))
        .sort((a, b) => b.total - a.total).slice(0, 5);
      const topAssistants = (assistants ?? [])
        .map((s) => ({ name: s.name, total: totalByEmployee.get(`assistant::${s.id}`) ?? 0 }))
        .sort((a, b) => b.total - a.total).slice(0, 5);

      return { monthly, topStylists, topAssistants };
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
        <KpiCard icon={Clock} label="Pending Payment" value={fmtMMK(s?.pendingPayment ?? 0)} color="bg-slate-600" />
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
          <CardHeader><CardTitle>Top Assistants</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.topAssistants ?? []} layout="vertical">
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
