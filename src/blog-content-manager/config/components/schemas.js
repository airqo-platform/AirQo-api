// components/schemas.js
exports.BlogArticleV1 = {
  type: "object",
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    content: { type: "string" },
    authorId: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
  },
};

exports.BlogArticleV2 = {
  type: "object",
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    content: { type: "string" },
    authorId: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};
