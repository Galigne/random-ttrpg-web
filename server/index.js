const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { openDatabase } = require("./db");
const { createApplication } = require("./app");

const directory = path.resolve(process.env.RANDOM_DATA_DIR || "./var");
const db = openDatabase(path.join(directory, "random.sqlite"));
const app = createApplication(db);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || process.env.IP || "127.0.0.1";
// Capture release identity once, so a process left running after reconfiguration
// continues to report the release it actually loaded.
const releaseRoot = path.resolve(__dirname, "..");
const releaseName = path.basename(releaseRoot);
let deployedRelease;
try {
  const marker = fs.readFileSync(path.join(releaseRoot, ".random-release"), "utf8").trim();
  if (marker === releaseName && /^random-release-[a-f0-9]{40}-[a-f0-9]{32}$/.test(marker))
    deployedRelease = marker;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const server = http.createServer((req, res) => {
  if (deployedRelease && req.method === "GET" && req.url.split("?")[0] === "/")
    res.setHeader("X-Random-Release", deployedRelease);
  return app.handler(req, res);
});
server.listen(port, host, () => {
  console.log(`RANDOM listening at http://${host}:${server.address().port}`);
});
