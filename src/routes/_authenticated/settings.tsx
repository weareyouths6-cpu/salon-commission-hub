import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateCommissionSettings, resetCommissionDefaults } from "@/lib/commission.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABEL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const updFn = useServerFn(updateCommissionSettings);
  const resetFn = useServerFn(resetCommissionDefaults);
  const [rows, setRows] = useState<Array<{ category: string; stylist_percent: number; staff_percent: number }>>([]);

  const q = useQuery({
    queryKey: ["commission-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_settings").select("*").order("category");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (q.data) setRows(q.data.map((r) => ({
      category: r.category, stylist_percent: Number(r.stylist_percent), staff_percent: Number(r.staff_percent),
    })));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => updFn({ data: { updates: rows } }),
    onSuccess: () => { toast.success("Settings saved. New invoices will use these values."); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({}),
    onSuccess: () => { toast.success("Reset to defaults"); qc.invalidateQueries({ queryKey: ["commission-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Commission Settings</h1>
        <p className="text-sm text-muted-foreground">Changes affect future calculations only. Existing records are preserved.</p>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr><th className="px-4 py-2">Category</th><th className="px-4 py-2">Stylist %</th><th className="px-4 py-2">Assistant %</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.category} className="border-t">
                  <td className="px-4 py-2 font-medium">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                  <td className="px-4 py-2"><Input type="number" step="0.01" value={r.stylist_percent} onChange={(e) => {
                    const copy = [...rows]; copy[i] = { ...copy[i], stylist_percent: Number(e.target.value) }; setRows(copy);
                  }} className="max-w-[120px]" /></td>
                  <td className="px-4 py-2"><Input type="number" step="0.01" value={r.staff_percent} onChange={(e) => {
                    const copy = [...rows]; copy[i] = { ...copy[i], staff_percent: Number(e.target.value) }; setRows(copy);
                  }} className="max-w-[120px]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        <Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>Reset to Defaults</Button>
      </div>
    </div>
  );
}
