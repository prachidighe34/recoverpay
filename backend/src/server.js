// Polyfill global crypto for older Node versions / environments where the
// Web Crypto API global isn't exposed by default — the MongoDB driver
// needs it for session UUIDs. Harmless no-op on Node 20+ where it's native.
if (!global.crypto) {
  global.crypto = require("crypto").webcrypto;
}

require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  require("./sockets/assistant.socket")(io);

  server.listen(env.port, () => {
    console.log(`StoreChat API running on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});