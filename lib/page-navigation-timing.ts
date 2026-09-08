let transition: { route: string; started: number } | undefined;

export function startPageNavigation(url: string) {
  transition = {
    route: new URL(url, window.location.href).pathname,
    started: performance.now(),
  };
}

export function pageNavigationStart(route: string): number | null {
  if (transition) return transition.route === route ? transition.started : null;
  return window.location.pathname === route ? 0 : null;
}
