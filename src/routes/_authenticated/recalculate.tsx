import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { recalculateRange, syncCommissions } from "@/lib/commission.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recalculate")({
  component: Recalc,
});

function Recalc() {
  const qc = useQueryClient();
  const recalcFn = useServerFn(recalculateRange);
  const syncFn = useServerFn(syncCommissions);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const recalc = useMutation({
    mutationFn: () => recalcFn({ data: { from, to } }),
    onSuccess: (r) => { toast.success(`Removed ${r.removed}, created ${r.created}`); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: {} }),
    onSuccess: (r) => { toast.success(`Synced. Inserted ${r.inserted} new records.`); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Commission Tools</h1>
        <p className="text-sm text-muted-foreground">Sync missing records or recalculate an existing range using current settings.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Sync missing commissions</h2>
          <p className="text-sm text-muted-foreground">Scans all invoices and inserts commission records for any items that don't have them yet. Safe to run anytime.</p>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>Sync now</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Recalculate range</h2>
          <p className="text-sm text-muted-foreground">Deletes and rebuilds commission records in the selected date range using current percentages. This overwrites history — use with care.</p>
          <div className="flex gap-2 items-end">
            <div><div className="text-xs mb-1">From</div><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><div className="text-xs mb-1">To</div><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive">Recalculate</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recalculate commissions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will DELETE all commission records between {from} and {to} and rebuild them using current settings. An audit log entry will be recorded.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => recalc.mutate()}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
