import {
  ConsoleAdminUsersPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";

export default function UsersLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleAdminUsersPageSkeleton />
    </ConsoleLoadingState>
  );
}
