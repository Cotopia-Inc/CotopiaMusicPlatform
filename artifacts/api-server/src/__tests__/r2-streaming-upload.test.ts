import { describe, it, expect, afterEach } from "vitest";
import http from "http";
import { Readable, Transform } from "stream";
import { streamingHttpPut } from "../lib/r2Storage";

/**
 * Regression test for the production OOM crash: the original bug was that
 * uploading through Cloudflare R2 (Render's production storage backend)
 * loaded the whole file into memory before/while sending it — first via
 * `express.raw()`, then (less obviously) via the global `fetch()` API even
 * with `duplex: "half"` set, since undici buffers Node stream bodies rather
 * than truly streaming them with backpressure.
 *
 * `streamingHttpPut` is the fix: it uses raw `http(s).request()` + `.pipe()`,
 * which streams with real backpressure. These tests exercise it against a
 * local plain-HTTP server (http.request shares streaming semantics with
 * https.request; only the transport differs) and assert on functional
 * correctness (all bytes arrive, errors propagate with their original
 * identity) — the memory-flatness itself was verified manually by watching
 * process RSS during a multi-hundred-MB transfer, which isn't practical to
 * assert on in a fast unit test.
 */

class UploadTooLargeError extends Error {
  constructor() {
    super("UPLOAD_TOO_LARGE");
    this.name = "UploadTooLargeError";
  }
}

class ByteLimitTransform extends Transform {
  private total = 0;
  constructor(private readonly maxBytes: number) {
    super();
  }
  get bytesRead(): number {
    return this.total;
  }
  _transform(chunk: Buffer, _enc: string, callback: (error?: Error | null, data?: Buffer) => void) {
    this.total += chunk.length;
    if (this.total > this.maxBytes) {
      callback(new UploadTooLargeError());
      return;
    }
    callback(null, chunk);
  }
}

function makeSource(totalBytes: number, chunkSize = 256 * 1024): Readable {
  let sent = 0;
  return new Readable({
    read() {
      if (sent >= totalBytes) {
        this.push(null);
        return;
      }
      const n = Math.min(chunkSize, totalBytes - sent);
      sent += n;
      this.push(Buffer.alloc(n, 97));
    },
  });
}

function startMockServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    let bytesReceived = 0;
    const server = http.createServer((req, res) => {
      bytesReceived = 0;
      req.on("data", (chunk: Buffer) => {
        bytesReceived += chunk.length;
      });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, bytesReceived }));
      });
      req.on("error", () => {
        res.destroy();
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

describe("streamingHttpPut (R2 upload streaming)", () => {
  let server: http.Server;
  let port: number;

  afterEach(() => {
    server?.close();
  });

  it("streams a large body through to completion without buffering it upfront", async () => {
    ({ server, port } = await startMockServer());

    const size = 20 * 1024 * 1024; // 20MB is plenty to prove streaming end-to-end in a fast test
    const source = makeSource(size);
    const limiter = new ByteLimitTransform(10 * 1024 * 1024 * 1024);
    source.on("error", (err) => limiter.destroy(err));
    source.pipe(limiter);

    await streamingHttpPut(
      http.request as unknown as typeof import("https").request,
      { hostname: "127.0.0.1", port, path: "/put", method: "PUT" },
      limiter,
    );

    expect(limiter.bytesRead).toBe(size);
  });

  it("propagates the original error type when the source stream errors mid-transfer", async () => {
    ({ server, port } = await startMockServer());

    const size = 20 * 1024 * 1024;
    const source = makeSource(size);
    const limiter = new ByteLimitTransform(1 * 1024 * 1024); // trips well before the full size
    source.on("error", (err) => limiter.destroy(err));
    source.pipe(limiter);

    await expect(
      streamingHttpPut(
        http.request as unknown as typeof import("https").request,
        { hostname: "127.0.0.1", port, path: "/put", method: "PUT" },
        limiter,
      ),
    ).rejects.toBeInstanceOf(UploadTooLargeError);
  });

  it("rejects with an error including the status on a non-2xx response", async () => {
    server = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "boom" }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    port = typeof address === "object" && address ? address.port : 0;

    const source = makeSource(1024);

    await expect(
      streamingHttpPut(
        http.request as unknown as typeof import("https").request,
        { hostname: "127.0.0.1", port, path: "/put", method: "PUT" },
        source,
      ),
    ).rejects.toThrow(/HTTP 500/);
  });
});
