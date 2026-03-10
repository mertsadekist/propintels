export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  AGENT: "AGENT",
  VIEWER: "VIEWER",
} as const;

export type RoleCode = keyof typeof ROLES;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const VERDICT_LABELS = {
  BELOW_MARKET: "Below Market",
  ALIGNED: "Fair Market Value",
  SLIGHTLY_ABOVE: "Slightly Above Market",
  ABOVE_MARKET: "Above Market",
  INSUFFICIENT_DATA: "Insufficient Data",
} as const;

export const VERDICT_COLORS = {
  BELOW_MARKET: "blue",
  ALIGNED: "green",
  SLIGHTLY_ABOVE: "yellow",
  ABOVE_MARKET: "red",
  INSUFFICIENT_DATA: "gray",
} as const;
