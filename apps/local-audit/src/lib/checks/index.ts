/** Importing this module registers every check. Add new check files here. */
import "./conversion/phone-click-to-call";
import "./identity/nap-checks";

export * from "./registry";
export { runChecks, type CheckRunResult, type FindingDraft } from "./run";
export { phoneClickToCall } from "./conversion/phone-click-to-call";
export { phoneMismatch, addressMismatch, nameMismatch, websiteMissingNap, gbpWebsiteMismatch, gbpNotFound } from "./identity/nap-checks";
