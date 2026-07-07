import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { fmtMMK } from "@/lib/format";
import { ChevronRight } from "lucide-react";
import { buildEmployeeSummary } from "./stylists";

export const Route = createFileRoute("/_authenticated/assistants")({
  component: AssistantsPage,
});

function AssistantsPage() {
  const q = useQuery({
    queryKey: ["assistant-summary"],
    queryFn: () => buildEmployeeSummary("assistants", "assistant"),
  });
  return (
    <div className="p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Assistants</h1>
        <p className="text-sm text-muted-foreground">Commission summary per assistant / staff</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(q.data ?? []).map((s) => (
          <Link key={s.id} to="/assistants/$id" params={{ id: s.id }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold">{s.name}</div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Today</div><div className="font-medium">{fmtMMK(s.today)}</div></div>
                  <div><div className="text-xs text-muted-foreground">This Month</div><div className="font-medium">{fmtMMK(s.thisMonth)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Total Comm.</div><div className="font-medium">{fmtMMK(s.total)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Invoices</div><div className="font-medium">{s.invoices}</div></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
