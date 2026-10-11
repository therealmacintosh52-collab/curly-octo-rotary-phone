import type { UserRole } from "@/lib/db/types";

/**
 * Who may do what. Owner and admin run the company (settings, users,
 * dealerships). A manager sees every job and runs invoicing. A detailer sees
 * their own jobs.
 */
export const isOwner = (role: UserRole) => role === "owner";
export const isOwnerAdmin = (role: UserRole) => role === "owner" || role === "admin";
/** Dashboard, every job, every invoice, sending paperwork. */
export const isCompanyWide = (role: UserRole) => isOwnerAdmin(role) || role === "manager";
/** Settings, users, export. */
export const canManageSettings = isOwnerAdmin;
