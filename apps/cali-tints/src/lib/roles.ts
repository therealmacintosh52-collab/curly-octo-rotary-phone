import type { UserRole } from "@/lib/db/types";

/**
 * Who may do what. Owner and admin have everything. A manager runs invoicing
 * (dashboard, every invoice, sending, pay links, recording a payment that
 * arrived, matching Clover payments) but never opens the Terminal or takes a
 * payment. A detailer sees their own cars.
 */
export const isOwnerAdmin = (role: UserRole) => role === "owner" || role === "admin";
/** Dashboard, every invoice, sending and collecting paperwork. */
export const isCompanyWide = (role: UserRole) => isOwnerAdmin(role) || role === "manager";
/** The Terminal and every button that charges a card or takes cash. */
export const canTakePayments = isOwnerAdmin;
/** Settings, users, Clover, export. */
export const canManageSettings = isOwnerAdmin;
