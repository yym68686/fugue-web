import {
  ConsoleLoadingState,
  ConsoleProjectGalleryTransitionSkeleton,
} from "@/components/console/console-page-skeleton";

export default function AppLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleProjectGalleryTransitionSkeleton />
    </ConsoleLoadingState>
  );
}
