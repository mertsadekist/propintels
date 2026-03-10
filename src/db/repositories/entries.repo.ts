import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";
import type { CreateEntryInput, UpdateEntryInput } from "@/validation/entry.schema";
import { computePsf } from "@/valuation/engine";

export interface ListEntriesOptions {
  sourceType?: "LISTING" | "TRANSACTION";
  propertyType?: string;
  bedrooms?: number;
  isActive?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

export const entriesRepo = {
  async list(projectId: string, options: ListEntriesOptions = {}) {
    const {
      sourceType,
      propertyType,
      bedrooms,
      isActive = true,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 50,
    } = options;

    const skip = (page - 1) * pageSize;
    const where: Prisma.EntryWhereInput = { projectId, isActive };

    if (sourceType) where.sourceType = sourceType;
    if (propertyType) where.propertyType = propertyType as Prisma.EnumPropertyTypeFilter;
    if (bedrooms !== undefined) where.bedrooms = bedrooms;
    if (dateFrom || dateTo) {
      where.createdDate = {};
      if (dateFrom) where.createdDate.gte = dateFrom;
      if (dateTo) where.createdDate.lte = dateTo;
    }

    const [entries, total] = await Promise.all([
      prisma.entry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.entry.count({ where }),
    ]);

    return { entries, total, page, pageSize };
  },

  async create(projectId: string, data: CreateEntryInput) {
    const psf = computePsf(data);
    return prisma.entry.create({
      data: {
        projectId,
        sourceType: data.sourceType,
        category: data.category ?? "RESIDENTIAL",
        propertyType: data.propertyType,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        unitType: data.unitType ?? null,
        portal: data.portal ?? null,
        locationLabel: data.locationLabel ?? null,
        notes: data.notes ?? null,
        createdDate: data.createdDate ? new Date(data.createdDate) : null,
        // Listing fields
        areaSqft: data.sourceType === "LISTING" ? data.areaSqft : null,
        askPrice: data.sourceType === "LISTING" ? data.askPrice : null,
        lowestPrice: data.sourceType === "LISTING" ? (data.lowestPrice ?? null) : null,
        // Transaction fields
        transactionDate:
          data.sourceType === "TRANSACTION" && data.transactionDate
            ? new Date(data.transactionDate)
            : null,
        transactionAreaSqft:
          data.sourceType === "TRANSACTION" ? data.transactionAreaSqft : null,
        transactionPrice:
          data.sourceType === "TRANSACTION" ? data.transactionPrice : null,
        // Computed PSF
        askPsf: psf.askPsf,
        lowPsf: psf.lowPsf,
        transactionPsf: psf.transactionPsf,
      },
    });
  },

  async update(id: string, data: UpdateEntryInput) {
    const existing = await prisma.entry.findUnique({ where: { id } });
    if (!existing) throw new Error("NOT_FOUND");

    const merged = { ...existing, ...data };
    const psf = computePsf(merged as Parameters<typeof computePsf>[0]);

    return prisma.entry.update({
      where: { id },
      data: {
        ...data,
        askPsf: psf.askPsf,
        lowPsf: psf.lowPsf,
        transactionPsf: psf.transactionPsf,
        updatedAt: new Date(),
      },
    });
  },

  async softDelete(id: string) {
    return prisma.entry.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async findByProject(
    projectId: string,
    filter?: { propertyType?: string; bedrooms?: number }
  ) {
    const where: Prisma.EntryWhereInput = { projectId, isActive: true };
    if (filter?.propertyType)
      where.propertyType = filter.propertyType as Prisma.EnumPropertyTypeFilter;
    if (filter?.bedrooms !== undefined) where.bedrooms = filter.bedrooms;

    return prisma.entry.findMany({ where });
  },
};
