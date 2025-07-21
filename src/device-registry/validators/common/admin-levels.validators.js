const AdminLevelModel = require("@models/AdminLevel");

const validAdminLevels = async () => {
  const levels = await AdminLevelModel("airqo").distinct("name");
  return levels.map((level) => level.toLowerCase());
};

const validateAdminLevels = async (value) => {
  if (!value || typeof value !== "string") {
    throw new Error("Level value must be a non-empty string");
  }
  try {
    const levels = await validAdminLevels();
    if (!levels.includes(value.toLowerCase())) {
      throw new Error(
        `Invalid level "${value}". Valid levels are: ${levels.join(", ")}`
      );
    }
  } catch (error) {
    if (error.message.startsWith("Invalid level")) {
      throw error;
    }
    throw new Error("Failed to validate admin level due to internal error");
  }
};

module.exports = { validateAdminLevels };
