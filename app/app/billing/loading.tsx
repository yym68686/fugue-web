import {
  ConsoleBillingPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";

export default function BillingLoading() {
  return (
    <ConsoleLoadingState>
      <ConsoleBillingPageSkeleton />
    </ConsoleLoadingState>
  );
}
