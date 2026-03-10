import { prisma } from "@/db/prisma";
import bcrypt from "bcryptjs";
import type { CreateUserInput, UpdateUserInput } from "@/validation/user.schema";

export const usersRepo = {
  async list(options: { status?: string; role?: string; page?: number; pageSize?: number } = {}) {
    const { status, role, page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(status ? { status: status as "ACTIVE" | "DISABLED" } : {}),
      ...(role
        ? { roles: { some: { role: { code: role } } } }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          roles: { include: { role: true } },
          _count: { select: { assignedLeads: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, pageSize };
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
      },
    });
  },

  async create(data: CreateUserInput) {
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        status: "ACTIVE",
      },
    });

    // Assign roles
    for (const roleCode of data.roles) {
      const role = await prisma.role.findUnique({ where: { code: roleCode } });
      if (role) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }

    return prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
  },

  async update(id: string, data: UpdateUserInput) {
    const { roles, ...rest } = data;

    const user = await prisma.user.update({
      where: { id },
      data: rest,
    });

    if (roles) {
      // Replace all roles
      await prisma.userRole.deleteMany({ where: { userId: id } });
      for (const roleCode of roles) {
        const role = await prisma.role.findUnique({ where: { code: roleCode } });
        if (role) {
          await prisma.userRole.create({
            data: { userId: id, roleId: role.id },
          });
        }
      }
    }

    return prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
  },
};
