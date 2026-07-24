"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Home, LayoutGrid, CreditCard } from "lucide-react";
import ChopprLogo from "@/components/choppr-logo";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: Home,       label: "Home",     href: "/dashboard",          exact: true  },
  { icon: LayoutGrid, label: "Projects", href: "/dashboard/projects", exact: false },
  // { icon: FolderOpen, label: "Library",  href: "/dashboard/library" },
  // { icon: Calendar,   label: "Schedule", href: "/dashboard/schedule" },
  // { icon: Link2,      label: "Publish",  href: "/dashboard/publish" },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function MobileBottomBar({ nav, path }: { nav: typeof NAV; path: string }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center px-2 pb-2">
        {nav.map(({ icon, label, href, exact }) => (
          <MobileNavLink key={href} icon={icon} label={label} href={href} exact={exact} />
        ))}
        <MobileNavLink icon={CreditCard} label="Billing" href="/dashboard/billing" />
        <div className="flex flex-1 flex-col items-center justify-center gap-0.5 h-12">
          <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          <span className="text-[9px] font-medium text-white/35">Account</span>
        </div>
      </div>
    </nav>
  );
}

function useActive(href: string, exact: boolean) {
  const path = usePathname();
  return exact ? path === href : path === href || path.startsWith(href + "/");
}

function DesktopNavLink({ icon: Icon, label, href, exact = false }: { icon: any; label: string; href: string; exact?: boolean }) {
  const active = useActive(href, exact);
  return (
    <Link href={href} title={label} className={cn(
      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
      active ? "bg-white/10 text-white" : "text-white/35 hover:bg-white/6 hover:text-white/70"
    )}>
      <Icon className="h-4 w-4" />
    </Link>
  );
}

function MobileNavLink({ icon: Icon, label, href, exact = false }: { icon: any; label: string; href: string; exact?: boolean }) {
  const active = useActive(href, exact);
  return (
    <Link href={href} className={cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 h-12 rounded-lg transition-colors",
      active ? "text-white" : "text-white/35"
    )}>
      <Icon className="h-5 w-5" />
      <span className="text-[9px] font-medium">{label}</span>
    </Link>
  );
}

export default function Sidebar({ hideMobileBar = false }: { hideMobileBar?: boolean } = {}) {
  const path = usePathname();

  return (
    <>
      {/* ── Desktop sidebar — only on md+ ── */}
      <aside className="hidden md:flex h-screen w-14 flex-col items-center border-r border-white/6 bg-[#0a0a0a] py-4 gap-2 fixed left-0 top-0 z-40">
        <Link href="/dashboard" className="mb-3">
          <ChopprLogo size={32} />
        </Link>

        <div className="flex flex-col items-center gap-1 flex-1">
          {NAV.map(({ icon, label, href, exact }) => (
            <DesktopNavLink key={href} icon={icon} label={label} href={href} exact={exact} />
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-2">
          <Link href="/dashboard/billing" title="Billing & Credits" className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            path.startsWith("/dashboard/billing") ? "bg-white/10 text-white" : "text-white/35 hover:bg-white/6 hover:text-white/70"
          )}>
            <CreditCard className="h-4 w-4" />
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </aside>

      {/* ── Mobile bottom bar — only below md ── */}
      {!hideMobileBar && <MobileBottomBar nav={NAV} path={path} />}
    </>
  );
}
