/**
 * Validate that a string is a well-formed email address.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validate that a string is a well-formed URL (http or https).
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate that a string resembles a phone number.
 * Accepts digits, spaces, dashes, parentheses, dots, and an optional leading '+'.
 * Requires at least 7 digit characters.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.trim();
  if (!/^[+]?[\d\s\-().]+$/.test(cleaned)) return false;
  const digits = cleaned.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Check that a value is not empty after trimming.
 * Works for strings; returns false for null, undefined, or whitespace-only strings.
 */
export function isNotEmpty(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return value.trim().length > 0;
}
