import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { fmtMMK } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stylists")({
  component: StylistsPage,
});

function StylistsPage() {
  const q = useQuery({
    queryKey: ["stylist-summary"],
    queryFn: async () => buildEmployeeSummary("stylists", "stylist"),
  });

  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Stylists</h1>
        <p className="text-sm text-muted-foreground">Commission summary per stylist</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(q.data ?? []).map((s) => (
          <Link key={s.id} to="/stylists/$id" params={{ id: s.id }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold">{s.name}</div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Today" v={s.today} />
                  <Stat label="This Month" v={s.thisMonth} />
                  <Stat label="Last Month" v={s.lastMonth} />
                  <Stat label="Total Sales" v={s.totalSales} />
                  <Stat label="Invoices" v={String(s.invoices)} plain />
                  <Stat label="Total Comm." v={s.total} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, v, plain }: { label: string; v: string | number; plain?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{plain ? v : fmtMMK(v as number)}</div>
    </div>
  );
}

export async function buildEmployeeSummary(table: "stylists" | "assistants", role: "stylist" | "assistant") {
  const { data: emps } = await supabase.from(table).select("id, name");
  const { data: recs } = await supabase.from("commission_records").select("*").eq("employee_role", role);
  const invFieldId = role === "stylist" ? "stylist_id" : "assistant_id";
  const { data: invs } = await supabase.from("invoices").select(`id, ${invFieldId}, total, invoice_date`);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

  return (emps ?? []).map((e) => {
    const myRecs = (recs ?? []).filter((r) => r.employee_id === e.id);
    const myInvs = (invs ?? []).filter((i) => (i as any)[invFieldId] === e.id);
    return {
      id: e.id,
      name: e.name,
      today: myRecs.filter((r) => r.invoice_date === today).reduce((a, r) => a + Number(r.commission_amount), 0),
      thisMonth: myRecs.filter((r) => r.invoice_date >= monthStart).reduce((a, r) => a + Number(r.commission_amount), 0),
      lastMonth: myRecs.filter((r) => r.invoice_date >= lastMonthStart && r.invoice_date < monthStart).reduce((a, r) => a + Number(r.commission_amount), 0),
      total: myRecs.reduce((a, r) => a + Number(r.commission_amount), 0),
      totalSales: myInvs.reduce((a, r) => a + Number(r.total), 0),
      invoices: myInvs.length,
    };
  });
}
