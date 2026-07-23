import { redirect } from 'next/navigation';

// After flattening, the console home is /projects. /app was the old monorepo
// console root; keep this redirect as a fallback for any stale links,
// bookmarks, or historical session returnTo values that still point at /app.
export default function AppIndexRedirect() {
  redirect('/projects');
}
