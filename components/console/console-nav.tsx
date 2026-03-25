"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getConsoleNavGroups } from "@/lib/console/nav";
import { cx } from "@/lib/ui/cx";

function isActivePath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = getConsoleNavGroups({ isAdmin }).flatMap((group) => group.items);

  return (
    <nav aria-label="Console" className="fg-pill-nav fg-console-nav">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cx("fg-console-nav__link", active && "is-active")}
            href={item.href}
            key={item.href}
          >
            <span className="fg-console-nav__title">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
