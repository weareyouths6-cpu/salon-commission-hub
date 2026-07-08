import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { fmtMMK } from "@/lib/format";
import { ChevronRight } from "lucide-react";
import { buildEmployeeSummary } from "@/lib/employee-summary";

export const Route = createFileRoute("/_authenticated/stylists")({
  component: StylistsPage,
});

function StylistsPage() {
  const q = useQuery({
    queryKey: ["stylist-summary"],
    queryFn: () => buildEmployeeSummary(supabase, "stylist"),
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
                  <Stat label="Sessions" v={String(s.sessions)} plain />
                  <Stat label="Total Comm." v={s.total} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!q.data?.length && (
          <div className="col-span-full text-center py-16 text-muted-foreground">No stylists found.</div>
        )}
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
