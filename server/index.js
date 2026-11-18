const http = require("node:http");
const path = require("node:path");
const { openDatabase } = require("./db");
const { createApplication } = require("./app");

const directory = path.resolve(process.env.RANDOM_DATA_DIR || "./var");
const db = openDatabase(path.join(directory, "random.sqlite"));
const app = createApplication(db);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || process.env.IP || "127.0.0.1";
http.createServer(app.handler).listen(port, host, () => {
  console.log(`RANDOM listening at http://${host}:${port}`);
});
