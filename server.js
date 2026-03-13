// server.js — Entry point for Node.js hosting platforms (Hostinger, etc.)
// This starts the Next.js production server on the port provided by the host.

// Force production mode. If NODE_ENV is not set by the host, Next.js would
// default to development mode (webpack watchers, HMR, no minification) which
// causes extremely high CPU and memory usage on shared hosting.
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = false; // always run production build on this server

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://0.0.0.0:${port} [production]`);
  });
});
