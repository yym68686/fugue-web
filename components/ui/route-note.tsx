import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type RouteNoteProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  index: ReactNode;
  meta: ReactNode;
  title: ReactNode;
};

export function RouteNote({ className, index, meta, title, ...rest }: RouteNoteProps) {
  return (
    <article {...rest} className={cx("fg-route-note", className)}>
      <span className="fg-route-note__index">{index}</span>
      <strong className="fg-route-note__title">{title}</strong>
      <span className="fg-route-note__meta">{meta}</span>
    </article>
  );
}
