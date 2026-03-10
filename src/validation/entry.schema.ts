import { z } from "zod";

const propertyTypeEnum = z.enum([
  "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
  "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER",
]);

export const createListingEntrySchema = z.object({
  sourceType: z.literal("LISTING"),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).default("RESIDENTIAL"),
  propertyType: propertyTypeEnum,
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  unitType: z.string().max(100).optional(),
  portal: z.string().max(100).optional(),
  locationLabel: z.string().max(200).optional(),
  createdDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  areaSqft: z.number().positive(),
  askPrice: z.number().positive(),
  lowestPrice: z.number().positive().optional(),
});

export const createTransactionEntrySchema = z.object({
  sourceType: z.literal("TRANSACTION"),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).default("RESIDENTIAL"),
  propertyType: propertyTypeEnum,
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  unitType: z.string().max(100).optional(),
  portal: z.string().max(100).optional(),
  locationLabel: z.string().max(200).optional(),
  createdDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  transactionDate: z.string().datetime().optional(),
  transactionAreaSqft: z.number().positive(),
  transactionPrice: z.number().positive(),
});

export const createEntrySchema = z.discriminatedUnion("sourceType", [
  createListingEntrySchema,
  createTransactionEntrySchema,
]);

export const updateEntrySchema = z.object({
  propertyType: propertyTypeEnum.optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  unitType: z.string().max(100).optional(),
  portal: z.string().max(100).optional(),
  locationLabel: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  areaSqft: z.number().positive().optional(),
  askPrice: z.number().positive().optional(),
  lowestPrice: z.number().positive().optional(),
  transactionDate: z.string().datetime().optional(),
  transactionAreaSqft: z.number().positive().optional(),
  transactionPrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
