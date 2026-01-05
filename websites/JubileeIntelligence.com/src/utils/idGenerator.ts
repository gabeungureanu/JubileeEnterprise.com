import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID v4 for overlay entries.
 */
export function generateOverlayId(): string {
  return uuidv4();
}

/**
 * Validate that a string is a valid UUID.
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
