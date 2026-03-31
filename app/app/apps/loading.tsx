import {
  ConsoleAdminAppsPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";

export default function AppsLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleAdminAppsPageSkeleton />
    </ConsoleLoadingState>
  );
}
