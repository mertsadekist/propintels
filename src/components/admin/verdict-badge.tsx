import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VERDICT_LABELS } from "@/lib/constants";

export type VerdictLabel = keyof typeof VERDICT_LABELS;

interface VerdictBadgeProps {
  verdict: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VERDICT_STYLES: Record<string, string> = {
  BELOW_MARKET: "bg-blue-100 text-blue-800 border-blue-200",
  ALIGNED: "bg-green-100 text-green-800 border-green-200",
  SLIGHTLY_ABOVE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ABOVE_MARKET: "bg-red-100 text-red-800 border-red-200",
  INSUFFICIENT_DATA: "bg-gray-100 text-gray-800 border-gray-200",
};

const SIZE_STYLES: Record<string, string> = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1.5 font-semibold",
};

export function VerdictBadge({ verdict, size = "sm", className }: VerdictBadgeProps) {
  const label = VERDICT_LABELS[verdict as VerdictLabel] ?? verdict;
  const style = VERDICT_STYLES[verdict] ?? "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <Badge
      variant="outline"
      className={cn(style, SIZE_STYLES[size], "font-medium", className)}
    >
      {label}
    </Badge>
  );
}
