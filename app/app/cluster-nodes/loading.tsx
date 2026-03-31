import {
  ConsoleClusterNodesPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";

export default function ClusterNodesLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleClusterNodesPageSkeleton />
    </ConsoleLoadingState>
  );
}
