import { getServerSession } from "next-auth";
import { authOptions } from "./auth.config";
import { hasPermission, Permission } from "./rbac";
import type { Session } from "next-auth";

export type AuthSession = Session & {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
};

export async function getSession(): Promise<AuthSession | null> {
  const session = await getServerSession(authOptions);
  return session as AuthSession | null;
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requirePermission(permission: Permission): Promise<AuthSession> {
  const session = await requireSession();
  if (!hasPermission(session.user.roles, permission)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function withAuth(
  requiredRoles?: string[]
): Promise<{ session: AuthSession; error: null } | { session: null; error: Response }> {
  const session = await getSession();

  if (!session?.user?.id) {
    return {
      session: null,
      error: Response.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      ),
    };
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasAccess = requiredRoles.some((r) => session.user.roles.includes(r));
    if (!hasAccess) {
      return {
        session: null,
        error: Response.json(
          { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
          { status: 403 }
        ),
      };
    }
  }

  return { session, error: null };
}
