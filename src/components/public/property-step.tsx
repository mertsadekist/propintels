"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Home, ArrowLeft, Loader2, Calculator } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "DUPLEX", label: "Duplex" },
  { value: "OFFICE", label: "Office" },
  { value: "RETAIL", label: "Retail" },
  { value: "LAND", label: "Land" },
  { value: "OTHER", label: "Other" },
];

const schema = z.object({
  propertyType: z.string().min(1, "Please select property type"),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  areaSqft: z.coerce.number().positive("Area must be greater than 0"),
  clientPrice: z.coerce.number().positive("Price must be greater than 0"),
});

export interface PropertyData {
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft: number;
  clientPrice: number;
}

interface Props {
  project: { defaultType?: string | null; currency?: string | null };
  onBack: () => void;
  onSubmit: (data: PropertyData) => Promise<void>;
  isSubmitting: boolean;
}

export function PropertyStep({ project, onBack, onSubmit, isSubmitting }: Props) {
  const form = useForm<PropertyData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      propertyType: project.defaultType ?? "",
    },
  });

  const currency = project.currency ?? "AED";
  const areaSqft = form.watch("areaSqft");
  const clientPrice = form.watch("clientPrice");
  const estimatedPsf = areaSqft && clientPrice && areaSqft > 0
    ? Math.round(clientPrice / areaSqft).toLocaleString()
    : null;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
          <Home className="h-6 w-6 text-green-600" />
        </div>
        <CardTitle className="text-xl">Property Details</CardTitle>
        <CardDescription>Tell us about the property you want to value</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => onSubmit(data as PropertyData))}
            className="space-y-4"
          >
            <FormField control={form.control} name="propertyType" render={({ field }) => (
              <FormItem>
                <FormLabel>Property Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="bedrooms" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bedrooms</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    value={field.value?.toString() ?? ""}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="0">Studio</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} BR</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="bathrooms" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bathrooms</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    value={field.value?.toString() ?? ""}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="areaSqft" render={({ field }) => (
              <FormItem>
                <FormLabel>Total Area (sqft) *</FormLabel>
                <FormControl><Input type="number" placeholder="e.g. 2500" {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="clientPrice" render={({ field }) => (
              <FormItem>
                <FormLabel>Your Asking / Expected Price ({currency}) *</FormLabel>
                <FormControl><Input type="number" placeholder="e.g. 3500000" {...field} value={field.value ?? ""} /></FormControl>
                {estimatedPsf && (
                  <FormDescription className="flex items-center gap-1 text-blue-600">
                    <Calculator className="h-3.5 w-3.5" />
                    {currency} {estimatedPsf} per sqft
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculating...</>
                ) : (
                  <>Get My Valuation</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
