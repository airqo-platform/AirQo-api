const http = require("http");
const app = require("../app");
const normalizePort = (val) => {
  // Normalize port logic
};

const createServer = () => {
  const port = normalizePort(process.env.PORT || "3000");
  app.set("port", port);

  const server = http.createServer(app);
  server.listen(port);

  server.on("error", (error) => {
    // Error handling logic
  });

  server.on("listening", () => {
    // Listening event handling logic
  });
};

module.exports = createServer;
