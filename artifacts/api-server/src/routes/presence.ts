import { Router } from "express";
import { GetPresenceCountParams, PostPresenceHeartbeatParams, PostPresenceHeartbeatBody, DeletePresenceParams, DeletePresenceQueryParams } from "@workspace/api-zod";

const router = Router();

const HEARTBEAT_TTL_MS = 30_000;
const RELEASE_MEMORY_MS = 60_000;

interface Session {
  lastSeen: number;
  epoch: string;
}

interface ReleaseRecord {
  epoch: string;
  releasedAt: number;
}

const sessions = new Map<string, Map<string, Session>>();
const released = new Map<string, Map<string, ReleaseRecord>>();

function contentKey(contentType: string, contentId: number): string {
  return `${contentType}:${contentId}`;
}

function pruneAndCount(key: string): number {
  const clients = sessions.get(key);
  if (!clients) return 0;
  const now = Date.now();
  for (const [clientId, session] of clients) {
    if (now - session.lastSeen > HEARTBEAT_TTL_MS) clients.delete(clientId);
  }
  if (clients.size === 0) {
    sessions.delete(key);
    return 0;
  }
  return clients.size;
}

function pruneReleased(key: string): void {
  const rel = released.get(key);
  if (!rel) return;
  const now = Date.now();
  for (const [clientId, record] of rel) {
    if (now - record.releasedAt > RELEASE_MEMORY_MS) rel.delete(clientId);
  }
  if (rel.size === 0) released.delete(key);
}

router.get("/presence/:contentType/:contentId", async (req, res): Promise<void> => {
  const params = GetPresenceCountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  const key = contentKey(params.data.contentType, params.data.contentId);
  res.json({ count: pruneAndCount(key) });
});

router.post("/presence/:contentType/:contentId", async (req, res): Promise<void> => {
  const params = PostPresenceHeartbeatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  const body = PostPresenceHeartbeatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const key = contentKey(params.data.contentType, params.data.contentId);

  pruneReleased(key);
  const releaseRecord = released.get(key)?.get(body.data.clientId);
  if (releaseRecord && releaseRecord.epoch === body.data.epoch) {
    // Stale heartbeat from a play session that already released — ignore it
    // so it can't resurrect a session the client already ended.
    res.json({ count: pruneAndCount(key) });
    return;
  }

  let clients = sessions.get(key);
  if (!clients) {
    clients = new Map<string, Session>();
    sessions.set(key, clients);
  }
  clients.set(body.data.clientId, { lastSeen: Date.now(), epoch: body.data.epoch });

  res.json({ count: pruneAndCount(key) });
});

router.delete("/presence/:contentType/:contentId", async (req, res): Promise<void> => {
  const params = DeletePresenceParams.safeParse(req.params);
  const query = DeletePresenceQueryParams.safeParse(req.query);
  if (!params.success || !query.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  const key = contentKey(params.data.contentType, params.data.contentId);
  const clients = sessions.get(key);
  clients?.delete(query.data.clientId);

  let rel = released.get(key);
  if (!rel) {
    rel = new Map<string, ReleaseRecord>();
    released.set(key, rel);
  }
  rel.set(query.data.clientId, { epoch: query.data.epoch, releasedAt: Date.now() });

  res.json({ count: pruneAndCount(key) });
});

export default router;
