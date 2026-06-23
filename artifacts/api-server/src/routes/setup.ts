import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/setup/reset-admin", async (req, res) => {
  const resetToken = process.env.ADMIN_RESET_TOKEN;
  if (!resetToken) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.query.token !== resetToken) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const migrations: string[] = [];

  await db.execute(
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ`
  );
  migrations.push("users.deletion_requested_at ensured");

  const hash = await bcrypt.hash("password123", 10);
  const updated = await db
    .update(usersTable)
    .set({ passwordHash: hash })
    .where(eq(usersTable.email, "admin@cotopia.org"))
    .returning({ id: usersTable.id, email: usersTable.email });

  if (updated.length === 0) {
    res.status(404).json({ error: "Admin account not found" });
    return;
  }

  res.json({
    ok: true,
    message: "Admin password reset to password123",
    account: updated[0],
    migrations,
  });
});

export default router;
