import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  roles: z.array(z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"])).min(1),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  roles: z.array(z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"])).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
