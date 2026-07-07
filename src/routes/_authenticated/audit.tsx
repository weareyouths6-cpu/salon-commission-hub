import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate, CATEGORY_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

function AuditPage() {
  const q = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data } = await supabase.from("commission_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">History of commission setting changes and recalculations</p>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>{["When","Action","Category","Old (Stylist / Staff)","New (Stylist / Staff)","Notes"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">{r.category ? (CATEGORY_LABEL[r.category] ?? r.category) : "-"}</td>
                  <td className="px-3 py-2">{r.old_stylist_percent != null ? `${r.old_stylist_percent}% / ${r.old_staff_percent}%` : "-"}</td>
                  <td className="px-3 py-2">{r.new_stylist_percent != null ? `${r.new_stylist_percent}% / ${r.new_staff_percent}%` : "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes ?? "-"}</td>
                </tr>
              ))}
              {!q.data?.length && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No audit entries</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
