const fs = require("fs");
const yaml = require("js-yaml");

try {
  let fileContents = fs.readFileSync("services.yaml", "utf8");
  let data = yaml.safeLoad(fileContents);

  let extractedData = [];

  for (let route of data.spec.routes) {
    extractedData.push({
      path: route.path,
      service: route.action.proxy.upstream,
    });
  }

  console.log(extractedData);
} catch (e) {
  console.error(e);
}
