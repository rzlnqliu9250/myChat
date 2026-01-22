import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
  userId: string;
};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function verifyToken(token: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment");
  }
  const payload = jwt.verify(token, secret) as JwtPayload;
  return payload.userId;
}
