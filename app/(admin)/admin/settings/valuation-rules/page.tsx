"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { Loader2 } from "lucide-react";

const rulesSchema = z.object({
  areaTolerancePct: z.coerce.number().int().min(5).max(50),
  outlierMethod: z.enum(["trim10", "iqr"]),
  minComps: z.coerce.number().int().min(1).max(20),
  benchmark: z.enum(["transactionMedianPsf", "listingMedianPsf"]),
  below_market: z.coerce.number().min(0.5).max(1),
  aligned_max: z.coerce.number().min(0.9).max(1.2),
  slightly_above_max: z.coerce.number().min(1).max(2),
});

type RulesValues = z.infer<typeof rulesSchema>;

export default function ValuationRulesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<RulesValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(rulesSchema) as any,
    defaultValues: {
      areaTolerancePct: 15,
      outlierMethod: "trim10",
      minComps: 3,
      benchmark: "transactionMedianPsf",
      below_market: 0.95,
      aligned_max: 1.03,
      slightly_above_max: 1.10,
    },
  });

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/settings/valuation-rules");
      if (res.ok) {
        const json = await res.json();
        const { thresholds, ...rest } = json.data;
        form.reset({ ...rest, ...thresholds });
      }
      setIsLoading(false);
    }
    load();
  }, [form]);

  async function onSubmit(values: RulesValues) {
    setIsSaving(true);
    try {
      const { below_market, aligned_max, slightly_above_max, ...rest } = values;
      const res = await fetch("/api/settings/valuation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          thresholds: { below_market, aligned_max, slightly_above_max },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Valuation rules saved");
    } catch {
      toast.error("Failed to save rules");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Valuation Rules"
        description="Configure the parameters used by the valuation engine"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">Comparable Matching</CardTitle>
              <CardDescription>How comparables are selected for each valuation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="areaTolerancePct" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area Tolerance (%)</FormLabel>
                    <FormControl><Input type="number" min={5} max={50} {...field} /></FormControl>
                    <FormDescription>±{form.watch("areaTolerancePct")}% from subject area</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="minComps" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Comparables</FormLabel>
                    <FormControl><Input type="number" min={1} max={20} {...field} /></FormControl>
                    <FormDescription>Below this → INSUFFICIENT_DATA</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="outlierMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outlier Removal Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="trim10">Trim 10% (top + bottom)</SelectItem>
                        <SelectItem value="iqr">IQR Method</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="benchmark" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Benchmark</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="transactionMedianPsf">Transaction Median PSF</SelectItem>
                        <SelectItem value="listingMedianPsf">Listing Median PSF</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">Verdict Thresholds</CardTitle>
              <CardDescription>clientPsf ÷ benchmarkPsf ratio determines the verdict</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="below_market" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Below Market (max ratio)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormDescription>e.g. 0.95 = below 95%</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="aligned_max" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aligned (max ratio)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormDescription>e.g. 1.03 = within 3% above</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="slightly_above_max" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slightly Above (max ratio)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormDescription>e.g. 1.10 = within 10% above</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Visual guide */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
                <div>🔵 <strong>BELOW_MARKET</strong>: ratio &lt; {form.watch("below_market")}</div>
                <div>🟢 <strong>ALIGNED</strong>: {form.watch("below_market")} – {form.watch("aligned_max")}</div>
                <div>🟡 <strong>SLIGHTLY_ABOVE</strong>: {form.watch("aligned_max")} – {form.watch("slightly_above_max")}</div>
                <div>🔴 <strong>ABOVE_MARKET</strong>: ratio &gt; {form.watch("slightly_above_max")}</div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Rules"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
