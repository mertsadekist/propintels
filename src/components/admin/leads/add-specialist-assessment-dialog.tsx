"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SpecialistAssessment {
  id: string;
  estimatedPrice: number | string;
  estimatedPsf: number | string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  specialist: { id: string; name: string; email: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  areaSqft: number;
  existing: SpecialistAssessment | null;
  onSaved: (assessment: SpecialistAssessment) => void;
}

export function AddSpecialistAssessmentDialog({
  open,
  onOpenChange,
  leadId,
  areaSqft,
  existing,
  onSaved,
}: Props) {
  const [price, setPrice] = useState(
    existing ? String(Number(existing.estimatedPrice)) : ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens with existing data
  useEffect(() => {
    if (open) {
      setPrice(existing ? String(Math.round(Number(existing.estimatedPrice))) : "");
      setNotes(existing?.notes ?? "");
    }
  }, [open, existing]);

  const priceNum = parseFloat(price.replace(/,/g, ""));
  const psf = areaSqft > 0 && !isNaN(priceNum) ? Math.round(priceNum / areaSqft) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid estimated price");
      return;
    }
    if (!notes.trim()) {
      toast.error("Please add assessment notes");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/specialist-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedPrice: priceNum, notes: notes.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to save assessment");
        return;
      }

      toast.success("Assessment saved successfully");
      onSaved(json.data);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Specialist Assessment" : "Add Specialist Assessment"}
          </DialogTitle>
          <DialogDescription>
            Enter your market study estimate and supporting notes for this property.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="estimated-price">Estimated Price (AED)</Label>
            <Input
              id="estimated-price"
              type="number"
              placeholder="e.g. 1,850,000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={0}
              step={1000}
              required
            />
            {psf !== null && (
              <p className="text-xs text-gray-500">
                ≈ {psf.toLocaleString()} AED/sqft
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Assessment Notes</Label>
            <Textarea
              id="notes"
              placeholder="Describe your reasoning: market conditions, comparable projects, view premium, finishing quality, demand level…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              maxLength={2000}
              required
            />
            <p className="text-xs text-gray-400 text-right">
              {notes.length}/2000
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : existing ? "Update Assessment" : "Save Assessment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
