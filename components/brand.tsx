import Link from "next/link";

export function Brand({ meta = "product shell" }: { meta?: string }) {
  return (
    <Link className="fg-brand" href="/">
      <span className="fg-brand__word">Fugue</span>
      <span className="fg-brand__meta fg-mono">{meta}</span>
    </Link>
  );
}
