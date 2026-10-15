// Roles and route permissions. Pure (shared by the proxy, server components, API handlers and tests).
export const ADMIN_ROLES = ['owner', 'admin', 'tech'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const isAdminRole = (r: unknown): r is AdminRole => (ADMIN_ROLES as readonly unknown[]).includes(r);

/** owner and admin have the same reach in the app; "admin" exists so the owners can add office help later. */
export const isStaff = (r: AdminRole): boolean => r === 'owner' || r === 'admin';
export const STAFF: AdminRole[] = ['owner', 'admin'];
export const ANY_ROLE: AdminRole[] = ['owner', 'admin', 'tech'];

/** Pages and APIs a technician may open. Everything else under /admin and /api/admin is staff-only. */
const TECH_PREFIXES = ['/admin/today', '/admin/jobs/', '/admin/more', '/admin/offline', '/api/admin/tech/', '/api/admin/photo', '/api/admin/auth/'];

/** Routes that must work without a session. */
const PUBLIC_PREFIXES = ['/admin/login', '/admin/auth/', '/admin/manifest.webmanifest', '/admin/sw.js', '/admin/offline', '/api/admin/auth/', '/api/admin/stripe/webhook'];

export function isPublicAdminPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => (p.endsWith('/') ? path === p.slice(0, -1) || path.startsWith(p) : path === p || path.startsWith(`${p}/`)));
}

export function roleMayOpen(role: AdminRole, path: string): boolean {
  if (isStaff(role)) return true;
  if (path.includes('..') || path.includes('//')) return false;
  return TECH_PREFIXES.some((p) => (p.endsWith('/') ? path === p.slice(0, -1) || path.startsWith(p) : path === p || path.startsWith(`${p}/`)));
}

/** Where a role lands after login. */
export const homeFor = (role: AdminRole): string => (role === 'tech' ? '/admin/today' : '/admin');

/** Only same-site /admin paths are valid post-login redirects (blocks open redirects). */
export function safeNext(next: string | null | undefined, role: AdminRole): string {
  if (!next || !/^\/admin(\/[A-Za-z0-9\-_/.?=&%]*)?$/.test(next) || next.startsWith('//') || next.includes('..')) return homeFor(role);
  const path = next.split('?')[0]!;
  if (path.startsWith('/admin/login')) return homeFor(role);
  return roleMayOpen(role, path) ? next : homeFor(role);
}
