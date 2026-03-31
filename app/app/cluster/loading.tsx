import {
  ConsoleAdminClusterPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";

export default function ClusterLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleAdminClusterPageSkeleton />
    </ConsoleLoadingState>
  );
}
