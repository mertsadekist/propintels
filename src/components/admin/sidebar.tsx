"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  Settings,
  ClipboardList,
  Shield,
  ChevronRight,
  ChevronDown,
  BarChart2,
  DatabaseZap,
  FileUp,
  Grid3X3,
  TrendingUp,
  MapPin,
  PieChart,
  CalendarDays,
  BrainCircuit,
  DollarSign,
  TrendingDown,
  Layers,
  Building2,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

interface NavItem {
  label:    string;
  href:     string;
  icon:     React.ComponentType<{ className?: string }>;
  roles?:   string[];
  children?: NavItem[];
  exact?:   boolean;    // use exact match for active detection
  disabled?: boolean;   // show as coming-soon / non-clickable
}

// ─── Navigation structure ───────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Projects",  href: "/admin/projects", icon: FolderKanban },
  {
    label: "Analytics",
    href:  "/admin/analytics",
    icon:  BarChart2,
    roles: ["ADMIN", "MANAGER"],
    children: [
      { label: "Overview",            href: "/admin/analytics",             icon: LayoutDashboard, exact: true, roles: ["ADMIN", "MANAGER"] },
      { label: "Price Matrix",        href: "/admin/analytics/price-matrix",   icon: Grid3X3,       roles: ["ADMIN", "MANAGER"] },
      { label: "Market Trends",       href: "/admin/analytics/market-trends",  icon: TrendingUp,    roles: ["ADMIN", "MANAGER"] },
      { label: "Area Comparison",     href: "/admin/analytics/area-comparison",icon: MapPin,        roles: ["ADMIN", "MANAGER"] },
      { label: "Property Mix",        href: "/admin/analytics/property-mix",   icon: PieChart,      roles: ["ADMIN", "MANAGER"] },
      { label: "Volume Tracker",      href: "/admin/analytics/volume",         icon: CalendarDays,  roles: ["ADMIN", "MANAGER"] },
      { label: "Valuation Insights",  href: "/admin/analytics/valuations",     icon: BrainCircuit,  roles: ["ADMIN", "MANAGER"] },
      { label: "Price Trends",        href: "/admin/analytics/price-trends",   icon: DollarSign,    roles: ["ADMIN", "MANAGER"] },
      { label: "Price Changes",       href: "/admin/analytics/price-change",   icon: TrendingDown,  roles: ["ADMIN", "MANAGER"] },
      { label: "Deal Segments",       href: "/admin/analytics/deal-segments",  icon: Layers,        roles: ["ADMIN", "MANAGER"] },
    ],
  },
  { label: "Leads",   href: "/admin/leads",   icon: Users },
  { label: "Reports", href: "/admin/reports", icon: FileText },
  {
    label: "Import Listings",
    href:  "/admin/tools/import-listings",
    icon:  DatabaseZap,
    roles: ["ADMIN", "MANAGER"],
    children: [
      { label: "PropertyFinder", href: "/admin/tools/import-listings",         icon: Home,      exact: true, roles: ["ADMIN", "MANAGER"] },
      { label: "Bayut",          href: "/admin/tools/import-listings/bayut",   icon: Building2,              roles: ["ADMIN", "MANAGER"] },
      { label: "Dubizzle",       href: "/admin/tools/import-listings/dubizzle",icon: Building2, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  { label: "Import DLD",      href: "/admin/tools/import-dld",      icon: FileUp,      roles: ["ADMIN", "MANAGER"] },
  { label: "Team",       href: "/admin/team",     icon: Shield,       roles: ["ADMIN"] },
  { label: "Settings",   href: "/admin/settings", icon: Settings,     roles: ["ADMIN"] },
  { label: "Audit Logs", href: "/admin/audit",    icon: ClipboardList,roles: ["ADMIN"] },
];

// ─── Component ─────────────────────────────────────────────────────────────

interface SidebarProps {
  userRoles: string[];
}

export function AdminSidebar({ userRoles }: SidebarProps) {
  const pathname = usePathname();

  // Determine if Analytics group starts open (user is on an analytics page)
  const analyticsOpen = pathname.startsWith("/admin/analytics");
  // Determine if Import Listings group starts open
  const importOpen = pathname.startsWith("/admin/tools/import-listings");
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
    "/admin/analytics":              analyticsOpen,
    "/admin/tools/import-listings":  importOpen,
  });

  const canSee = (item: NavItem) =>
    !item.roles || item.roles.some((r) => userRoles.includes(r));

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const filteredItems = NAV_ITEMS.filter(canSee);

  return (
    <aside className="w-60 bg-[#0B1F3B] text-white flex flex-col flex-shrink-0 h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <span className="text-lg font-bold tracking-wide">IST Valuation</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const hasChildren = !!item.children?.length;
            const isOpen = groupOpen[item.href] ?? false;

            // For group parents: active if any child is active
            const isActive = hasChildren
              ? isItemActive(item)
              : isItemActive(item);

            if (hasChildren) {
              // ── Collapsible group ──────────────────────────────
              const visibleChildren = item.children!.filter(canSee);
              const childActive = visibleChildren.some((c) => isItemActive(c));

              return (
                <li key={item.href}>
                  {/* Group header — toggle only, no navigation */}
                  <button
                    onClick={() =>
                      setGroupOpen((prev) => ({ ...prev, [item.href]: !prev[item.href] }))
                    }
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      childActive
                        ? "bg-white/15 text-white"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                    )}
                  </button>

                  {/* Children */}
                  {isOpen && (
                    <ul className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                      {visibleChildren.map((child) => {
                        const childIsActive = isItemActive(child);

                        // Disabled / coming-soon item (e.g. Dubizzle)
                        if (child.disabled) {
                          return (
                            <li key={child.href}>
                              <span
                                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-white/25 cursor-not-allowed select-none"
                              >
                                <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="flex-1">{child.label}</span>
                                <span className="text-[10px] bg-white/10 text-white/35 px-1.5 py-0.5 rounded-full leading-tight">
                                  Soon
                                </span>
                              </span>
                            </li>
                          );
                        }

                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
                                childIsActive
                                  ? "bg-white/15 text-white"
                                  : "text-white/55 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="flex-1">{child.label}</span>
                              {childIsActive && (
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            // ── Regular item ──────────────────────────────────────
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Role badge */}
      <div className="px-6 py-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-xs text-white/50">{userRoles[0] ?? "User"}</span>
        </div>
      </div>
    </aside>
  );
}
