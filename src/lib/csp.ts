/**
 * Content-Security-Policy for HTML pages.
 * Required fields: default-src, script-src, style-src, img-src, object-src, base-uri, frame-ancestors.
 */
export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
