/**
 * Public URL utility for generating share links that work outside the platform.
 * 
 * IMPORTANT: Share links must NEVER use preview/development domains.
 * This ensures links work when shared externally (LinkedIn, email, etc.).
 */

/**
 * Get the public base URL for external share links.
 * 
 * Priority order:
 * 1. VITE_PUBLIC_APP_URL env var (if set)
 * 2. window.location.origin (only if NOT a preview/dev domain)
 * 3. Hard fallback: https://useclearmarket.io
 */
export function getPublicBaseUrl(): string {
  // 1. Check for explicit env var
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, ''); // Remove trailing slash
  }

  // 2. Check current origin - only use if it's a production domain
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    
    // Block preview/dev domains - these should NEVER be in share links
    const blockedPatterns = [
      'id-preview--',
      'lovable.app',
      'lovable.dev',
      'localhost',
      '127.0.0.1',
    ];
    
    const isBlocked = blockedPatterns.some(pattern => origin.includes(pattern));
    
    if (!isBlocked) {
      return origin;
    }
  }

  // 3. Hard fallback to production domain
  return 'https://useclearmarket.io';
}

/**
 * Generate a public share URL for a profile.
 * Always uses the short format: /s/:slug
 */
export function getPublicShareUrl(slug: string): string {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}/s/${slug}`;
}

/**
 * Check if the current environment is a preview/development environment.
 */
export function isPreviewEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  
  const origin = window.location.origin;
  return (
    origin.includes('id-preview--') ||
    origin.includes('lovable.app') ||
    origin.includes('lovable.dev') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
}
