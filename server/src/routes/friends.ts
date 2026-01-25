/**
 * 接口:查看好友列表,发起好友申请,查看好友申请,同意好友申请,拒绝好友申请
 */
import { Router } from "express";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";
import { userManager } from "../managers/UserManager";
import { WebSocketEvent, type WebSocketMessage } from "../types";

export const friendsRouter = Router();

//发送 WS 的工具函数
//调用 userManager.sendMessageToUser(userId, message) 发送给指定用户
function notifyUser(userId: string, type: WebSocketEvent, data: any): void {
    const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
    };
    userManager.sendMessageToUser(userId, message);
}

friendsRouter.get("/friends", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;

        //从 friendships 表里找出“所有和我有关、并且已经成为好友”的关系记录。
        const friendships = await supabase
            .from("friendships")
            .select("user_id, friend_id") //只取这两列
            //user_id = 当前 userId 或者friend_id = 当前 userId满足其中一个条件就行
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
            .eq("status", "accepted"); //只要 status = accepted 的记录。

        if (friendships.error) {
            next(friendships.error);
            return;
        }
        //从关系记录里提取“对方的 id”
        const friendIds = friendships.data
            .map((f) => (f.user_id === userId ? f.friend_id : f.user_id))
            .filter(Boolean);

        if (friendIds.length === 0) {
            res.json({ friends: [] });
            return;
        }

        const friends = await supabase
            .from("users")
            .select("id, username, nickname, avatar_url")
            .in("id", friendIds); //查出 id 在 friendIds 里的所有用户

        if (friends.error) {
            next(friends.error);
            return;
        }

        res.json({
            friends: friends.data.map((u) => ({
                id: u.id,
                username: u.username,
                nickname: u.nickname ?? u.username,
                avatarUrl: u.avatar_url ?? null,
                online: userManager.isUserOnline(u.id),
            })),
        });
    } catch (err) {
        next(err);
    }
});

//输入对方的“用户名 username”，向对方发起好友申请（写入 friendships 表，状态 pending）。
friendsRouter.post("/friends/request", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;

        const { username } = req.body as { username?: string };
        if (!username) {
            res.status(400).json({ error: "username is required" });
            return;
        }
        // 在users表里找到此username对应的id
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
            res.status(400).json({ error: "不能加自己为好友" });
            return;
        }

        // 关系表里可能是：
        // user_id = 我, friend_id = 对方
        // 也可能是反过来：
        // user_id = 对方, friend_id = 我
        // 所以要用 OR 把两种方向都查一遍，避免重复申请/重复建立好友关系。
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
            res.status(409).json({
                error: `friendship already exists (${existing.data.status})`,
            });
            return;
        }

        // 插入一条申请记录
        // status: "pending" 表示待对方同意
        // .select(...).single()：插入后把关键字段拿回来返回给前端
        const created = await supabase
            .from("friendships")
            .insert({ user_id: userId, friend_id: friendId, status: "pending" })
            .select("id, user_id, friend_id, status, created_at")
            .single();

        if (created.error) {
            next(created.error);
            return;
        }

        //数据库写入 pending 后给 被申请方推送 FRIEND_REQUEST_CREATED
        notifyUser(friendId, WebSocketEvent.FRIEND_REQUEST_CREATED, {
            requestId: created.data.id,
        });

        res.status(201).json({ request: created.data });
    } catch (err) {
        next(err);
    }
});

//我查看别人发给我的好友申请（查 friendships 表里 friend_id = 我 且 status = pending 的记录）
// 并把申请人的用户信息拼出来返回给前端展示。
friendsRouter.get("/friends/requests", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;

        //从 friendships 查发给我的 pending 请求
        const pending = await supabase
            .from("friendships")
            .select("id, user_id, friend_id, status, created_at")
            .eq("friend_id", userId)
            .eq("status", "pending");

        if (pending.error) {
            next(pending.error);
            return;
        }

        //提取“申请人”id 列表
        const requesterIds = pending.data.map((r) => r.user_id).filter(Boolean);

        // 查 users 表把申请人的展示信息拿出来
        const users = requesterIds.length
            ? await supabase
                  .from("users")
                  .select("id, username, nickname, avatar_url")
                  .in("id", requesterIds)
            : { data: [], error: null };

        if (users.error) {
            next(users.error);
            return;
        }

        //用 Map 做 “id -> user信息” 映射，方便拼装返回
        const userMap = new Map(users.data.map((u) => [u.id, u] as const));

        //最终返回：每条请求都带 fromUser（用于前端展示昵称头像）
        res.json({
            requests: pending.data.map((r) => {
                const u = userMap.get(r.user_id);
                return {
                    id: r.id,
                    fromUser: u
                        ? {
                              id: u.id,
                              username: u.username,
                              nickname: u.nickname ?? u.username,
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
// :requestId 是 URL 路由参数
// 前端点“同意”会调用类似：/friends/requests/123/accept
// 那么 requestId = "123"
friendsRouter.post(
    "/friends/requests/:requestId/accept",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;

            //在 friendships 表按主键 id 查这条申请
            // 拿 friend_id（申请接收者）和 status（状态）
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
                res.status(409).json({
                    error: `request is ${request.data.status}`,
                });
                return;
            }

            //更新状态为 accepted，并返回
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

            //数据库改为 accepted 后给双方推送 FRIEND_REQUEST_ACCEPTED
            notifyUser(
                updated.data.user_id,
                WebSocketEvent.FRIEND_REQUEST_ACCEPTED,
                {
                    requestId: updated.data.id,
                    userId: updated.data.user_id,
                    friendId: updated.data.friend_id,
                },
            );
            notifyUser(
                updated.data.friend_id,
                WebSocketEvent.FRIEND_REQUEST_ACCEPTED,
                {
                    requestId: updated.data.id,
                    userId: updated.data.user_id,
                    friendId: updated.data.friend_id,
                },
            );

            res.json({ friendship: updated.data });
        } catch (err) {
            next(err);
        }
    },
);
//拒绝申请
friendsRouter.post(
    "/friends/requests/:requestId/reject",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;

            const requestId = req.params.requestId;
            const request = await supabase
                .from("friendships")
                .select("id, user_id, friend_id")
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
            //删除这条申请记录
            const deleted = await supabase
                .from("friendships")
                .delete()
                .eq("id", requestId);
            if (deleted.error) {
                next(deleted.error);
                return;
            }

            //数据库删除/更新后给申请方推送 FRIEND_REQUEST_REJECTED
            //目的：让申请方能实时收到“被拒绝”的反馈
            notifyUser(
                request.data.user_id,
                WebSocketEvent.FRIEND_REQUEST_REJECTED,
                {
                    requestId,
                    userId: request.data.user_id,
                    friendId: request.data.friend_id,
                },
            );

            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    },
);
