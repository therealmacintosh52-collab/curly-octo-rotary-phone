import type { UserRole } from "@/lib/db/types";

/**
 * Who may do what. The owner alone sees money (prices, invoices, payments,
 * income). Owner and admin run the company (settings, users, dealerships).
 * A manager sees every job. A detailer sees their own jobs.
 */
export const isOwner = (role: UserRole) => role === "owner";
/** Invoices, payments, income, the price list, the export: the owner's alone. */
export const canSeeMoney = isOwner;
export const isOwnerAdmin = (role: UserRole) => role === "owner" || role === "admin";
/** Every job and the team dashboard (no money). */
export const isCompanyWide = (role: UserRole) => isOwnerAdmin(role) || role === "manager";
/** Settings, users, export. */
export const canManageSettings = isOwnerAdmin;
/** Prices on a job (price list while logging, lines on the job page, overrides): owner and admin. */
export const canPriceJobs = isOwnerAdmin;
