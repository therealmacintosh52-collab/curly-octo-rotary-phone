import type { UserRole } from "@/lib/db/types";

/**
 * Who may do what. The owner alone sees money (prices, invoices, payments,
 * income). Owner and admin run the company (settings, users, dealerships).
 * An advisor runs the retail counter: every job, estimates with their money,
 * retail balances; no Settings, invoices or income. A manager sees every job.
 * A detailer sees their own jobs.
 */
export const isOwner = (role: UserRole) => role === "owner";
/** Invoices, payments, income, the price list, the export: the owner's alone. */
export const canSeeMoney = isOwner;
export const isOwnerAdmin = (role: UserRole) => role === "owner" || role === "admin";
/** Every job and the team dashboard (no money). */
export const isCompanyWide = (role: UserRole) => isOwnerAdmin(role) || role === "manager" || role === "advisor";
/** The service advisor (0043). */
export const isAdvisor = (role: UserRole) => role === "advisor";
/** Settings, users, export. */
export const canManageSettings = isOwnerAdmin;
/** The amount of an "Other" line on a job, estimate money, retail balances: owner, admin, advisor. */
export const canPriceJobs = (role: UserRole) => isOwnerAdmin(role) || isAdvisor(role);
