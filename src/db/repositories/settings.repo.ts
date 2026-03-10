import { prisma } from "@/db/prisma";
import { DEFAULT_VALUATION_RULES, DEFAULT_BRANDING } from "@/config/defaults";
import type { ValuationEngineConfig } from "@/valuation/types";

// Prisma v6: findUnique / upsert with null in composite unique key is unsupported.
// All operations on the Setting model that involve projectId: null must use
// findFirst + create/update instead of findUnique / upsert.

export const settingsRepo = {
  async getValuationRules(projectId?: string): Promise<ValuationEngineConfig> {
    if (projectId) {
      const projectSetting = await prisma.setting.findFirst({
        where: { scope: "PROJECT", projectId, key: "valuation_rules" },
      });
      if (projectSetting) {
        return projectSetting.value as unknown as ValuationEngineConfig;
      }
    }

    const globalSetting = await prisma.setting.findFirst({
      where: { scope: "GLOBAL", projectId: null, key: "valuation_rules" },
    });

    return (globalSetting?.value as unknown as ValuationEngineConfig) ?? DEFAULT_VALUATION_RULES;
  },

  async getBranding() {
    const setting = await prisma.setting.findFirst({
      where: { scope: "GLOBAL", projectId: null, key: "branding" },
    });
    return setting?.value ?? DEFAULT_BRANDING;
  },

  async updateValuationRules(value: ValuationEngineConfig, projectId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jv = value as any;

    if (projectId) {
      // Project-scoped setting: upsert is safe because projectId is non-null
      return prisma.setting.upsert({
        where: { scope_projectId_key: { scope: "PROJECT", projectId, key: "valuation_rules" } },
        update: { value: jv },
        create: { scope: "PROJECT", projectId, key: "valuation_rules", value: jv },
      });
    }

    // Global setting (projectId = null) — use findFirst + update/create
    const existing = await prisma.setting.findFirst({
      where: { scope: "GLOBAL", projectId: null, key: "valuation_rules" },
    });
    if (existing) {
      return prisma.setting.update({ where: { id: existing.id }, data: { value: jv } });
    }
    return prisma.setting.create({
      data: { scope: "GLOBAL", projectId: null, key: "valuation_rules", value: jv },
    });
  },

  async updateBranding(value: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jv = value as any;

    const existing = await prisma.setting.findFirst({
      where: { scope: "GLOBAL", projectId: null, key: "branding" },
    });
    if (existing) {
      return prisma.setting.update({ where: { id: existing.id }, data: { value: jv } });
    }
    return prisma.setting.create({
      data: { scope: "GLOBAL", projectId: null, key: "branding", value: jv },
    });
  },
};
