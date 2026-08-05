const escapeHtml = (unsafe) => {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Allowlist-based HTML sanitizer for rich-text content (e.g. admin reply emails).
// Strips all tags except a safe formatting subset and removes dangerous attributes.
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "ul", "ol", "li", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "span", "div",
]);

// Only these URI schemes are safe to preserve in <a href>.
const SAFE_HREF_SCHEMES = /^(https?:|mailto:)/i;

const sanitizeHtml = (html) => {
  if (!html) return "";

  // Loop until stable — prevents nested/partial tag bypass (e.g. <scr<script>ipt>).
  let result = html;
  let previous;
  do {
    previous = result;
    result = result.replace(
      /<(script|style|iframe|object|embed|form|input|button|select|textarea)[\s\S]*?<\/\1\s*>/gi,
      "",
    );
  } while (result !== previous);

  // Strip self-closing dangerous tags; loop until stable for the same reason.
  do {
    previous = result;
    result = result.replace(
      /<(script|style|iframe|object|embed|input|button)[^>]*\/?>/gi,
      "",
    );
  } while (result !== previous);

  // Process remaining tags: keep allowed ones, strip the rest.
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) return "";
    // Closing tags need no attribute processing.
    if (match.startsWith("</")) return `</${lowerTag}>`;
    // For <a>, allowlist only http/https/mailto — blocklisting javascript: can
    // be bypassed via HTML entities or whitespace; allowlisting is unambiguous.
    let safeAttrs = "";
    if (lowerTag === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*["']?([^"'\s>]*)["']?/i);
      if (hrefMatch && SAFE_HREF_SCHEMES.test(hrefMatch[1])) {
        safeAttrs = ` href="${escapeHtml(hrefMatch[1])}" rel="noopener noreferrer" target="_blank"`;
      }
    }
    const selfClose = match.endsWith("/>") ? "/" : "";
    return `<${lowerTag}${safeAttrs}${selfClose}>`;
  });
  return result;
};

module.exports = {
  escapeHtml,
  sanitizeHtml,
};
