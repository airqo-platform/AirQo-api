const getLastItem = (photo) => {
  const segements = photo.split("/").filter((segment) => segment);
  const lastSegment = segements[segements.length - 1];
  const removeFileExtension = lastSegment
    .split(".")
    .slice(0, -1)
    .join(".");
  return removeFileExtension;
};

module.exports = getLastItem;
