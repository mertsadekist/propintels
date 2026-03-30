import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { PriceForecastPage } from "@/components/admin/analytics/price-forecast-page";

export const metadata = { title: "Price Forecast — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Forecast</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analyze price per sqft / sqm over time for any area or building — and project the trend into upcoming quarters
        </p>
      </div>
      <PriceForecastPage />
    </div>
  );
}
