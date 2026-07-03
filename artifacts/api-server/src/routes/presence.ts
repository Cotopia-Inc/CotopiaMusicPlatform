import { Router } from "express";
import { GetPresenceCountParams, PostPresenceHeartbeatParams, PostPresenceHeartbeatBody } from "@workspace/api-zod";

const router = Router();

const HEARTBEAT_TTL_MS = 30_000;

const sessions = new Map<string, Map<string, number>>();

function contentKey(contentType: string, contentId: number): string {
  return `${contentType}:${contentId}`;
}

function pruneAndCount(key: string): number {
  const clients = sessions.get(key);
  if (!clients) return 0;
  const now = Date.now();
  for (const [clientId, lastSeen] of clients) {
    if (now - lastSeen > HEARTBEAT_TTL_MS) clients.delete(clientId);
  }
  if (clients.size === 0) {
    sessions.delete(key);
    return 0;
  }
  return clients.size;
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
  let clients = sessions.get(key);
  if (!clients) {
    clients = new Map<string, number>();
    sessions.set(key, clients);
  }
  clients.set(body.data.clientId, Date.now());

  res.json({ count: pruneAndCount(key) });
});

export default router;
