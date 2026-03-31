import {
  ConsoleLoadingState,
  ConsoleWorkspaceSettingsPageSkeleton,
} from "@/components/console/console-page-skeleton";

export default function SettingsLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleWorkspaceSettingsPageSkeleton />
    </ConsoleLoadingState>
  );
}
