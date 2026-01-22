import { Router } from "express";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";

export const messagesRouter = Router();

messagesRouter.get(
  "/messages/:friendId",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const friendId = req.params.friendId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, is_read, created_at")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
        )
        .order("created_at", { ascending: true });

      if (result.error) {
        next(result.error);
        return;
      }

      res.json({
        messages: result.data.map((m) => ({
          id: String(m.id),
          senderId: m.sender_id,
          receiverId: m.receiver_id,
          content: m.content,
          isRead: m.is_read,
          createdAt: m.created_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);
