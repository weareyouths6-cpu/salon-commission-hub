import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMMK, fmtDate, CATEGORY_LABEL, fmtNum, SOURCE_LABEL } from "@/lib/format";
import { exportCSV, exportXLSX, exportPDF } from "@/lib/exports";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/commissions")({
  component: CommissionsPage,
});

type Row = {
  id: string;
  event_date: string;
  source_type: string;
  category: string;
  package_name: string;
  customer_name: string;
  employee_name: string;
  employee_role: string;
  sale_amount: number;
  commission_percent: number;
  commission_amount: number;
};

function CommissionsPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = useQuery({
    queryKey: ["commissions-table", from, to],
    queryFn: async () => {
      let cq = supabase.from("commission_records").select(`
        id, event_date, source_type, category, sale_amount,
        commission_percent, commission_amount, employee_id, employee_role,
        customer_package_id
      `).order("event_date", { ascending: false });
      if (from) cq = cq.gte("event_date", from);
      if (to) cq = cq.lte("event_date", to + "T23:59:59");
      const { data: recs, error } = await cq;
      if (error) throw error;

      const cpIds = [...new Set((recs ?? []).map((r) => r.customer_package_id).filter(Boolean) as string[])];
      const empIds = [...new Set((recs ?? []).map((r) => r.employee_id))];
      const [cpsR, profR] = await Promise.all([
        cpIds.length
          ? supabase.from("customer_packages").select("id, customer_id, package:packages(name)").in("id", cpIds)
          : Promise.resolve({ data: [] as any[] }),
        empIds.length
          ? supabase.from("profiles").select("id, name, email").in("id", empIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cpMap = new Map<string, any>((cpsR.data ?? []).map((c: any) => [c.id, c]));
      const custIds = [...new Set((cpsR.data ?? []).map((c: any) => c.customer_id).filter(Boolean))];
      const { data: custs } = custIds.length
        ? await supabase.from("profiles").select("id, name, email").in("id", custIds)
        : { data: [] as any[] };
      const custMap = new Map<string, any>((custs ?? []).map((c: any) => [c.id, c]));
      const profMap = new Map<string, any>((profR.data ?? []).map((p: any) => [p.id, p]));

      return (recs ?? []).map((r): Row => {
        const cp = r.customer_package_id ? cpMap.get(r.customer_package_id) : null;
        const cust = cp ? custMap.get(cp.customer_id) : null;
        const prof = profMap.get(r.employee_id);
        return {
          id: r.id,
          event_date: r.event_date,
          source_type: r.source_type,
          category: r.category,
          package_name: cp?.package?.name ?? "—",
          customer_name: cust?.name ?? cust?.email ?? "—",
          employee_name: prof?.name ?? prof?.email ?? "—",
          employee_role: r.employee_role,
          sale_amount: Number(r.sale_amount),
          commission_percent: Number(r.commission_percent),
          commission_amount: Number(r.commission_amount),
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return q.data ?? [];
    return (q.data ?? []).filter((r) =>
      [r.package_name, r.customer_name, r.employee_name, r.category, r.source_type]
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [q.data, search]);

  const exportRows = filtered.map((r) => ({
    Date: fmtDate(r.event_date), Source: SOURCE_LABEL[r.source_type] ?? r.source_type,
    Package: r.package_name, Customer: r.customer_name,
    Employee: r.employee_name, Role: r.employee_role,
    Category: CATEGORY_LABEL[r.category] ?? r.category,
    "Sale Amount": r.sale_amount, "%": r.commission_percent,
    Commission: r.commission_amount,
  }));

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Commissions</h1>
          <p className="text-sm text-muted-foreground">
            All commission records — package sales (first-session attribution) and per-session commissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("commissions", exportRows)}><Download className="w-3.5 h-3.5 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportXLSX("commissions", exportRows)}>Excel</Button>
          <Button size="sm" variant="outline" onClick={() => exportPDF("commissions", "Commissions", exportRows)}>PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <Input placeholder="Search customer, package, employee, category…" className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="max-w-[180px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="max-w-[180px]" />
          {(from || to || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setSearch(""); }}>Clear</Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground self-center">{filtered.length} rows</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>
                {["Date","Source","Category","Package","Customer","Employee","Role","Sale","%","Commission"].map((h) => (
                  <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.event_date)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={r.source_type === "sale" ? "default" : "secondary"}>
                      {SOURCE_LABEL[r.source_type] ?? r.source_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                  <td className="px-3 py-2">{r.package_name}</td>
                  <td className="px-3 py-2">{r.customer_name}</td>
                  <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                  <td className="px-3 py-2 capitalize">{r.employee_role}</td>
                  <td className="px-3 py-2 text-right">{fmtMMK(r.sale_amount)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(r.commission_percent)}%</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMMK(r.commission_amount)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No commission records. Run Seed Demo Data or Sync from the Recalculate page.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
