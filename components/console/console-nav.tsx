"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { consoleNavGroups } from "@/lib/console/nav";
import { cx } from "@/lib/ui/cx";

function isActivePath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleNav() {
  const pathname = usePathname();
  const items = consoleNavGroups.flatMap((group) => group.items);

  return (
    <nav aria-label="Console" className="fg-console-nav">
      <div className="fg-console-nav__items">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              className={cx("fg-console-nav__link", active && "is-active")}
              href={item.href}
              key={item.href}
            >
              <span className="fg-console-nav__title">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
