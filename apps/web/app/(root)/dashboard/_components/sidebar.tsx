"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Home, LayoutGrid, FolderOpen, Calendar, Link2, Scissors, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: Home,        label: "Home",     href: "/dashboard" },
  { icon: LayoutGrid,  label: "Projects", href: "/dashboard/projects" },
  { icon: FolderOpen,  label: "Library",  href: "/dashboard/library" },
  { icon: Calendar,    label: "Schedule", href: "/dashboard/schedule" },
  { icon: Link2,       label: "Publish",  href: "/dashboard/publish" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-white/6 bg-[#0a0a0a] py-4 gap-2 fixed left-0 top-0 z-40">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white mb-3"
      >
        <Scissors className="h-4 w-4 text-black" strokeWidth={2.5} />
      </Link>

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {NAV.map(({ icon: Icon, label, href }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              path === href
                ? "bg-white/10 text-white"
                : "text-white/35 hover:bg-white/6 hover:text-white/70"
            )}
          >
            <Icon className="h-4 w-4" />
          </Link>
        ))}
      </div>

      {/* User */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Link
          href="/dashboard/billing"
          title="Billing & Credits"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            path.startsWith("/dashboard/billing")
              ? "bg-white/10 text-white"
              : "text-white/35 hover:bg-white/6 hover:text-white/70"
          )}
        >
          <CreditCard className="h-4 w-4" />
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </aside>
  );
}
