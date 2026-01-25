/**
 * 消息路由：提供聊天记录查询接口（按双方 userId 拉取历史消息）。
 */
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

            // 用 .or(...) 表达 “两种情况满足其一即可”：
            // 情况 A：sender_id = 我 且 receiver_id = 朋友
            // 情况 B：sender_id = 朋友 且 receiver_id = 我
            // .order("created_at", { ascending: true })：按时间从旧到新排序，方便前端按顺序展示聊天记录。

            const result = await supabase
                .from("messages")
                .select(
                    "id, sender_id, receiver_id, content, is_read, created_at",
                )
                .or(
                    `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
                )
                .order("created_at", { ascending: true });

            if (result.error) {
                next(result.error);
                return;
            }

            // 返回格式：下划线转驼峰
            // 数据库字段一般是 snake_case（如 sender_id）
            // 前端习惯用 camelCase（如 senderId）
            // 所以这里做了一层映射，前端就能直接用。
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
