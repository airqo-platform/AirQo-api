const jsonParse = (dataFromDatabase) => {
  let jsonData = JSON.stringify(dataFromDatabase);
  let parsedMap = JSON.parse(jsonData);
  return parsedMap;
};

module.exports = jsonParse;
