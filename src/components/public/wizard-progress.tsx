import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  key: string;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: string;
  className?: string;
}

export function WizardProgress({ steps, currentStep, className }: Props) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  isDone && "bg-green-500 border-green-500 text-white",
                  isCurrent && "bg-[#0B1F3B] border-[#0B1F3B] text-white",
                  !isDone && !isCurrent && "bg-white border-gray-300 text-gray-400"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  (isDone || isCurrent) ? "text-gray-700" : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-14px]",
                  isDone ? "bg-green-500" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
