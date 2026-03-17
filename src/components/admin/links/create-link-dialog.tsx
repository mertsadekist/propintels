"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

export function CreateLinkDialog({ open, onOpenChange, projectId, onSuccess }: Props) {
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<{
    token: string;
    publicUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label || undefined,
          maxUses: maxUses ? parseInt(maxUses) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create link");

      const json = await res.json();
      setCreatedLink({
        token: json.data.token,
        publicUrl: json.data.publicUrl,
      });
      onSuccess?.();
    } catch {
      toast.error("Failed to create link");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for HTTP (non-secure contexts)
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function copyUrl() {
    if (!createdLink) return;
    try {
      await copyToClipboard(createdLink.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("URL copied!");
    } catch {
      toast.error("Failed to copy URL");
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setLabel("");
      setMaxUses("");
      setExpiresAt("");
      setCreatedLink(null);
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Valuation Link</DialogTitle>
        </DialogHeader>

        {!createdLink ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input
                placeholder="e.g. Instagram Campaign"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max Uses (optional)</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expires On (optional)</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Link"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              ✅ Link created! Copy the URL below — this is the only time you&apos;ll see it.
            </div>

            <div className="space-y-1.5">
              <Label>Public Valuation URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createdLink.publicUrl}
                  className="text-xs font-mono"
                />
                <Button size="sm" variant="outline" onClick={copyUrl}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => window.open(createdLink.publicUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Preview
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
