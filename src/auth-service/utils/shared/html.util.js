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

const sanitizeHtml = (html) => {
  if (!html) return "";
  // Remove script/style/iframe/object/embed/form blocks entirely (including content).
  let result = html.replace(
    /<(script|style|iframe|object|embed|form|input|button|select|textarea)[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  // Strip self-closing dangerous tags.
  result = result.replace(/<(script|style|iframe|object|embed|input|button)[^>]*\/?>/gi, "");
  // Process remaining tags: keep allowed ones, strip the rest.
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) return "";
    // Closing tags need no attribute processing.
    if (match.startsWith("</")) return `</${lowerTag}>`;
    // Strip event handlers and javascript: hrefs; keep safe href/target on <a>.
    let safeAttrs = "";
    if (lowerTag === "a") {
      const hrefMatch = attrs.match(/href\s*=\s*["']?([^"'\s>]*)["']?/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        if (!/^javascript:/i.test(href)) {
          safeAttrs = ` href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank"`;
        }
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
