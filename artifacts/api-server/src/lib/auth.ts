import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "cotopia-dev-secret-change-in-production";

export interface JwtPayload {
  userId: number;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = verifyToken(token);
    const [fresh] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);
    req.user = { userId: payload.userId, role: fresh?.role ?? payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(auth.slice(7));
      const [fresh] = await db
        .select({ role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, payload.userId))
        .limit(1);
      req.user = { userId: payload.userId, role: fresh?.role ?? payload.role };
    } catch {
      // ignore invalid token in optional auth
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
