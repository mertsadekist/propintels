import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/admin/analytics/analytics-dashboard";

export const metadata = { title: "Market Analytics" };

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canAccess =
    session.user.roles.includes("ADMIN") || session.user.roles.includes("MANAGER");

  if (!canAccess) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Market Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          DLD transaction data — price trends, area comparisons, and market reports
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
