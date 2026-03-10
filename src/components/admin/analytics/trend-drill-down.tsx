"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Project {
  id: string;
  name: string;
}

interface TopArea {
  area: string;
  txnCount: number;
}

interface Props {
  topAreas: TopArea[];
  onApply: (area: string, projectId: string) => void;
  onClear: () => void;
}

export function TrendDrillDown({ topAreas, onApply, onClear }: Props) {
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (!selectedArea) {
      setProjects([]);
      setSelectedProject("");
      return;
    }
    setLoadingProjects(true);
    setSelectedProject("");
    fetch(`/api/analytics/projects?area=${encodeURIComponent(selectedArea)}`)
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []))
      .catch(console.error)
      .finally(() => setLoadingProjects(false));
  }, [selectedArea]);

  const handleApply = () => {
    if (selectedArea) onApply(selectedArea, selectedProject);
  };

  const handleClear = () => {
    setSelectedArea("");
    setSelectedProject("");
    setProjects([]);
    onClear();
  };

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-3">
      <div className="text-xs font-semibold text-gray-600 self-center whitespace-nowrap">
        Drill down:
      </div>

      {/* Area select */}
      <div className="space-y-1 min-w-[180px]">
        <Label className="text-xs text-gray-500">Area</Label>
        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select area…" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {topAreas.map((a) => (
              <SelectItem key={a.area} value={a.area} className="text-xs">
                {a.area}
                <span className="ml-1 text-gray-400">({a.txnCount} txns)</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project select */}
      <div className="space-y-1 min-w-[200px]">
        <Label className="text-xs text-gray-500">Project (optional)</Label>
        <Select
          value={selectedProject}
          onValueChange={setSelectedProject}
          disabled={!selectedArea || loadingProjects}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={
                !selectedArea
                  ? "Select area first"
                  : loadingProjects
                  ? "Loading…"
                  : projects.length === 0
                  ? "No projects found"
                  : "All projects"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={handleApply}
          disabled={!selectedArea}
        >
          Apply
        </Button>
        {selectedArea && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleClear}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
