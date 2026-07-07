import { createFileRoute, Link } from "@tanstack/react-router";
import { EmployeeDetail } from "@/components/employee-detail";

export const Route = createFileRoute("/_authenticated/stylists/$id")({
  component: () => {
    const { id } = Route.useParams();
    return (
      <div className="p-8 space-y-4">
        <Link to="/stylists" className="text-sm text-primary hover:underline">← Back to stylists</Link>
        <EmployeeDetail employeeId={id} role="stylist" />
      </div>
    );
  },
});
