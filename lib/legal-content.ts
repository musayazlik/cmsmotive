import sanitizeHtml from "sanitize-html";

export function sanitizeLegalContent(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "span", "mark", "s", "sub", "sup"],
    allowedAttributes: {
      a: ["href", "title"], img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "style"], th: ["colspan", "rowspan", "style"],
      col: ["span", "width"], ol: ["start"],
      p: ["style"], h2: ["style"], h3: ["style"], h4: ["style"],
      span: ["style"], mark: ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/],
        width: [/^\d+(px|%)$/],
      },
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
  });
}
