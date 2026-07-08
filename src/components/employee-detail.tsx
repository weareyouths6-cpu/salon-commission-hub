import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMMK, fmtNum, CATEGORY_LABEL, SOURCE_LABEL } from "@/lib/format";

type Range = "today" | "yesterday" | "week" | "month" | "custom";

export function EmployeeDetail({ employeeId, role }: { employeeId: string; role: "stylist" | "staff" }) {
  const [range, setRange] = useState<Range>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { fromDate, toDate } = computeRange(range, from, to);

  const q = useQuery({
    queryKey: ["employee-detail", employeeId, role, fromDate, toDate],
    queryFn: async () => {
      const { data: emp } = await supabase.from("profiles").select("name, email").eq("id", employeeId).single();
      const { data: recs } = await supabase
        .from("commission_records")
        .select("id, event_date, source_type, category, sale_amount, commission_percent, commission_amount, customer_package_id")
        .eq("employee_id", employeeId).eq("employee_role", role)
        .gte("event_date", fromDate)
        .lte("event_date", toDate + "T23:59:59")
        .order("event_date", { ascending: false });
      const cpIds = [...new Set((recs ?? []).map((r) => r.customer_package_id).filter(Boolean) as string[])];
      const { data: cps } = cpIds.length
        ? await supabase.from("customer_packages").select("id, customer_id, package:packages(name)").in("id", cpIds)
        : { data: [] as any[] };
      const cpMap = new Map<string, any>((cps ?? []).map((c: any) => [c.id, c]));
      const custIds = [...new Set((cps ?? []).map((c: any) => c.customer_id).filter(Boolean))];
      const { data: custs } = custIds.length
        ? await supabase.from("profiles").select("id, name, email").in("id", custIds)
        : { data: [] as any[] };
      const custMap = new Map<string, any>((custs ?? []).map((c: any) => [c.id, c]));
      return {
        emp,
        recs: (recs ?? []).map((r) => {
          const cp = r.customer_package_id ? cpMap.get(r.customer_package_id) : null;
          const cust = cp ? custMap.get(cp.customer_id) : null;
          return {
            ...r,
            package_name: cp?.package?.name ?? "—",
            customer_name: cust?.name ?? cust?.email ?? "—",
          };
        }),
      };
    },
  });

  let running = 0;
  const rows = (q.data?.recs ?? []).map((r) => {
    running += Number(r.commission_amount);
    return { ...r, running };
  });
  const total = running;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{q.data?.emp?.name ?? q.data?.emp?.email ?? "…"}</h1>
        <p className="text-sm text-muted-foreground capitalize">{role} detail</p>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          {(["today","yesterday","week","month","custom"] as const).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)} className="capitalize">
              {r === "week" ? "This Week" : r === "month" ? "This Month" : r}
            </Button>
          ))}
          {range === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="max-w-[180px]" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="max-w-[180px]" />
            </>
          )}
          <div className="ml-auto text-sm">Total: <span className="font-semibold">{fmtMMK(total)}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>{["Date","Source","Category","Package","Customer","Sale","%","Commission","Running"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{fmtDate(r.event_date)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={r.source_type === "sale" ? "default" : "secondary"}>
                      {SOURCE_LABEL[r.source_type] ?? r.source_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                  <td className="px-3 py-2 font-medium">{r.package_name}</td>
                  <td className="px-3 py-2">{r.customer_name}</td>
                  <td className="px-3 py-2 text-right">{fmtMMK(r.sale_amount)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(r.commission_percent)}%</td>
                  <td className="px-3 py-2 text-right">{fmtMMK(r.commission_amount)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMMK(r.running)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No records in this range</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function computeRange(range: Range, from: string, to: string) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "today") return { fromDate: iso(now), toDate: iso(now) };
  if (range === "yesterday") { const d = new Date(now); d.setDate(d.getDate() - 1); return { fromDate: iso(d), toDate: iso(d) }; }
  if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 6); return { fromDate: iso(d), toDate: iso(now) }; }
  if (range === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { fromDate: iso(d), toDate: iso(now) }; }
  return { fromDate: from || "1970-01-01", toDate: to || iso(now) };
}
