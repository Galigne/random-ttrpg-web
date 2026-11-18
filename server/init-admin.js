const path = require("node:path");
const { openDatabase, transaction } = require("./db");
const { id, validUsername, hashPassword } = require("./security");

async function readPassword() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks)
      .toString("utf8")
      .replace(/\r?\n$/, "");
  }
  process.stdout.write("Password (at least 12 characters): ");
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    function done() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") {
          done();
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          done();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    }
    process.stdin.on("data", onData);
  });
}
async function main() {
  const username = process.argv[2];
  if (!validUsername(username))
    throw new Error(
      "Provide a username of 3–32 letters, digits, dots, hyphens or underscores.",
    );
  const db = openDatabase(
    path.join(
      path.resolve(process.env.RANDOM_DATA_DIR || "./var"),
      "random.sqlite",
    ),
  );
  try {
    if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get())
      throw new Error("An administrator already exists.");
    const password = await hashPassword(await readPassword());
    transaction(db, () => {
      if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get())
        throw new Error("An administrator already exists.");
      db.prepare(
        "INSERT INTO users(id,username,password_hash,role,status,language,created_at) VALUES(?,?,?,'admin','active','en',?)",
      ).run(id(), username, password, Date.now());
    });
    console.log("Administrator created.");
  } finally {
    db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
