import app from "./app";
import { logger } from "./lib/logger";
import { startReleaseScheduler } from "./lib/publisher";
import { ensureTables } from "./lib/ensure-tables";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void ensureTables().then(() => {
  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startReleaseScheduler();
  });

  // Large file uploads (e.g. 200MB videos) can take several minutes on slow
  // connections. Node's default requestTimeout (5 min) and headersTimeout
  // (1 min) are too tight for that and silently kill the connection mid-upload
  // (surfacing to the client as a generic "Network error"). keepAliveTimeout
  // must exceed the reverse proxy's idle timeout (Replit/Render both use ~60s)
  // so the proxy doesn't reuse a connection the server has already closed.
  server.requestTimeout = 15 * 60 * 1000;
  server.headersTimeout = 70 * 1000;
  server.keepAliveTimeout = 65 * 1000;
});
