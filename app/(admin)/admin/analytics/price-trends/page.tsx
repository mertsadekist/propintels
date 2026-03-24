import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { PriceTrendsPage } from "@/components/admin/analytics/price-trends-page";

export const metadata = { title: "Price Trends — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Trends</h1>
        <p className="text-sm text-gray-500 mt-1">
          Absolute AED deal values — monthly price trends, bracket distribution, area ranking and quarterly heatmap
        </p>
      </div>
      <PriceTrendsPage />
    </div>
  );
}
