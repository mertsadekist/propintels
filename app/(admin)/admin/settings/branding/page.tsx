"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { Loader2 } from "lucide-react";

const brandingSchema = z.object({
  companyName: z.string().min(1).max(200),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  disclaimer: z.string().max(2000).optional(),
});

type BrandingValues = z.infer<typeof brandingSchema>;

export default function BrandingSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      companyName: "",
      primaryColor: "#0B1F3B",
      accentColor: "#C9A96E",
    },
  });

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/settings/branding");
      if (res.ok) {
        const json = await res.json();
        form.reset(json.data);
      }
      setIsLoading(false);
    }
    load();
  }, [form]);

  async function onSubmit(values: BrandingValues) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Branding settings saved");
    } catch {
      toast.error("Failed to save branding settings");
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
        title="Branding Settings"
        description="Customize how your company information appears in reports and the platform"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card className="border border-gray-200">
            <CardHeader><CardTitle className="text-base">Company Identity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="primaryColor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="color" {...field} className="h-10 w-14 p-1 cursor-pointer" />
                      </FormControl>
                      <Input value={field.value} onChange={field.onChange} placeholder="#0B1F3B" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="accentColor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accent Color</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="color" {...field} className="h-10 w-14 p-1 cursor-pointer" />
                      </FormControl>
                      <Input value={field.value} onChange={field.onChange} placeholder="#C9A96E" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl><Input placeholder="https://yourcompany.ae" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+971 4 XXX XXXX" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader><CardTitle className="text-base">PDF Report Disclaimer</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="disclaimer" render={({ field }) => (
                <FormItem>
                  <FormDescription>This text appears at the bottom of all generated PDF reports.</FormDescription>
                  <FormControl>
                    <Textarea rows={3} className="resize-none mt-2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
