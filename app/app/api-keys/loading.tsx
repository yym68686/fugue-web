import {
  ConsoleApiKeysPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";

export default function ApiKeysLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleApiKeysPageSkeleton />
    </ConsoleLoadingState>
  );
}
