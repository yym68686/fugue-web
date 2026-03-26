import { ConsolePageSkeleton } from "@/components/console/console-page-skeleton";

export default function AppLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading console page"
      className="fg-console-loading"
      role="status"
    >
      <ConsolePageSkeleton />
    </div>
  );
}
