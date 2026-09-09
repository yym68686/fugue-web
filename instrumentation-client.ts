import { startPageNavigation, startPagePerformanceObservation } from "@/lib/page-navigation-timing";

startPagePerformanceObservation();

export function onRouterTransitionStart(url: string) {
  startPageNavigation(url);
}
