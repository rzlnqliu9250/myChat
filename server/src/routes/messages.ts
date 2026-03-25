/**
 * 消息路由：提供聊天记录查询接口（按双方 userId 拉取历史消息）。
 */
import { Router } from "express";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";

export const messagesRouter = Router();

async function assertCanAccessMessage(params: {
    userId: string;
    messageId: number;
}): Promise<
    | { ok: true }
    | { ok: false; status: number; error: string }
> {
    const { userId, messageId } = params;

    const msg = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, group_id")
        .eq("id", messageId)
        .maybeSingle();

    if (msg.error) {
        return { ok: false, status: 500, error: "db error" };
    }

    if (!msg.data) {
        return { ok: false, status: 404, error: "message not found" };
    }

    const senderId = String((msg.data as any).sender_id || "");
    const receiverId = (msg.data as any).receiver_id
        ? String((msg.data as any).receiver_id)
        : null;
    const groupId = (msg.data as any).group_id
        ? String((msg.data as any).group_id)
        : null;

    if (groupId) {
        const membership = await supabase
            .from("group_members")
            .select("group_id")
            .eq("group_id", groupId)
            .eq("user_id", userId)
            .maybeSingle();

        if (membership.error) {
            return { ok: false, status: 500, error: "db error" };
        }

        if (!membership.data) {
            return { ok: false, status: 403, error: "forbidden" };
        }

        return { ok: true };
    }

    if (senderId !== userId && receiverId !== userId) {
        return { ok: false, status: 403, error: "forbidden" };
    }

    return { ok: true };
}

 messagesRouter.get("/messages/search", requireAuth, async (req, res, next) => {
     try {
         const userId = req.userId;
         if (!userId) {
             res.status(401).json({ error: "Unauthorized" });
             return;
         }

         const friendId =
             typeof req.query.friendId === "string"
                 ? req.query.friendId
                 : undefined;
         const groupId =
             typeof req.query.groupId === "string" ? req.query.groupId : undefined;
         const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

         if ((!friendId && !groupId) || (friendId && groupId)) {
             res.status(400).json({ error: "friendId or groupId is required" });
             return;
         }

         if (!q) {
             res.status(400).json({ error: "q is required" });
             return;
         }

         const limitRaw = req.query.limit;
         const offsetRaw = req.query.offset;
         const limit =
             typeof limitRaw === "string" && Number.isFinite(Number(limitRaw))
                 ? Math.min(200, Math.max(1, Number(limitRaw)))
                 : 50;
         const offset =
             typeof offsetRaw === "string" && Number.isFinite(Number(offsetRaw))
                 ? Math.max(0, Number(offsetRaw))
                 : 0;

         const fromRaw = req.query.from;
         const toRaw = req.query.to;
         const from = typeof fromRaw === "string" ? fromRaw.trim() : "";
         const to = typeof toRaw === "string" ? toRaw.trim() : "";

         if (groupId) {
             const membership = await supabase
                 .from("group_members")
                 .select("group_id")
                 .eq("group_id", groupId)
                 .eq("user_id", userId)
                 .maybeSingle();

             if (membership.error) {
                 next(membership.error);
                 return;
             }

             if (!membership.data) {
                 res.status(403).json({ error: "forbidden" });
                 return;
             }
         }

         const buildQuery = (select: string) => {
             let query = supabase.from("messages").select(select);

             if (groupId) {
                 query = query.eq("group_id", groupId);
             } else {
                 query = query.or(
                     `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
                 );
             }

             query = query.ilike("content", `%${q}%`);

             if (from) {
                 query = query.gte("created_at", from);
             }
             if (to) {
                 query = query.lte("created_at", to);
             }

             return query
                 .order("created_at", { ascending: false })
                 .range(offset, offset + limit - 1);
         };

         let result = await buildQuery(
             "id, sender_id, receiver_id, group_id, content, is_read, created_at, message_type, media_url, media_mime, media_size",
         );

         if (
             result.error &&
             (result.error as any).message &&
             String((result.error as any).message).includes("message_type")
         ) {
             result = await buildQuery(
                 "id, sender_id, receiver_id, group_id, content, is_read, created_at, type, media_url, media_mime, media_size",
             );
         }

         if (result.error) {
             next(result.error);
             return;
         }

         const rows = (result.data || []) as any[];

         let senderMap = new Map<string, any>();
         if (groupId) {
             const senderIds = Array.from(
                 new Set(
                     rows
                         .map((m: any) => String(m.sender_id || ""))
                         .filter(Boolean),
                 ),
             );

             if (senderIds.length) {
                 const senders = await supabase
                     .from("users")
                     .select("id, username, nickname, avatar_url")
                     .in("id", senderIds);

                 if (senders.error) {
                     next(senders.error);
                     return;
                 }

                 (senders.data || []).forEach((u: any) => {
                     senderMap.set(String(u.id), {
                         nickname: u.nickname ?? u.username,
                         avatarUrl: u.avatar_url ?? null,
                     });
                 });
             }
         }

         res.json({
             messages: rows.map((m: any) => ({
                 ...(groupId
                     ? senderMap.get(String(m.sender_id))
                         ? {
                               senderNickname: senderMap.get(String(m.sender_id))
                                   .nickname,
                               senderAvatarUrl: senderMap.get(
                                   String(m.sender_id),
                               ).avatarUrl,
                           }
                         : { senderNickname: null, senderAvatarUrl: null }
                     : {}),
                 id: String(m.id),
                 senderId: m.sender_id,
                 receiverId: m.receiver_id ?? null,
                 groupId: m.group_id ?? null,
                 content: m.content,
                 type:
                     (m as any).message_type ||
                     (m as any).type ||
                     ("text" as const),
                 mediaUrl: (m as any).media_url ?? null,
                 mediaMime: (m as any).media_mime ?? null,
                 mediaSize: (m as any).media_size ?? null,
                 isRead: m.is_read,
                 createdAt: m.created_at,
             })),
         });
     } catch (err) {
         next(err);
     }
 });

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

            const buildQuery = (select: string) =>
                supabase
                    .from("messages")
                    .select(select)
                    .or(
                        `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
                    )
                    .order("created_at", { ascending: true });

            let result = await buildQuery(
                "id, sender_id, receiver_id, content, is_read, created_at, message_type, media_url, media_mime, media_size",
            );

            if (
                result.error &&
                (result.error as any).message &&
                String((result.error as any).message).includes("message_type")
            ) {
                result = await buildQuery(
                    "id, sender_id, receiver_id, content, is_read, created_at, type, media_url, media_mime, media_size",
                );
            }

            if (result.error) {
                next(result.error);
                return;
            }

            // 返回格式：下划线转驼峰
            // 数据库字段一般是 snake_case（如 sender_id）
            // 前端习惯用 camelCase（如 senderId）
            // 所以这里做了一层映射，前端就能直接用。
            const rows = (result.data || []) as any[];
            res.json({
                messages: rows.map((m: any) => ({
                    id: String(m.id),
                    senderId: m.sender_id,
                    receiverId: m.receiver_id,
                    content: m.content,
                    type:
                        (m as any).message_type ||
                        (m as any).type ||
                        ("text" as const),
                    mediaUrl: (m as any).media_url ?? null,
                    mediaMime: (m as any).media_mime ?? null,
                    mediaSize: (m as any).media_size ?? null,
                    isRead: m.is_read,
                    createdAt: m.created_at,
                })),
            });
        } catch (err) {
            next(err);
        }
    },
);

messagesRouter.post("/favorites/status", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const ids = Array.isArray((req.body as any)?.messageIds)
            ? ((req.body as any).messageIds as unknown[])
            : [];

        const messageIds = Array.from(
            new Set(
                ids
                    .map((v) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? n : null;
                    })
                    .filter((v): v is number => v !== null),
            ),
        ).slice(0, 500);

        if (!messageIds.length) {
            res.json({ favorites: {} });
            return;
        }

        const result = await supabase
            .from("favorites")
            .select("message_id")
            .eq("user_id", userId)
            .in("message_id", messageIds);

        if (result.error) {
            next(result.error);
            return;
        }

        const favorites: Record<string, boolean> = {};
        messageIds.forEach((id) => {
            favorites[String(id)] = false;
        });

        (result.data || []).forEach((row: any) => {
            const mid = row?.message_id;
            if (mid !== undefined && mid !== null) {
                favorites[String(mid)] = true;
            }
        });

        res.json({ favorites });
    } catch (err) {
        next(err);
    }
});

