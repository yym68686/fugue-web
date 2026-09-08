import { startPageNavigation } from "@/lib/page-navigation-timing";

export function onRouterTransitionStart(url: string) {
  startPageNavigation(url);
}
