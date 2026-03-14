import { prisma } from "@/db/prisma";
import { Prisma } from "@prisma/client";

export interface ListLeadsOptions {
  status?: string;
  verdict?: string;
  projectId?: string;
  assignedAgentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const leadsRepo = {
  async list(options: ListLeadsOptions = {}) {
    const {
      status,
      verdict,
      projectId,
      assignedAgentId,
      dateFrom,
      dateTo,
      search,
      page = 1,
      pageSize = 20,
    } = options;

    const skip = (page - 1) * pageSize;
    const where: Prisma.LeadWhereInput = {};

    if (status) where.status = status as Prisma.EnumLeadStatusFilter;
    if (verdict) where.valuationResult = { verdict: verdict as Prisma.EnumVerdictLabelFilter };
    if (projectId) where.projectId = projectId;
    if (assignedAgentId) where.assignedAgentId = assignedAgentId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          assignedAgent: { select: { id: true, name: true, email: true } },
          valuationResult: {
            select: { verdict: true, confidence: true, recommendedMid: true },
          },
          reports: {
            select: { id: true, status: true, generatedAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads, total, page, pageSize };
  },

  async findById(id: string) {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        project: true,
        link: { select: { id: true, label: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        valuationResult: true,
        specialistAssessment: {
          include: {
            specialist: { select: { id: true, name: true, email: true } },
          },
        },
        reports: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
  },
};
