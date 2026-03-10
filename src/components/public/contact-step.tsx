"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Phone, Mail, ArrowRight } from "lucide-react";

const schema = z.object({
  fullName: z.string().min(2, "Please enter your full name"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

export interface ContactData {
  fullName: string;
  phone: string;
  email?: string;
}

interface Props {
  onNext: (data: ContactData) => void;
}

export function ContactStep({ onNext }: Props) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", phone: "", email: "" },
  });

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
          <User className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle className="text-xl">Get Your Free Valuation</CardTitle>
        <CardDescription>
          Enter your contact details to receive an instant property valuation
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => onNext(data as ContactData))}
            className="space-y-4"
          >
            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input className="pl-9" placeholder="Mohammed Al-Rashid" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input className="pl-9" placeholder="+971 50 XXX XXXX" type="tel" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address <span className="text-gray-400">(optional)</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input className="pl-9" placeholder="your@email.com" type="email" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className="w-full" size="lg">
              Continue to Property Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-xs text-center text-gray-400">
              🔒 Your information is kept private and secure
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
