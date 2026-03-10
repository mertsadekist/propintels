import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";
import type { CreateProjectInput, UpdateProjectInput } from "@/validation/project.schema";

export type ProjectSortBy =
  | "createdAt_desc"
  | "createdAt_asc"
  | "name_asc"
  | "name_desc"
  | "entries_desc"
  | "leads_desc"
  | "links_desc";

export interface ListProjectsOptions {
  /** undefined = all, true = active only, false = inactive only */
  isActive?: boolean;
  category?: string;
  ownerId?: string;
  search?: string;
  sortBy?: ProjectSortBy;
  page?: number;
  pageSize?: number;
}

function buildOrderBy(sortBy?: ProjectSortBy): Prisma.ProjectOrderByWithRelationInput {
  switch (sortBy) {
    case "name_asc":      return { name: "asc" };
    case "name_desc":     return { name: "desc" };
    case "createdAt_asc": return { createdAt: "asc" };
    case "entries_desc":  return { entries: { _count: "desc" } };
    case "leads_desc":    return { leads: { _count: "desc" } };
    case "links_desc":    return { links: { _count: "desc" } };
    default:              return { createdAt: "desc" };
  }
}

export const projectsRepo = {
  async list(options: ListProjectsOptions = {}) {
    const { isActive, category, ownerId, search, sortBy, page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProjectWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (category) where.category = category as Prisma.EnumPropertyCategoryFilter;
    if (ownerId) where.ownerId = ownerId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { entries: true, leads: true, links: true } },
        },
        orderBy: buildOrderBy(sortBy),
        skip,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, total, page, pageSize };
  },

  async findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { entries: true, leads: true, links: true } },
      },
    });
  },

  async create(data: CreateProjectInput, ownerId: string) {
    return prisma.project.create({
      data: {
        ...data,
        ownerId,
        defaultType: data.defaultType ?? null,
      },
    });
  },

  async update(id: string, data: UpdateProjectInput) {
    return prisma.project.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
