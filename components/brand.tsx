import Link from "next/link";

export function Brand({ meta }: { meta?: string }) {
  return (
    <Link className="fg-brand" href="/" prefetch={false}>
      <span className="fg-brand__word">Fugue</span>
      {meta ? <span className="fg-brand__meta fg-mono">{meta}</span> : null}
    </Link>
  );
}
