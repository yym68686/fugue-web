import {
  ConsoleLoadingState,
  ConsoleProfileSettingsPageSkeleton,
} from "@/components/console/console-page-skeleton";

export default function SettingsLoading() {
  return (
    <ConsoleLoadingState label="Loading profile settings">
      <ConsoleProfileSettingsPageSkeleton />
    </ConsoleLoadingState>
  );
}
