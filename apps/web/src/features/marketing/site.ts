/**
 * Identity of the deployment. Forks set these at build time (see .env.example) so the
 * app, legal pages and footer name the operator who actually runs it.
 */
const env = import.meta.env;

export const OPERATOR: string = env.VITE_OPERATOR_NAME || "Hinterbuild";
export const PRODUCT = "IELTS Speaking";
export const PRODUCT_FULL: string = env.VITE_PRODUCT_FULL_NAME || `${PRODUCT} by ${OPERATOR}`;
export const SUPPORT_EMAIL: string = env.VITE_SUPPORT_EMAIL || "support@hinterbuild.com";
export const LEGAL_UPDATED: string = env.VITE_LEGAL_UPDATED || "30 September 2026";
