import { z } from "zod";

export const createLinkSchema = z.object({
  label: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
});

export const updateLinkSchema = z.object({
  label: z.string().max(200).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
