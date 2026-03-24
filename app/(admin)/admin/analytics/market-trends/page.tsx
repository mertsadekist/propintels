import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { MarketTrendsPage } from "@/components/admin/analytics/market-trends-page";

export const metadata = { title: "Market Trends — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Market Trends</h1>
        <p className="text-sm text-gray-500 mt-1">
          Weekly and quarterly PSF trends — area drill-down and time-series analysis
        </p>
      </div>
      <MarketTrendsPage />
    </div>
  );
}
