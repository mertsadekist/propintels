import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(200).optional(),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).default("RESIDENTIAL"),
  defaultType: z
    .enum([
      "APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "DUPLEX",
      "OFFICE", "RETAIL", "WAREHOUSE", "LAND", "OTHER",
    ])
    .optional(),
  areaTolerancePct: z.number().int().min(5).max(50).optional(),
  currency: z.string().length(3).default("AED"),
  description: z.string().max(1000).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
