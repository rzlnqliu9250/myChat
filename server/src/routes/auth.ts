import { Router } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../db/supabase";
import { hashPassword, verifyPassword } from "../utils/password";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { username, password, avatarUrl } = req.body as {
      username?: string;
      password?: string;
      avatarUrl?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const existing = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing.error) {
      next(existing.error);
      return;
    }

    if (existing.data) {
      res.status(409).json({ error: "username already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const created = await supabase
      .from("users")
      .insert({
        username,
        password: passwordHash,
        avatar_url: avatarUrl ?? null,
      })
      .select("id, username, avatar_url")
      .single();

    if (created.error) {
      next(created.error);
      return;
    }

    res.status(201).json({
      user: {
        id: created.data.id,
        username: created.data.username,
        avatarUrl: created.data.avatar_url ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const userResult = await supabase
      .from("users")
      .select("id, username, password, avatar_url")
      .eq("username", username)
      .maybeSingle();

    if (userResult.error) {
      next(userResult.error);
      return;
    }

    const user = userResult.data;
    if (!user) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Server misconfigured" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});
