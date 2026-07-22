import React from 'react';

/**
 * Renders a small monochrome logo for a tech-stack / service badge kind.
 * Kinds come from the backend console badges (next, react, node, python, go,
 * java, ruby, php, dotnet, rust, postgres, docker, github, runtime). Unknown
 * kinds fall back to a lettered circle.
 */

type TechLogoProps = {
  kind: string;
  label?: string;
  size?: number;
};

// Simplified single-path brand glyphs, drawn to a 24x24 viewBox.
const PATHS: Record<string, string> = {
  next: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.98 0 3.82-.58 5.37-1.57L8.7 8.9v6.6H7V6h1.7l8.9 12.03A9.96 9.96 0 0 0 22 12c0-5.52-4.48-10-10-10Zm4.3 4v5.8L15 10.1V6h1.3Z',
  react: 'M12 9.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm0-3.4c2.9 0 5.6.4 7.6 1.1 2.4.9 3.9 2.2 3.9 3.4s-1.5 2.5-3.9 3.4c-2 .7-4.7 1.1-7.6 1.1s-5.6-.4-7.6-1.1C2 15.5.5 14.2.5 13s1.5-2.5 3.9-3.4c2-.7 4.7-1.1 7.6-1.1Z',
  node: 'M12 2 3.5 7v10L12 22l8.5-5V7L12 2Zm0 3.2 5.7 3.3v6.6L12 18.4l-5.7-3.3V8.5L12 5.2Z',
  python: 'M12 2c-2.5 0-4 1-4 3v2h4v1H6C4 8 3 9.5 3 12s1 4 3 4h1v-2c0-2 1.5-3 4-3h3c1.5 0 3-1 3-3V5c0-2-1.5-3-4-3h-1Zm-2.3 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  go: 'M2 9.5h4l-.7 1.2H2.6l-.6-1.2Zm.6 2.3h5.2l-.7 1.2H3.2l-.6-1.2Zm11.9-3.6c-3.3 0-5.5 2-5.5 4.8 0 2.6 2 4.3 4.9 4.3 3.3 0 5.5-2 5.5-4.8 0-2.6-2-4.3-4.9-4.3Zm.1 6.7c-1.1 0-1.8-.7-1.8-1.8s.9-2.2 2-2.2 1.8.7 1.8 1.8-.9 2.2-2 2.2Z',
  java: 'M9 3s-1.5 1.5 0 3c1 1 1.3 2 .5 3 0 0 2.5-1.3 1.3-3.3C10 7.3 8.5 6 9 3Zm3 3s2 2-1 5c-2 2-1 4-1 4s-3-2 0-5c1.7-1.7 2-3 2-4ZM6 15c0 1.5 3 2 6 2s6-.5 6-2c0-1-1.5-1.5-3-1.7 2 .5 1 1.7-3 1.7s-6-.5-6-.7V15Z',
  ruby: 'M4 8 12 3l8 5-8 13L4 8Zm2.7.8L12 18l5.3-9.2L12 5.6 6.7 8.8Z',
  php: 'M12 6.5c5.5 0 10 2.5 10 5.5s-4.5 5.5-10 5.5S2 15 2 12s4.5-5.5 10-5.5Zm-4 3-1.3 6h1.5l.4-2H10c1.3 0 2.2-.7 2.2-2 0-1.3-.9-2-2.2-2H8Zm1.2 1.2h.7c.5 0 .8.2.8.7s-.4.9-.9.9h-.8l.2-1.6Z',
  dotnet: 'M2 6h2.5l3 6V6H9v8H6.5l-3-6v6H2V6Zm9 0h5v1.3h-3.5v2h3v1.3h-3v2H16V16h-5V6Zm7 0h4v1.3h-1.3V16H21V7.3h-1.3V6h.7Z',
  rust: 'M12 2.5 14 4h2.5l1 2.2 2.2 1V9.5L21 12l-1.3 2.5v2.3l-2.2 1-1 2.2H14L12 21.5 10 20H7.5l-1-2.2-2.2-1v-2.3L3 12l1.3-2.5V7.2l2.2-1 1-2.2H10L12 2.5Zm0 3.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z',
  postgres: 'M12 2C7 2 3.5 4 3.5 8.5c0 3 .5 6 1.5 8.5.6 1.5 1.5 3 3 3 1 0 1.3-.7 1.3-2 0-.7-.3-2-.3-3.5 0-2 1-3.5 3-3.5s3 1.3 3 3c0 .5 0 1 .5 1s1-.5 1-2c0-4-1.5-11-6.5-11Zm-2 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 .3a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z',
  docker: 'M4 10h3v3H4v-3Zm3.5 0h3v3h-3v-3Zm3.5 0h3v3h-3v-3Zm3.5 0h3v3h-3v-3ZM7.5 6.5h3v3h-3v-3Zm3.5 0h3v3h-3v-3Zm3.5 0h3v3h-3v-3ZM2 13.5h20c0 3.5-2.5 6-7 6H8c-3.5 0-6-2.3-6-6Z',
  github: 'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .3.3.6.9.6 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z',
  runtime: 'M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.5 3.6L12 11.5 5.5 7.9 12 4.3ZM5 9.6l6 3.4v6.8l-6-3.3V9.6Zm14 0v6.9l-6 3.3v-6.8l6-3.4Z',
};

const LABELS: Record<string, string> = {
  next: 'Next.js',
  react: 'React',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  java: 'Java',
  ruby: 'Ruby',
  php: 'PHP',
  dotnet: '.NET',
  rust: 'Rust',
  postgres: 'PostgreSQL',
  docker: 'Docker',
  github: 'GitHub',
  runtime: 'Runtime',
};

function normalizeKind(kind: string): string {
  const k = kind.trim().toLowerCase();
  if (k === 'nextjs') return 'next';
  if (k === 'nodejs') return 'node';
  if (k === 'postgresql') return 'postgres';
  return k;
}

export default function TechLogo({ kind, label, size = 18 }: TechLogoProps) {
  const normalized = normalizeKind(kind);
  const path = PATHS[normalized];
  const title = label || LABELS[normalized] || kind;

  if (!path) {
    const letter = (title || '?').charAt(0).toUpperCase();
    return (
      <span
        className="tech-logo tech-logo-fallback"
        title={title}
        style={{ width: size, height: size }}
        aria-label={title}
      >
        {letter}
      </span>
    );
  }

  return (
    <span
      className="tech-logo"
      title={title}
      style={{ width: size, height: size }}
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <path d={path} />
      </svg>
    </span>
  );
}
