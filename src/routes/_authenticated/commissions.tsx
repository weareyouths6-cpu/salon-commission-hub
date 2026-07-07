import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtMMK, fmtDate, CATEGORY_LABEL, fmtNum } from "@/lib/format";
import { exportCSV, exportXLSX, exportPDF } from "@/lib/exports";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/commissions")({
  component: CommissionsPage,
});

type Row = {
  id: string;
  invoice_date: string;
  invoice_no: string;
  invoice_id: string;
  customer: string;
  stylist_name: string | null;
  assistant_name: string | null;
  category: string;
  item_name: string;
  sale_amount: number;
  stylist_percent: number | null;
  stylist_commission: number | null;
  staff_percent: number | null;
  staff_commission: number | null;
  status: string;
};

function CommissionsPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [drillId, setDrillId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["commissions-table", from, to],
    queryFn: async () => {
      let iq = supabase.from("invoices").select(`
        id, invoice_no, invoice_date, payment_status, total,
        customer:customers(name),
        stylist:stylists(id, name),
        assistant:assistants(id, name),
        invoice_items(id, item_type, name, line_total)
      `).order("invoice_date", { ascending: false });
      if (from) iq = iq.gte("invoice_date", from);
      if (to) iq = iq.lte("invoice_date", to);
      const { data: invs, error } = await iq;
      if (error) throw error;

      const { data: recs } = await supabase.from("commission_records").select("*");
      const recMap = new Map<string, any[]>();
      for (const r of recs ?? []) {
        const arr = recMap.get(r.invoice_item_id) ?? [];
        arr.push(r);
        recMap.set(r.invoice_item_id, arr);
      }

      const rows: Row[] = [];
      for (const inv of invs ?? []) {
        for (const it of inv.invoice_items ?? []) {
          const rs = recMap.get(it.id) ?? [];
          const st = rs.find((r) => r.employee_role === "stylist");
          const as = rs.find((r) => r.employee_role === "assistant");
          rows.push({
            id: it.id,
            invoice_date: inv.invoice_date,
            invoice_no: inv.invoice_no,
            invoice_id: inv.id,
            customer: inv.customer?.name ?? "",
            stylist_name: inv.stylist?.name ?? null,
            assistant_name: inv.assistant?.name ?? null,
            category: it.item_type,
            item_name: it.name,
            sale_amount: Number(it.line_total),
            stylist_percent: st ? Number(st.commission_percent) : null,
            stylist_commission: st ? Number(st.commission_amount) : null,
            staff_percent: as ? Number(as.commission_percent) : null,
            staff_commission: as ? Number(as.commission_amount) : null,
            status: inv.payment_status,
          });
        }
      }
      return rows;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return q.data ?? [];
    return (q.data ?? []).filter((r) =>
      [r.invoice_no, r.customer, r.stylist_name, r.assistant_name, r.item_name]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [q.data, search]);

  const exportRows = filtered.map((r) => ({
    Date: r.invoice_date, Invoice: r.invoice_no, Customer: r.customer,
    Stylist: r.stylist_name ?? "", Assistant: r.assistant_name ?? "",
    Category: CATEGORY_LABEL[r.category] ?? r.category, Item: r.item_name,
    Amount: r.sale_amount, "Stylist %": r.stylist_percent ?? "",
    "Stylist Commission": r.stylist_commission ?? "",
    "Assistant %": r.staff_percent ?? "",
    "Assistant Commission": r.staff_commission ?? "",
    Status: r.status,
  }));

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Commissions</h1>
          <p className="text-sm text-muted-foreground">Every invoice item and its calculated commission</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("commissions", exportRows)}><Download className="w-3.5 h-3.5 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportXLSX("commissions", exportRows)}>Excel</Button>
          <Button size="sm" variant="outline" onClick={() => exportPDF("commissions", "Commissions", exportRows)}>PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <Input placeholder="Search invoice, customer, stylist, assistant, item…" className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                {["Date","Invoice","Customer","Stylist","Assistant","Category","Item","Amount","Stylist %","Stylist Comm.","Asst %","Asst Comm.","Status"].map((h) => (
                  <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setDrillId(r.invoice_id)}>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                  <td className="px-3 py-2 font-medium">{r.invoice_no}</td>
                  <td className="px-3 py-2">{r.customer}</td>
                  <td className="px-3 py-2">{r.stylist_name ?? "-"}</td>
                  <td className="px-3 py-2">{r.assistant_name ?? "-"}</td>
                  <td className="px-3 py-2">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                  <td className="px-3 py-2">{r.item_name}</td>
                  <td className="px-3 py-2 text-right">{fmtMMK(r.sale_amount)}</td>
                  <td className="px-3 py-2 text-right">{r.stylist_percent != null ? fmtNum(r.stylist_percent) + "%" : "-"}</td>
                  <td className="px-3 py-2 text-right">{r.stylist_commission != null ? fmtMMK(r.stylist_commission) : "-"}</td>
                  <td className="px-3 py-2 text-right">{r.staff_percent != null ? fmtNum(r.staff_percent) + "%" : "-"}</td>
                  <td className="px-3 py-2 text-right">{r.staff_commission != null ? fmtMMK(r.staff_commission) : "-"}</td>
                  <td className="px-3 py-2"><Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status}</Badge></td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={13} className="text-center py-10 text-muted-foreground">No commission records</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <InvoiceDrillDialog invoiceId={drillId} onClose={() => setDrillId(null)} />
    </div>
  );
}

function InvoiceDrillDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["invoice-drill", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data: inv } = await supabase.from("invoices").select(`
        *, customer:customers(name), stylist:stylists(name), assistant:assistants(name),
        invoice_items(*)
      `).eq("id", invoiceId!).single();
      const { data: recs } = await supabase.from("commission_records").select("*").eq("invoice_id", invoiceId!);
      return { inv, recs: recs ?? [] };
    },
  });

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Invoice {q.data?.inv?.invoice_no}</DialogTitle></DialogHeader>
        {q.data?.inv && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Date: </span>{fmtDate(q.data.inv.invoice_date)}</div>
              <div><span className="text-muted-foreground">Customer: </span>{q.data.inv.customer?.name}</div>
              <div><span className="text-muted-foreground">Stylist: </span>{q.data.inv.stylist?.name ?? "-"}</div>
              <div><span className="text-muted-foreground">Assistant: </span>{q.data.inv.assistant?.name ?? "-"}</div>
              <div><span className="text-muted-foreground">Status: </span>{q.data.inv.payment_status}</div>
              <div><span className="text-muted-foreground">Total: </span>{fmtMMK(q.data.inv.total)}</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase">
                <tr>{["Item","Category","Amount","Role","%","Commission"].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr>
              </thead>
              <tbody>
                {q.data.inv.invoice_items.flatMap((it: any) => {
                  const rs = q.data!.recs.filter((r: any) => r.invoice_item_id === it.id);
                  if (!rs.length) return [
                    <tr key={it.id} className="border-t"><td className="px-2 py-1">{it.name}</td><td className="px-2 py-1">{CATEGORY_LABEL[it.item_type]}</td><td className="px-2 py-1">{fmtMMK(it.line_total)}</td><td colSpan={3} className="text-muted-foreground px-2 py-1">no commission</td></tr>
                  ];
                  return rs.map((r: any, idx: number) => (
                    <tr key={r.id} className="border-t">
                      {idx === 0 ? (<>
                        <td className="px-2 py-1" rowSpan={rs.length}>{it.name}</td>
                        <td className="px-2 py-1" rowSpan={rs.length}>{CATEGORY_LABEL[it.item_type]}</td>
                        <td className="px-2 py-1" rowSpan={rs.length}>{fmtMMK(it.line_total)}</td>
                      </>) : null}
                      <td className="px-2 py-1 capitalize">{r.employee_role}</td>
                      <td className="px-2 py-1">{fmtNum(r.commission_percent)}%</td>
                      <td className="px-2 py-1">{fmtMMK(r.commission_amount)}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
