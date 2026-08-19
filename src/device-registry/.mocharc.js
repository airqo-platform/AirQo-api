// Force mocha to exit once tests finish, even if a dependency (mongoose,
// log4js appenders, etc.) leaves an open handle behind. Without this, running
// a single test file directly (npx mocha some.test.js) can hang forever
// instead of just being slow — the npm "test" script already passes --exit
// explicitly, but that's easy to forget when running one file ad hoc.
module.exports = {
  exit: true,
};
