import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { PriceMatrixPage } from "@/components/admin/analytics/price-matrix-page";

export const metadata = { title: "Price Matrix — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Matrix</h1>
        <p className="text-sm text-gray-500 mt-1">
          Median PSF / PSM by Area or Project × Bedroom type — colour-coded heatmap
        </p>
      </div>
      <PriceMatrixPage />
    </div>
  );
}
