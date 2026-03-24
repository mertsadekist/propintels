import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { ValuationInsightsPage } from "@/components/admin/analytics/valuation-insights-page";

export const metadata = { title: "Valuation Insights — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Valuation Insights</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lead pipeline funnel, verdict distribution, confidence scores, and specialist vs engine comparison
        </p>
      </div>
      <ValuationInsightsPage />
    </div>
  );
}
