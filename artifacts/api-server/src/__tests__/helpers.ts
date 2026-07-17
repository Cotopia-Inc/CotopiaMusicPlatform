import request from "supertest";
import { inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  artistsTable,
  labelsTable,
  followsTable,
  userBlocksTable,
} from "@workspace/db";
import app from "../app";
import { signToken } from "../lib/auth";

export { app };

// All test requests carry a real browser User-Agent so the bot-detection
// middleware lets them through. Individual anti-scraping tests that need to
// probe bot blocking use `request(app)` directly and set their own UA.
const TEST_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const api = () => {
  const agent = request(app);
  return {
    get:    (url: string) => agent.get(url).set("User-Agent", TEST_UA),
    post:   (url: string) => agent.post(url).set("User-Agent", TEST_UA),
    put:    (url: string) => agent.put(url).set("User-Agent", TEST_UA),
    patch:  (url: string) => agent.patch(url).set("User-Agent", TEST_UA),
    delete: (url: string) => agent.delete(url).set("User-Agent", TEST_UA),
  };
};

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestUser {
  id: number;
  email: string;
  username: string;
  role: string;
  token: string;
}

export interface CreateUserOpts {
  role?: string;
  emailVerified?: boolean;
  isVerified?: boolean;
  messagePolicy?: string;
}

// A bcrypt hash of "password123" (cost 10). Tests that don't log in never read it.
const PLACEHOLDER_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function createUser(opts: CreateUserOpts = {}): Promise<TestUser> {
  const role = opts.role ?? "listener";
  const username = unique("u");
  const email = `${username}@test.cotopia`;
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash: PLACEHOLDER_HASH,
      username,
      displayName: username,
      role,
      emailVerified: opts.emailVerified ?? true,
      isVerified: opts.isVerified ?? false,
      messagePolicy: opts.messagePolicy ?? "followers_only",
    })
    .returning();
  return { id: user.id, email: user.email, username: user.username, role: user.role, token: signToken({ userId: user.id, role: user.role }) };
}

export async function createArtistProfile(userId: number): Promise<number> {
  const [artist] = await db
    .insert(artistsTable)
    .values({ userId, stageName: unique("artist") })
    .returning();
  return artist.id;
}

export async function createLabelProfile(userId: number): Promise<number> {
  const [label] = await db
    .insert(labelsTable)
    .values({ userId, name: unique("label") })
    .returning();
  return label.id;
}

export async function followArtist(followerId: number, artistId: number): Promise<void> {
  await db
    .insert(followsTable)
    .values({ followerId, targetType: "artist", targetId: artistId })
    .onConflictDoNothing();
}

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  await db
    .insert(userBlocksTable)
    .values({ blockerId, blockedId })
    .onConflictDoNothing();
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

// Deleting users cascades to artists, labels, follows, blocks, conversations,
// direct_messages, notifications, reports, feedback, enforcement_actions,
// admin_audit_logs, chat_messages and submissions (all FK onDelete: cascade).
export async function cleanupUsers(ids: number[]): Promise<void> {
  const real = ids.filter((id) => Number.isInteger(id));
  if (real.length) {
    await db.delete(usersTable).where(inArray(usersTable.id, real));
  }
}
