import type { RoleCode } from "@/lib/constants";

export const PERMISSIONS = {
  // Projects
  PROJECT_READ: ["ADMIN", "MANAGER", "AGENT", "VIEWER"],
  PROJECT_CREATE: ["ADMIN", "MANAGER"],
  PROJECT_EDIT: ["ADMIN", "MANAGER"],
  PROJECT_DELETE: ["ADMIN"],

  // Entries
  ENTRY_READ: ["ADMIN", "MANAGER", "AGENT", "VIEWER"],
  ENTRY_CREATE: ["ADMIN", "MANAGER", "AGENT"],
  ENTRY_EDIT: ["ADMIN", "MANAGER", "AGENT"],
  ENTRY_DELETE: ["ADMIN", "MANAGER"],

  // Valuation Links
  LINK_READ: ["ADMIN", "MANAGER", "AGENT"],
  LINK_CREATE: ["ADMIN", "MANAGER", "AGENT"],
  LINK_EDIT: ["ADMIN", "MANAGER", "AGENT"],
  LINK_DELETE: ["ADMIN", "MANAGER"],

  // Leads
  LEAD_READ_ALL: ["ADMIN", "MANAGER"],
  LEAD_READ_OWN: ["ADMIN", "MANAGER", "AGENT"],
  LEAD_STATUS_UPDATE: ["ADMIN", "MANAGER", "AGENT"],
  LEAD_ASSIGN: ["ADMIN", "MANAGER"],

  // Reports
  REPORT_READ_ALL: ["ADMIN", "MANAGER"],
  REPORT_READ_OWN: ["ADMIN", "MANAGER", "AGENT"],
  REPORT_GENERATE: ["ADMIN", "MANAGER", "AGENT"],

  // Settings
  SETTINGS_READ: ["ADMIN", "MANAGER"],
  SETTINGS_EDIT: ["ADMIN"],

  // Users / Team
  TEAM_READ: ["ADMIN"],
  TEAM_MANAGE: ["ADMIN"],

  // Audit
  AUDIT_READ: ["ADMIN"],
} as const satisfies Record<string, RoleCode[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(userRoles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some((r) => userRoles.includes(r));
}

export function hasPermission(userRoles: string[], permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.some((r) => userRoles.includes(r));
}

export function isAdmin(userRoles: string[]): boolean {
  return userRoles.includes("ADMIN");
}

export function isManagerOrAbove(userRoles: string[]): boolean {
  return hasRole(userRoles, ["ADMIN", "MANAGER"]);
}

export function isAgentOrAbove(userRoles: string[]): boolean {
  return hasRole(userRoles, ["ADMIN", "MANAGER", "AGENT"]);
}
