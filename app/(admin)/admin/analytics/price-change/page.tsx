import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { PriceChangePage } from "@/components/admin/analytics/price-change-page";

export const metadata = { title: "Price Changes — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Changes</h1>
        <p className="text-sm text-gray-500 mt-1">
          YoY and QoQ price appreciation by area and project — heatmap, gainers/losers, and appreciation index
        </p>
      </div>
      <PriceChangePage />
    </div>
  );
}
