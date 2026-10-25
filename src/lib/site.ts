/** Public base URL for links in WhatsApp messages. */
export const siteUrl = () => process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
