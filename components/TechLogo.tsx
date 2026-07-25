import React from 'react';
import { BRAND_MARKS } from './tech-logos';

/**
 * Renders the real brand mark for a tech-stack / service badge kind.
 *
 * Kinds come from the backend gallery badges. Live values observed:
 * nextjs, react, node, python, go, postgres, docker, github, runtime, static.
 * Brand marks live in ./tech-logos (generated from simple-icons); the two
 * non-brand kinds below get neutral glyphs, and anything unrecognized falls
 * back to a lettered circle.
 */

type TechLogoProps = {
  kind: string;
  label?: string;
  size?: number;
};

/**
 * Kinds that are platform concepts rather than brands, so there is no official
 * logo to use. Drawn as neutral outline glyphs that inherit the badge color.
 */
const GENERIC_MARKS: Record<string, { label: string; path: string }> = {
  // Uploaded artifact: tray with an arrow going in.
  runtime: {
    label: 'Upload',
    path: 'M12 3a1 1 0 0 1 1 1v7.59l2.3-2.3a1 1 0 0 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-8 12a1 1 0 0 1 1 1v2h14v-2a1 1 0 0 1 2 0v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z',
  },
  // Static site: a globe.
  static: {
    label: 'Static Site',
    path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c.9 0 2.16 1.6 2.72 4.25H9.28C9.84 5.6 11.1 4 12 4ZM8.86 10.25h6.28a17 17 0 0 1 0 3.5H8.86a17 17 0 0 1 0-3.5Zm-2 3.5H4.23a8 8 0 0 1 0-3.5h2.63a19 19 0 0 0 0 3.5Zm.42 2h2.15c.29 1.2.7 2.28 1.2 3.15a8 8 0 0 1-3.35-3.15Zm2.15-7.5H7.28a8 8 0 0 1 3.35-3.15c-.5.87-.91 1.95-1.2 3.15Zm2.57 9.5c-.9 0-2.16-1.6-2.72-4.25h5.44C14.16 15.9 12.9 17.5 12 17.5Zm1.37 1.4c.5-.87.91-1.95 1.2-3.15h2.15a8 8 0 0 1-3.35 3.15Zm3.77-5.15a19 19 0 0 0 0-3.5h2.63a8 8 0 0 1 0 3.5h-2.63Zm-.42-5.5c-.29-1.2-.7-2.28-1.2-3.15a8 8 0 0 1 3.35 3.15h-2.15Z',
  },
};

/** Alias table so backend spellings land on the right mark. */
const ALIASES: Record<string, string> = {
  nextjs: 'next',
  'next.js': 'next',
  nodejs: 'node',
  'node.js': 'node',
  postgresql: 'postgres',
  psql: 'postgres',
  golang: 'go',
  py: 'python',
  jdk: 'java',
  openjdk: 'java',
  csharp: 'dotnet',
  'c#': 'dotnet',
  '.net': 'dotnet',
  dotnetcore: 'dotnet',
  dockerfile: 'docker',
  rs: 'rust',
  rb: 'ruby',
};

function normalizeKind(kind: string): string {
  const k = kind.trim().toLowerCase();
  return ALIASES[k] ?? k;
}

export default function TechLogo({ kind, label, size = 18 }: TechLogoProps) {
  const normalized = normalizeKind(kind);
  const brand = BRAND_MARKS[normalized];
  const generic = brand ? undefined : GENERIC_MARKS[normalized];
  const mark = brand ?? generic;
  const title = label || mark?.label || kind;

  if (!mark) {
    const letter = (title || '?').charAt(0).toUpperCase();
    return (
      <span
        className="tech-logo tech-logo-fallback"
        title={title}
        style={{ width: size, height: size }}
        role="img"
        aria-label={title}
      >
        {letter}
      </span>
    );
  }

  // Brand colors ride in as custom properties so globals.css can pick the
  // light or dark variant; generic marks keep inheriting the badge color.
  const style: React.CSSProperties & Record<string, string | number> = {
    width: size,
    height: size,
  };
  if (brand) {
    style['--brand'] = brand.color;
    style['--brand-dark'] = brand.dark ?? brand.color;
  }

  return (
    <span
      className={brand ? 'tech-logo tech-logo-brand' : 'tech-logo'}
      title={title}
      style={style}
      role="img"
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <path d={mark.path} />
      </svg>
    </span>
  );
}
