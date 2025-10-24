const mongoose = require("mongoose");

const ThemeSchema = new mongoose.Schema(
  {
    primaryColor: {
      type: String,
      default: "#145FFF", // Default blue color
      validate: {
        validator: function (v) {
          // Validate hex color or CSS color names
          const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          const cssColorRegex =
            /^(red|blue|green|yellow|purple|orange|pink|cyan|magenta|black|white|gray|grey|brown)$/i;
          return hexColorRegex.test(v) || cssColorRegex.test(v);
        },
        message: "Invalid color format. Use hex (#RRGGBB) or CSS color names",
      },
    },
    mode: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "light",
    },
    interfaceStyle: {
      type: String,
      enum: ["default", "bordered"],
      default: "bordered",
    },
    contentLayout: {
      type: String,
      enum: ["compact", "wide"],
      default: "wide",
    },
  },
  { _id: false }
);

module.exports = ThemeSchema;
