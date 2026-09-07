// Canonical validation is shipped in the self-contained shared package.
export { responseCardsForMessage, safeCardUrl } from 'ozira-contracts';
import { validateResponseCard as validate } from 'ozira-contracts';
export function validateResponseCard(raw) {
  try { return validate(raw); } catch (_) { return null; }
}
