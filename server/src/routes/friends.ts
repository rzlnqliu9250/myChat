import { Router } from "express";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";
import { userManager } from "../managers/UserManager";

export const friendsRouter = Router();

friendsRouter.get("/friends", requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const friendships = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (friendships.error) {
      next(friendships.error);
      return;
    }

    const friendIds = friendships.data
      .map((f) => (f.user_id === userId ? f.friend_id : f.user_id))
      .filter(Boolean);

    if (friendIds.length === 0) {
      res.json({ friends: [] });
      return;
    }

    const friends = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", friendIds);

    if (friends.error) {
      next(friends.error);
      return;
    }

    res.json({
      friends: friends.data.map((u) => ({
        id: u.id,
        username: u.username,
        nickname: u.username,
        avatarUrl: u.avatar_url ?? null,
        online: userManager.isUserOnline(u.id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

friendsRouter.post("/friends/request", requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { username } = req.body as { username?: string };
    if (!username) {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const target = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (target.error) {
      next(target.error);
      return;
    }

    if (!target.data) {
      res.status(404).json({ error: "user not found" });
      return;
    }

    const friendId = target.data.id;
    if (friendId === userId) {
      res.status(400).json({ error: "cannot add yourself" });
      return;
    }

    const existing = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
      )
      .maybeSingle();

    if (existing.error && existing.error.code !== "PGRST116") {
      next(existing.error);
      return;
    }

    if (existing.data) {
      res
        .status(409)
        .json({ error: `friendship already exists (${existing.data.status})` });
      return;
    }

    const created = await supabase
      .from("friendships")
      .insert({ user_id: userId, friend_id: friendId, status: "pending" })
      .select("id, user_id, friend_id, status, created_at")
      .single();

    if (created.error) {
      next(created.error);
      return;
    }

    res.status(201).json({ request: created.data });
  } catch (err) {
    next(err);
  }
});

friendsRouter.get("/friends/requests", requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const pending = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (pending.error) {
      next(pending.error);
      return;
    }

    const requesterIds = pending.data.map((r) => r.user_id).filter(Boolean);

    const users = requesterIds.length
      ? await supabase
          .from("users")
          .select("id, username, avatar_url")
          .in("id", requesterIds)
      : { data: [], error: null };

    if (users.error) {
      next(users.error);
      return;
    }

    const userMap = new Map(users.data.map((u) => [u.id, u] as const));

    res.json({
      requests: pending.data.map((r) => {
        const u = userMap.get(r.user_id);
        return {
          id: r.id,
          fromUser: u
            ? {
                id: u.id,
                username: u.username,
                nickname: u.username,
                avatarUrl: u.avatar_url ?? null,
              }
            : null,
          createdAt: r.created_at,
          status: r.status,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

friendsRouter.post(
  "/friends/requests/:requestId/accept",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const requestId = req.params.requestId;
      const request = await supabase
        .from("friendships")
        .select("id, friend_id, status")
        .eq("id", requestId)
        .maybeSingle();

      if (request.error) {
        next(request.error);
        return;
      }

      if (!request.data) {
        res.status(404).json({ error: "request not found" });
        return;
      }

      if (request.data.friend_id !== userId) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      if (request.data.status !== "pending") {
        res.status(409).json({ error: `request is ${request.data.status}` });
        return;
      }

      const updated = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId)
        .select("id, user_id, friend_id, status")
        .single();

      if (updated.error) {
        next(updated.error);
        return;
      }

      res.json({ friendship: updated.data });
    } catch (err) {
      next(err);
    }
  },
);

friendsRouter.post(
  "/friends/requests/:requestId/reject",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const requestId = req.params.requestId;
      const request = await supabase
        .from("friendships")
        .select("id, friend_id")
        .eq("id", requestId)
        .maybeSingle();

      if (request.error) {
        next(request.error);
        return;
      }

      if (!request.data) {
        res.status(404).json({ error: "request not found" });
        return;
      }

      if (request.data.friend_id !== userId) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      const deleted = await supabase
        .from("friendships")
        .delete()
        .eq("id", requestId);
      if (deleted.error) {
        next(deleted.error);
        return;
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
