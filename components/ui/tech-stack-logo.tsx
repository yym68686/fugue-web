import type { TechStackBadgeKind } from "@/lib/tech-stack";

export function TechStackLogo({ kind }: { kind: TechStackBadgeKind }) {
  switch (kind) {
    case "nextjs":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" fill="none" r="8.2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M8.1 16.7V7.3h1.46l5.26 6.92V7.3h1.2v9.4h-1.36L9.3 9.58v7.12H8.1Z"
            fill="currentColor"
          />
        </svg>
      );
    case "react":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <ellipse
            cx="12"
            cy="12"
            fill="none"
            rx="8"
            ry="3.15"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <ellipse
            cx="12"
            cy="12"
            fill="none"
            rx="8"
            ry="3.15"
            stroke="currentColor"
            strokeWidth="1.6"
            transform="rotate(60 12 12)"
          />
          <ellipse
            cx="12"
            cy="12"
            fill="none"
            rx="8"
            ry="3.15"
            stroke="currentColor"
            strokeWidth="1.6"
            transform="rotate(-60 12 12)"
          />
          <circle cx="12" cy="12" fill="currentColor" r="1.7" />
        </svg>
      );
    case "python":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12.1 2.5c4.6 0 4.3 2 4.3 2v3H9.6v1h9.2c0 0 2.2-.24 2.2 3.2 0 3.44-1.92 3.32-1.92 3.32h-1.14v-1.62c0-1.78-1.54-3.42-3.42-3.42H8.88c-1.78 0-3.38-1.52-3.38-3.42V5.92C5.5 4.14 7 2.5 8.92 2.5h3.18Zm1.74 1.18a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
            fill="currentColor"
          />
          <path
            d="M11.9 21.5c-4.6 0-4.3-2-4.3-2v-3h6.8v-1H5.2s-2.2.24-2.2-3.2c0-3.44 1.92-3.32 1.92-3.32h1.14v1.62c0 1.78 1.54 3.42 3.42 3.42h5.64c1.78 0 3.38 1.52 3.38 3.42v2.66c0 1.78-1.5 3.42-3.42 3.42H11.9Zm-1.74-1.18a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "node":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.3 8.1 4.7v9.4L12 21.1l-8.1-4.7V7L12 2.3Zm0 2.31L5.9 8.1v7.8l6.1 3.5 6.1-3.5V8.1L12 4.61Z"
            fill="currentColor"
          />
          <path
            d="M9 8.8h1.46l3.08 4.79V8.8H15v6.4h-1.4l-3.14-4.9v4.9H9V8.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "go":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M3 9.3h6.2v1.5H3V9.3Zm0 3h4.4v1.5H3v-1.5Zm10.1-2.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm7.1-1.8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"
            fill="currentColor"
          />
        </svg>
      );
    case "java":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M13.2 3.4c1.72 1.34-1.5 2.07-.7 3.7.43.88 2.35 1.3 1.98 2.86-.24 1.03-1.42 1.74-3.44 2.1 1.2-.52 1.86-1.12 1.98-1.8.2-1.14-1.42-1.64-1.74-2.86-.34-1.32.74-2.38 1.92-4Z"
            fill="currentColor"
          />
          <path
            d="M7.2 14.6c0 1.18 2.42 1.54 4.86 1.54 2.42 0 4.64-.42 4.64-1.38 0-.4-.4-.76-1.08-1.06 1.36.14 2.56.74 2.56 1.72 0 1.64-2.92 2.42-6.18 2.42-3.42 0-6.34-.94-6.34-2.56 0-.94 1.02-1.66 2.62-2.08-.72.4-1.08.86-1.08 1.4Z"
            fill="currentColor"
          />
          <path
            d="M9.1 19.1c.82.34 1.82.5 2.9.5 3.4 0 6.24-1.54 6.24-3.44 0-.26-.06-.5-.18-.74.62.38.98.9.98 1.52 0 2.28-3.12 4.06-7.04 4.06-1.4 0-2.72-.22-3.84-.62l.94-1.28Z"
            fill="currentColor"
          />
        </svg>
      );
    case "ruby":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.5 6.4 2.2 1.9 6.1-4.3 8.1H8l-4.3-8.1 1.9-6.1L12 2.5Zm0 2.04L7.4 6.1 6 10.52l2.96 5.6h6.08L18 10.52 16.6 6.1 12 4.54Z"
            fill="currentColor"
          />
          <path
            d="m8.1 6.9 3.9 1.06 3.9-1.06-1.28 4.22L12 16.7l-2.62-5.58L8.1 6.9Z"
            fill="currentColor"
          />
        </svg>
      );
    case "php":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 4.2c4.92 0 8.9 2.5 8.9 5.58 0 3.08-3.98 5.58-8.9 5.58-4.92 0-8.9-2.5-8.9-5.58 0-3.08 3.98-5.58 8.9-5.58Zm0 1.8c-3.94 0-7.1 1.7-7.1 3.78 0 2.08 3.16 3.78 7.1 3.78 3.94 0 7.1-1.7 7.1-3.78C19.1 7.7 15.94 6 12 6Z"
            fill="currentColor"
          />
          <path
            d="M7.2 8.45h1.64c1.14 0 1.78.52 1.78 1.46 0 1.02-.74 1.6-2 1.6h-.54v1.94H7.2V8.45Zm.9.74v1.58h.54c.72 0 1.12-.3 1.12-.8 0-.52-.34-.78-1.02-.78H8.1Zm3.42-.74h1.46c1.34 0 2.08.88 2.08 2.46 0 1.62-.84 2.54-2.28 2.54h-1.26V8.45Zm.9.76v3.48h.34c.94 0 1.4-.58 1.4-1.76 0-1.16-.44-1.72-1.34-1.72h-.4Zm4.14-.76h2.96v.78h-2.06v1.38h1.82v.76h-1.82v2.08h-.9V8.45Z"
            fill="currentColor"
          />
        </svg>
      );
    case "dotnet":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.6 7.6 4.4v10L12 21.4 4.4 17V7L12 2.6Zm0 2.14L6.2 8.02v7.96L12 19.26l5.8-3.28V8.02L12 4.74Z"
            fill="currentColor"
          />
          <path
            d="M8 9h1.42c1.4 0 2.18.9 2.18 2.52 0 1.66-.9 2.6-2.4 2.6H8V9Zm1 4.3h.3c.98 0 1.44-.58 1.44-1.78 0-1.12-.44-1.7-1.34-1.7H9v3.48Zm3.54-4.3h.86l2.22 3.56V9h.92v5.12h-.82l-2.26-3.6v3.6h-.92V9Z"
            fill="currentColor"
          />
        </svg>
      );
    case "rust":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 3.4 13.6 5l2.24-.38.92 2.08 2.14.82-.3 2.28L20.6 12l-1.94 2.28.3 2.28-2.14.82-.92 2.08-2.24-.38L12 20.6l-1.6-1.52-2.24.38-.92-2.08-2.14-.82.3-2.28L3.4 12l1.94-2.2-.3-2.28 2.14-.82.92-2.08 2.24.38L12 3.4Zm0 3.2a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Zm-1.84 2.18h2.18c1.48 0 2.36.72 2.36 1.94 0 .86-.48 1.48-1.34 1.76l1.56 2.58h-1.32l-1.38-2.34H11.1v2.34h-.94V8.78Zm.94.76v2.36h1.12c.92 0 1.42-.4 1.42-1.18 0-.78-.48-1.18-1.4-1.18H11.1Z"
            fill="currentColor"
          />
        </svg>
      );
    case "github":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.48.09.66-.21.66-.46v-1.8c-2.67.58-3.24-1.13-3.24-1.13-.44-1.1-1.06-1.4-1.06-1.4-.87-.59.07-.58.07-.58.96.07 1.47.98 1.47.98.85 1.46 2.23 1.04 2.77.8.09-.61.33-1.04.59-1.28-2.13-.24-4.37-1.07-4.37-4.74 0-1.05.38-1.9.99-2.57-.1-.24-.43-1.2.09-2.5 0 0 .82-.26 2.68.98A9.2 9.2 0 0 1 12 7.1c.81 0 1.63.11 2.4.33 1.87-1.24 2.68-.98 2.68-.98.53 1.3.2 2.26.1 2.5.62.67.99 1.52.99 2.57 0 3.68-2.24 4.5-4.38 4.74.34.3.64.88.64 1.78v2.64c0 .26.18.56.67.46A9.5 9.5 0 0 0 12 2.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "docker":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 12.5h3v-3H4v3Zm4 0h3v-3H8v3Zm4 0h3v-3h-3v3Zm4 0h3v-3h-3v3Zm-8-3h3v-3h-3v3Zm4 0h3v-3h-3v3Zm6.2 1.2c-.5 0-1 .15-1.38.43-.46-.74-1.22-1.2-2.11-1.2-.2 0-.39.03-.58.08V13H4c0 2.97 2.32 5.08 5.67 5.08h2.5c4.47 0 7.43-1.76 8.36-5.16.12-.42-.17-.84-.6-.84h-1.73Z"
            fill="currentColor"
          />
        </svg>
      );
    case "buildpacks":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 6.5 9.5 3 15 6.5 9.5 10 4 6.5Zm5.5 4.5L15 7.5 20.5 11 15 14.5 9.5 11Zm-5.5 5L9.5 12.5 15 16 9.5 19.5 4 16Zm11 0 5.5-3.5V18L15 21.5V16Z"
            fill="currentColor"
          />
        </svg>
      );
    case "nixpacks":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.5 8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4L12 2.5Zm0 3.05L6.5 8.7v6.6l5.5 3.15 5.5-3.15V8.7L12 5.55Zm0 2.2 3.3 1.9v3.8L12 15.35l-3.3-1.9v-3.8L12 7.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "static":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Zm0 2V17h16V7.5H4Zm2.2 2.1h5.3v1.9H6.2V9.6Zm0 3.3h8.8v1.9H6.2v-1.9Z"
            fill="currentColor"
          />
        </svg>
      );
    case "postgres":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 3.5c4.56 0 8 1.56 8 3.63v9.74c0 2.07-3.44 3.63-8 3.63s-8-1.56-8-3.63V7.13C4 5.06 7.44 3.5 12 3.5Zm0 2C8.13 5.5 6 6.72 6 7.13S8.13 8.75 12 8.75s6-1.22 6-1.62S15.87 5.5 12 5.5Zm6 5.14c-1.43.9-3.69 1.44-6 1.44s-4.57-.54-6-1.44v2.23c0 .41 2.13 1.63 6 1.63s6-1.22 6-1.63v-2.23Zm-6 5.44c-2.31 0-4.57-.54-6-1.45v2.24c0 .4 2.13 1.63 6 1.63s6-1.23 6-1.63v-2.24c-1.43.91-3.69 1.45-6 1.45Z"
            fill="currentColor"
          />
        </svg>
      );
    case "runtime":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Zm0 2v7h16v-7H4Zm2 1.75h6v1.5H6v-1.5Zm0 3h9.5v1.5H6v-1.5Zm10.8-2.88a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}
