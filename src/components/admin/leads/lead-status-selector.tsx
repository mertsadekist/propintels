"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const STATUSES = [
  { value: "NEW", label: "New", color: "text-blue-600" },
  { value: "CONTACTED", label: "Contacted", color: "text-yellow-600" },
  { value: "QUALIFIED", label: "Qualified", color: "text-purple-600" },
  { value: "APPOINTMENT_SET", label: "Appointment Set", color: "text-orange-600" },
  { value: "WON", label: "Won", color: "text-green-600" },
  { value: "LOST", label: "Lost", color: "text-red-600" },
  { value: "ARCHIVED", label: "Archived", color: "text-gray-500" },
];

interface Props {
  leadId: string;
  currentStatus: string;
}

export function LeadStatusSelector({ leadId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const hasChanged = status !== currentStatus;

  async function handleSave() {
    if (!hasChanged) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success("Lead status updated");
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-3">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span className={s.color}>{s.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasChanged && (
        <Button
          size="sm"
          className="w-full"
          onClick={handleSave}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving...</>
          ) : (
            "Save Status"
          )}
        </Button>
      )}
    </div>
  );
}
