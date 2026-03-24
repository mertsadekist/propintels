import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/auth.config";
import { redirect } from "next/navigation";
import { VolumeTrackerPage } from "@/components/admin/analytics/volume-tracker-page";

export const metadata = { title: "Volume Tracker — Analytics" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.roles.includes("ADMIN") && !session.user.roles.includes("MANAGER")) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volume Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monthly transaction counts, total AED volume, and activity calendar heatmap
        </p>
      </div>
      <VolumeTrackerPage />
    </div>
  );
}
