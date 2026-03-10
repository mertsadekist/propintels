import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function WizardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="bg-[#0B1F3B] py-4 px-4">
        <div className="max-w-lg mx-auto">
          <Skeleton className="h-6 w-32 bg-white/20" />
          <Skeleton className="h-4 w-48 bg-white/10 mt-1" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="flex justify-between mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-2 flex-1 mx-1 rounded-full" />
          ))}
        </div>
        <Card>
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-3" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
