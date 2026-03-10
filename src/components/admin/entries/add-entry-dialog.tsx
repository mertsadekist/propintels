"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const PROPERTY_TYPES = [
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
  "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER",
];

const PORTALS = ["Bayut", "PropertyFinder", "Dubizzle", "DXBInteract", "Other"];

const listingSchema = z.object({
  sourceType: z.literal("LISTING"),
  propertyType: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
    "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER"]),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  areaSqft: z.coerce.number().positive(),
  askPrice: z.coerce.number().positive(),
  lowestPrice: z.coerce.number().positive().optional(),
  portal: z.string().optional(),
  locationLabel: z.string().optional(),
  unitType: z.string().optional(),
});

const SQM_TO_SQFT = 10.7639;

const transactionSchema = z.object({
  sourceType: z.literal("TRANSACTION"),
  propertyType: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
    "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER"]),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  transactionAreaSqm: z.coerce.number().positive("Area is required"),
  transactionPrice: z.coerce.number().positive(),
  transactionDate: z.string().optional(),
  portal: z.string().optional(),
  locationLabel: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

export function AddEntryDialog({ open, onOpenChange, projectId, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<"LISTING" | "TRANSACTION">("LISTING");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listingForm = useForm<any>({
    resolver: zodResolver(listingSchema),
    defaultValues: { sourceType: "LISTING" as const, propertyType: "VILLA" as const },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactionForm = useForm<any>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { sourceType: "TRANSACTION" as const, propertyType: "VILLA" as const },
  });

  // Watch sqm value to show live sqft conversion
  const transactionAreaSqm = useWatch({ control: transactionForm.control, name: "transactionAreaSqm" });
  const sqftEquivalent = transactionAreaSqm > 0
    ? (transactionAreaSqm * SQM_TO_SQFT).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : null;

  async function handleSubmit(data: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      // Convert transactionAreaSqm → transactionAreaSqft before sending
      const payload = { ...data };
      if (typeof payload.transactionAreaSqm === "number") {
        payload.transactionAreaSqft = parseFloat(
          (payload.transactionAreaSqm * SQM_TO_SQFT).toFixed(2)
        );
        delete payload.transactionAreaSqm;
      }

      const res = await fetch(`/api/projects/${projectId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message ?? "Failed to add entry");
      }

      toast.success("Entry added successfully");
      onOpenChange(false);
      listingForm.reset();
      transactionForm.reset();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Comparable Entry</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "LISTING" | "TRANSACTION")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="LISTING">Listing</TabsTrigger>
            <TabsTrigger value="TRANSACTION">DLD Transaction</TabsTrigger>
          </TabsList>

          {/* Listing Form */}
          <TabsContent value="LISTING">
            <Form {...listingForm}>
              <form
                onSubmit={listingForm.handleSubmit((d) => handleSubmit(d as Record<string, unknown>))}
                className="space-y-3 mt-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={listingForm.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PROPERTY_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.charAt(0) + t.slice(1).toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={listingForm.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms</FormLabel>
                        <FormControl><Input type="number" min={0} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={listingForm.control}
                    name="areaSqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area (sqft) *</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={listingForm.control}
                    name="askPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ask Price (AED) *</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={listingForm.control}
                    name="lowestPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lowest Price (AED)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={listingForm.control}
                    name="portal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portal</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select portal" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PORTALS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={listingForm.control}
                  name="locationLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-location / Unit Type</FormLabel>
                      <FormControl><Input placeholder="e.g. Corner Unit, Type A" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : "Add Listing"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          {/* Transaction Form */}
          <TabsContent value="TRANSACTION">
            <Form {...transactionForm}>
              <form
                onSubmit={transactionForm.handleSubmit((d) => handleSubmit(d as Record<string, unknown>))}
                className="space-y-3 mt-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={transactionForm.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PROPERTY_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.charAt(0) + t.slice(1).toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transactionForm.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms</FormLabel>
                        <FormControl><Input type="number" min={0} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={transactionForm.control}
                    name="transactionAreaSqm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area (sqm) *</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="e.g. 100" {...field} /></FormControl>
                        {sqftEquivalent && (
                          <p className="text-xs text-gray-400">≈ {sqftEquivalent} sqft</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transactionForm.control}
                    name="transactionPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Price (AED) *</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={transactionForm.control}
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : "Add Transaction"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
