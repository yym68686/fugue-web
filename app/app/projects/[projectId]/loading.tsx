import {
  ConsoleLoadingState,
  ConsoleProjectDetailPageSkeleton,
} from "@/components/console/console-page-skeleton";

export default function ProjectDetailLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleProjectDetailPageSkeleton />
    </ConsoleLoadingState>
  );
}
