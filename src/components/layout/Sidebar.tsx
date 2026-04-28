"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Hash,
  Shield,
  Users,
  Activity,
  Layers,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isGlobalAdmin?: boolean;
  };
}

const navItems = [
  { label: "Dashboard",     href: "/dashboard",  icon: LayoutDashboard },
  { label: "Activity Feed", href: "/activity",   icon: Activity },
];

const projectsSection = {
  label: "Projects",
  icon: FolderKanban,
  items: [
    { label: "All Projects", href: "/projects" },
    { label: "My Issues", href: "/projects/my-issues" },
    { label: "Backlog", href: "/projects/backlog" },
  ],
};

const docsSection = {
  label: "Docs",
  icon: FileText,
  items: [
    { label: "All Docs", href: "/docs" },
    { label: "My Pages", href: "/docs/mine" },
    { label: "Starred", href: "/docs/starred" },
  ],
};

const spacesSection = {
  label: "Spaces",
  icon: Layers,
  href: "/spaces",
};

// Channels goes to /channels which loads ChannelSidebar with real UUIDs
const channelsSection = {
  label: "Channels",
  icon: MessageSquare,
  href: "/channels",
};

function NavSection({
  label,
  icon: Icon,
  items,
  href,
}: {
  label: string;
  icon: React.ElementType;
  items?: { label: string; href: string; icon?: React.ElementType }[];
  href?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  if (href) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={cn("sidebar-item", active && "sidebar-item-active")}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-item w-full justify-between"
      >
        <span className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>

      {open && items && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-[hsl(var(--border))] space-y-0.5 animate-in">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("sidebar-item text-xs", active && "sidebar-item-active")}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
                {item.label}
              </Link>
            );
          })}
          <button className="sidebar-item text-xs text-[hsl(var(--muted-foreground))]/60 w-full">
            <Plus className="w-3.5 h-3.5" />
            Add...
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-60 shrink-0 h-screen flex flex-col bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="font-semibold text-sm">SaralOps</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => (
          <NavSection
            key={item.href}
            label={item.label}
            icon={item.icon}
            href={item.href}
          />
        ))}

        <div className="pt-2 pb-1">
          <p className="px-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]/60 uppercase tracking-wider mb-1">
            Work
          </p>
          <NavSection
            label={spacesSection.label}
            icon={spacesSection.icon}
            href={spacesSection.href}
          />
          <NavSection
            label={projectsSection.label}
            icon={projectsSection.icon}
            items={projectsSection.items}
          />
          <NavSection
            label={docsSection.label}
            icon={docsSection.icon}
            items={docsSection.items}
          />
        </div>

        <div className="pt-2 pb-1">
          <p className="px-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]/60 uppercase tracking-wider mb-1">
            Communication
          </p>
          <NavSection
            label={channelsSection.label}
            icon={channelsSection.icon}
            href={channelsSection.href}
          />
        </div>

        {user.isGlobalAdmin && (
          <div className="pt-2">
            <p className="px-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]/60 uppercase tracking-wider mb-1">
              Admin
            </p>
            <Link href="/admin" className="sidebar-item">
              <Shield className="w-4 h-4 shrink-0" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--sidebar-hover))] cursor-pointer group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? ""}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <span className="text-white text-xs font-medium">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.name ?? user.email}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              {user.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[hsl(var(--destructive))]/10"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
