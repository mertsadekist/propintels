"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  Settings,
  ClipboardList,
  Shield,
  ChevronRight,
  BarChart2,
  DatabaseZap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart2, roles: ["ADMIN", "MANAGER"] },
  { label: "Leads", href: "/admin/leads", icon: Users },
  { label: "Reports", href: "/admin/reports", icon: FileText },
  { label: "Import Listings", href: "/admin/tools/import-listings", icon: DatabaseZap, roles: ["ADMIN", "MANAGER"] },
  { label: "Team", href: "/admin/team", icon: Shield, roles: ["ADMIN"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
  { label: "Audit Logs", href: "/admin/audit", icon: ClipboardList, roles: ["ADMIN"] },
];

interface SidebarProps {
  userRoles: string[];
}

export function AdminSidebar({ userRoles }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => userRoles.includes(r))
  );

  return (
    <aside className="w-60 bg-[#0B1F3B] text-white flex flex-col flex-shrink-0 h-full">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <span className="text-lg font-bold tracking-wide">IST Valuation</span>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

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

      <div className="px-6 py-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-xs text-white/50">{userRoles[0] ?? "User"}</span>
        </div>
      </div>
    </aside>
  );
}
