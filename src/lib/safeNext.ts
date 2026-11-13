// Only allow redirects to a path on this site (e.g. "/reset-password").
// Rejects absolute URLs, protocol-relative "//evil.com", and values like
// "@evil.com" that would change the host when appended to the origin.
export function safeNext(next: string | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