messagesRouter.post("/favorites", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const messageIdRaw = (req.body as any)?.messageId;
        const messageId = Number(messageIdRaw);
        if (!Number.isFinite(messageId)) {
            res.status(400).json({ error: "messageId is required" });
            return;
        }

        const access = await assertCanAccessMessage({ userId, messageId });
        if (!access.ok) {
            res.status(access.status).json({ error: access.error });
            return;
        }

        const insertResult = await supabase
            .from("favorites")
            .insert({ user_id: userId, message_id: messageId })
            .select("id")
            .maybeSingle();

        if (insertResult.error) {
            const code = (insertResult.error as any)?.code;
            if (code === "23505") {
                res.json({ ok: true });
                return;
            }
            next(insertResult.error);
            return;
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

messagesRouter.get("/favorites", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const limitRaw = req.query.limit;
        const limit =
            typeof limitRaw === "string" && Number.isFinite(Number(limitRaw))
                ? Math.min(200, Math.max(1, Number(limitRaw)))
                : 200;

        const favRes = await supabase
            .from("favorites")
            .select("message_id, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .range(0, limit - 1);

        if (favRes.error) {
            next(favRes.error);
            return;
        }

        const ids = Array.from(
            new Set(
                (favRes.data || [])
                    .map((r: any) => Number(r?.message_id))
                    .filter((n: any) => Number.isFinite(n)),
            ),
        );

        if (!ids.length) {
            res.json({ messages: [] });
            return;
        }

        let msgRes: any = await supabase
            .from("messages")
            .select(
                "id, sender_id, receiver_id, group_id, content, is_read, created_at, message_type, media_url, media_mime, media_size",
            )
            .in("id", ids);

        if (
            msgRes.error &&
            (msgRes.error as any).message &&
            String((msgRes.error as any).message).includes("message_type")
        ) {
            msgRes = await supabase
                .from("messages")
                .select(
                    "id, sender_id, receiver_id, group_id, content, is_read, created_at, type, media_url, media_mime, media_size",
                )
                .in("id", ids);
        }

        if (msgRes.error) {
            next(msgRes.error);
            return;
        }

        const rows = (msgRes.data || []) as any[];

        // 拉取发送者信息（用于收藏列表展示头像/昵称）
        const senderIds = Array.from(
            new Set(rows.map((m: any) => String(m.sender_id || "")).filter(Boolean)),
        );
        const senderMap = new Map<string, any>();
        if (senderIds.length) {
            const senders = await supabase
                .from("users")
                .select("id, username, nickname, avatar_url")
                .in("id", senderIds);

            if (senders.error) {
                next(senders.error);
                return;
            }

            (senders.data || []).forEach((u: any) => {
                senderMap.set(String(u.id), {
                    nickname: u.nickname ?? u.username,
                    avatarUrl: u.avatar_url ?? null,
                });
            });
        }

        // 让返回顺序与 favorites 表的 created_at 一致
        const orderIndex = new Map<number, number>();
        (favRes.data || []).forEach((r: any, idx: number) => {
            const id = Number(r?.message_id);
            if (Number.isFinite(id) && !orderIndex.has(id)) {
                orderIndex.set(id, idx);
            }
        });

        const sorted = rows
            .slice()
            .sort((a: any, b: any) => {
                const ia = orderIndex.get(Number(a.id)) ?? 0;
                const ib = orderIndex.get(Number(b.id)) ?? 0;
                return ia - ib;
            });

        res.json({
            messages: sorted.map((m: any) => {
                const sender = senderMap.get(String(m.sender_id)) || null;
                return {
                    id: String(m.id),
                    senderId: m.sender_id,
                    senderNickname: sender ? sender.nickname : null,
                    senderAvatarUrl: sender ? sender.avatarUrl : null,
                    receiverId: m.receiver_id ?? null,
                    groupId: m.group_id ?? null,
                    content: m.content,
                    type:
                        (m as any).message_type ||
                        (m as any).type ||
                        ("text" as const),
                    mediaUrl: (m as any).media_url ?? null,
                    mediaMime: (m as any).media_mime ?? null,
                    mediaSize: (m as any).media_size ?? null,
                    isRead: m.is_read,
                    createdAt: m.created_at,
                };
            }),
        });
    } catch (err) {
        next(err);
    }
});

messagesRouter.delete(
    "/favorites/:messageId",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const messageId = Number(req.params.messageId);
            if (!Number.isFinite(messageId)) {
                res.status(400).json({ error: "invalid messageId" });
                return;
            }

            const access = await assertCanAccessMessage({ userId, messageId });
            if (!access.ok) {
                res.status(access.status).json({ error: access.error });
                return;
            }

            const del = await supabase
                .from("favorites")
                .delete()
                .eq("user_id", userId)
                .eq("message_id", messageId);

            if (del.error) {
                next(del.error);
                return;
            }

            res.status(204).send();
        } catch (err) {
            next(err);
        }
    },
);
