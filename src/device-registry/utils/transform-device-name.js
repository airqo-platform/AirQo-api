const transformDeviceName = (name) => {
  let firstElement = name.split(" ").slice(0, 1);
  let removedOnlySpaces = firstElement[0].replace(/\s+/g, "_").toLowerCase();
  let removeHyphens = removedOnlySpaces.replace(/\-+/g, "_").toLowerCase();
  let enforcedNamingConvention = removeHyphens.replace(/airqo/, "aq");
  return enforcedNamingConvention;
};

module.exports = transformDeviceName;
