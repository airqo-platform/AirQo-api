const transformDeviceName = (name) => {
  let removedOnlySpaces = name.replace(/\s+/g, "_").toLowerCase();
  let enforcedNamingConvention = removedOnlySpaces.replace(/airqo/, "aq");
  return enforcedNamingConvention;
};

module.exports = transformDeviceName;
