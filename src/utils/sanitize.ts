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

/**
 * Escape HTML special characters to prevent XSS in rendered HTML.
 * Used when interpolating user-supplied values into HTML templates.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
