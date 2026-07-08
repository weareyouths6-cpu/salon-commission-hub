import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generatePayroll, updatePayroll } from "@/lib/commission.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtMMK, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: PayrollPage,
});

function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const qc = useQueryClient();
  const genFn = useServerFn(generatePayroll);
  const updFn = useServerFn(updatePayroll);

  const q = useQuery({
    queryKey: ["payrolls", month, year],
    queryFn: async () => {
      const { data: payrolls } = await supabase.from("payrolls").select("*").eq("month", month).eq("year", year);
      const ids = [...new Set((payrolls ?? []).map((p) => p.employee_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, name, email").in("id", ids)
        : { data: [] as any[] };
      const nameMap = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.name ?? p.email ?? "—"]));
      return (payrolls ?? []).map((p) => ({ ...p, name: nameMap.get(p.employee_id) ?? "Unknown" }));
    },
  });

  const gen = useMutation({
    mutationFn: () => genFn({ data: { month, year } }),
    onSuccess: (r) => { toast.success(`Payroll generated (${r.created} rows)`); qc.invalidateQueries({ queryKey: ["payrolls"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: (v: any) => updFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["payrolls"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Monthly Payroll</h1>
        <p className="text-sm text-muted-foreground">Aggregate monthly commission per employee</p>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="max-w-[100px]" />
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="max-w-[120px]" />
          <Button onClick={() => gen.mutate()} disabled={gen.isPending}>Generate Payroll</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>{["Employee","Role","Total Commission","Bonus","Deduction","Net Pay","Status","Payment Date","Remarks","Action"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 capitalize">{p.employee_role}</td>
                  <td className="px-3 py-2 text-right">{fmtMMK(p.total_commission)}</td>
                  <td className="px-3 py-2"><Input type="number" defaultValue={p.bonus} className="max-w-[120px]" onBlur={(e) => upd.mutate({ id: p.id, bonus: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2"><Input type="number" defaultValue={p.deduction} className="max-w-[120px]" onBlur={(e) => upd.mutate({ id: p.id, deduction: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMMK(p.net_pay)}</td>
                  <td className="px-3 py-2"><Badge variant={p.payment_status === "paid" ? "default" : "secondary"}>{p.payment_status}</Badge></td>
                  <td className="px-3 py-2">{p.payment_date ? fmtDate(p.payment_date) : "-"}</td>
                  <td className="px-3 py-2"><Input defaultValue={p.remarks ?? ""} className="max-w-[160px]" onBlur={(e) => upd.mutate({ id: p.id, remarks: e.target.value })} /></td>
                  <td className="px-3 py-2">
                    {p.payment_status === "paid" ? (
                      <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: p.id, payment_status: "pending" })}>Unmark</Button>
                    ) : (
                      <Button size="sm" onClick={() => upd.mutate({ id: p.id, payment_status: "paid" })}>Mark Paid</Button>
                    )}
                  </td>
                </tr>
              ))}
              {!q.data?.length && <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No payroll yet for this month. Click Generate Payroll.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
