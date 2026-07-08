import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtMMK, fmtDate, CATEGORY_LABEL, SOURCE_LABEL } from "@/lib/format";
import { exportCSV, exportXLSX, exportPDF } from "@/lib/exports";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type Period = "daily" | "weekly" | "monthly" | "yearly" | "custom";

function ReportsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { fromDate, toDate } = rangeFor(period, from, to);

  const q = useQuery({
    queryKey: ["report", fromDate, toDate],
    queryFn: async () => {
      const { data: recs } = await supabase
        .from("commission_records")
        .select("*")
        .gte("event_date", fromDate).lte("event_date", toDate + "T23:59:59")
        .order("event_date", { ascending: false });
      const empIds = [...new Set((recs ?? []).map((r) => r.employee_id))];
      const cpIds = [...new Set((recs ?? []).map((r) => r.customer_package_id).filter(Boolean) as string[])];
      const [profR, cpR] = await Promise.all([
        empIds.length ? supabase.from("profiles").select("id, name, email").in("id", empIds) : Promise.resolve({ data: [] as any[] }),
        cpIds.length ? supabase.from("customer_packages").select("id, package:packages(name)").in("id", cpIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const nm = new Map<string, string>((profR.data ?? []).map((p: any) => [p.id, p.name ?? p.email ?? ""]));
      const pm = new Map<string, string>((cpR.data ?? []).map((c: any) => [c.id, c.package?.name ?? ""]));
      return (recs ?? []).map((r) => ({
        ...r,
        employee_name: nm.get(r.employee_id) ?? "",
        package_name: r.customer_package_id ? pm.get(r.customer_package_id) ?? "" : "",
      }));
    },
  });

  const total = (q.data ?? []).reduce((a, r) => a + Number(r.commission_amount), 0);

  const rows = (q.data ?? []).map((r) => ({
    Date: fmtDate(r.event_date), Source: SOURCE_LABEL[r.source_type] ?? r.source_type,
    Package: r.package_name, Employee: r.employee_name, Role: r.employee_role,
    Category: CATEGORY_LABEL[r.category] ?? r.category,
    Sale: r.sale_amount, "%": r.commission_percent, Commission: r.commission_amount,
  }));

  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Commission reports and exports</p>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          {(["daily","weekly","monthly","yearly","custom"] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)} className="capitalize">{p}</Button>
          ))}
          {period === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="max-w-[180px]" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="max-w-[180px]" />
            </>
          )}
          <div className="text-sm text-muted-foreground ml-2">{fmtDate(fromDate)} — {fmtDate(toDate)}</div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportCSV(`report_${fromDate}_${toDate}`, rows)}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
            <Button size="sm" variant="outline" onClick={() => exportXLSX(`report_${fromDate}_${toDate}`, rows)}>Excel</Button>
            <Button size="sm" variant="outline" onClick={() => exportPDF(`report_${fromDate}_${toDate}`, `Commission Report ${fromDate}—${toDate}`, rows)}>PDF</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex justify-between">
          <div><div className="text-xs text-muted-foreground">Records</div><div className="text-xl font-semibold">{q.data?.length ?? 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Total Commission</div><div className="text-xl font-semibold">{fmtMMK(total)}</div></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>{["Date","Source","Package","Employee","Role","Category","Sale","%","Commission"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{fmtDate(r.event_date)}</td>
                  <td className="px-3 py-2">{SOURCE_LABEL[r.source_type] ?? r.source_type}</td>
                  <td className="px-3 py-2">{r.package_name}</td>
                  <td className="px-3 py-2">{r.employee_name}</td>
                  <td className="px-3 py-2 capitalize">{r.employee_role}</td>
                  <td className="px-3 py-2">{CATEGORY_LABEL[r.category]}</td>
                  <td className="px-3 py-2 text-right">{fmtMMK(r.sale_amount)}</td>
                  <td className="px-3 py-2 text-right">{r.commission_percent}%</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMMK(r.commission_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function rangeFor(p: Period, from: string, to: string) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "daily") return { fromDate: iso(now), toDate: iso(now) };
  if (p === "weekly") { const d = new Date(now); d.setDate(d.getDate() - 6); return { fromDate: iso(d), toDate: iso(now) }; }
  if (p === "monthly") { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { fromDate: iso(d), toDate: iso(now) }; }
  if (p === "yearly") { const d = new Date(now.getFullYear(), 0, 1); return { fromDate: iso(d), toDate: iso(now) }; }
  return { fromDate: from || "1970-01-01", toDate: to || iso(now) };
}
