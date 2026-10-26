import parsePhoneNumber from "libphonenumber-js";

/** E.164 ("+919913407166") for any common way of writing a number (default region India), or null when it is not a valid number. */
export function normalizePhone(raw: string): string | null {
  const p = parsePhoneNumber(raw.trim(), "IN");
  return p?.isValid() ? p.number : null;
}
