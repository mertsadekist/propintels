"use client";

import { useState, useEffect } from "react";
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
import { Loader2, User } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  email: string;
}

interface Props {
  leadId: string;
  currentAgent?: { id: string; name: string; email?: string } | null;
}

export function AssignAgentSection({ leadId, currentAgent }: Props) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(currentAgent?.id ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showSelector, setShowSelector] = useState(!currentAgent);

  useEffect(() => {
    async function loadAgents() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/team?role=AGENT&status=ACTIVE");
        if (res.ok) {
          const json = await res.json();
          setAgents(json.data ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadAgents();
  }, []);

  const hasChanged = selectedAgentId !== (currentAgent?.id ?? "");

  async function handleAssign() {
    if (!selectedAgentId || !hasChanged) return;
    setIsAssigning(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgentId }),
      });

      if (!res.ok) throw new Error("Failed to assign agent");

      toast.success("Agent assigned");
      router.refresh();
    } catch {
      toast.error("Failed to assign agent");
    } finally {
      setIsAssigning(false);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400">Loading agents...</div>;
  }

  if (currentAgent && !showSelector) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-gray-400" />
          <div>
            <div className="font-medium text-gray-800">{currentAgent.name}</div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => setShowSelector(true)}
        >
          Change Agent
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
        <SelectTrigger>
          <SelectValue placeholder="Select an agent..." />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasChanged && selectedAgentId && (
        <Button
          size="sm"
          className="w-full"
          onClick={handleAssign}
          disabled={isAssigning}
        >
          {isAssigning ? (
            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Assigning...</>
          ) : (
            "Assign Agent"
          )}
        </Button>
      )}
    </div>
  );
}
