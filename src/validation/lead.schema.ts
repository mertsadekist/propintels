import { z } from "zod";

export const publicSubmitSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(7).max(30),
  email: z.string().email().optional(),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).default("RESIDENTIAL"),
  propertyType: z.enum([
    "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
    "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER",
  ]),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  unitType: z.string().max(100).optional(),
  areaSqft: z.number().positive().max(100000),
  clientPrice: z.number().positive().max(1_000_000_000),
  currency: z.string().length(3).default("AED"),
  captchaToken: z.string().optional(),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum([
    "NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SET",
    "WON", "LOST", "ARCHIVED",
  ]),
  notes: z.string().max(2000).optional(),
});

export const assignLeadSchema = z.object({
  agentId: z.string().cuid(),
});

export type PublicSubmitInput = z.infer<typeof publicSubmitSchema>;
