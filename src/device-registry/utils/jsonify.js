const { parse, stringify, toJSON, fromJSON } = require("flatted");

class RecursiveMap extends Map {
  static fromJSON(any) {
    return new this(fromJSON(any));
  }
  toJSON() {
    return toJSON([...this.entries()]);
  }
}

const jsonParse = (dataFromDatabase) => {
  let jsonData = stringify(dataFromDatabase);
  let parsedMap = parse(jsonData);
  return parsedMap;
};

module.exports = jsonParse;
