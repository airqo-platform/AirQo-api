const fs = require('fs');
const path = require('path');

const testDirectory = './utils/test';

const testFiles = fs.readdirSync(testDirectory);
// const testFiles = ['/ut_create-location.js'];

const tests = [];

testFiles.forEach((file) => {
  const filePath = path.join(testDirectory, file);

  const fileContent = fs.readFileSync(filePath, 'utf8');

  const regex = /it\s*\(\s*['"](.+?)['"]/g;
  let match;
  while ((match = regex.exec(fileContent))) {
    const testName = match[1];
    const testCommand = `mocha ${filePath} --grep "${testName.replace(/"/g, '\\"')}" --exit`;
    tests.push(testCommand);
  }
});


console.log(tests.join('\0'));
