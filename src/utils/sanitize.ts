/**
 * Strip HTML tags from user input to prevent stored XSS.
 * Used for freeform text fields (names, titles, descriptions).
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Escape special characters in a LIKE/ILIKE pattern.
 * Prevents `%` and `_` in user input from acting as wildcards.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
