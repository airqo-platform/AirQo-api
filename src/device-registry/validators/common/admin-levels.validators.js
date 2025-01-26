const AdminLevelModel = require("@models/AdminLevel");

const validAdminLevels = async () => {
  const levels = await AdminLevelModel("airqo").distinct("name");
  return levels.map((level) => level.toLowerCase());
};

const validateAdminLevels = async (value) => {
  const levels = await validAdminLevels();
  if (!levels.includes(value.toLowerCase())) {
    throw new Error("Invalid level");
  }
};

module.exports = { validateAdminLevels };
