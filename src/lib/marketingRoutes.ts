/**
 * Check if a pathname is a public marketing route.
 * These routes should not show authenticated app UI elements like
 * the screenshot button or app-specific footer links.
 */
export function isMarketingRoute(pathname: string): boolean {
  const marketingPrefixes = [
    "/blog",
    "/terms",
    "/privacy",
  ];

  const exactMarketingRoutes = ["/"];

  if (exactMarketingRoutes.includes(pathname)) {
    return true;
  }

  return marketingPrefixes.some((prefix) => pathname.startsWith(prefix));
}
