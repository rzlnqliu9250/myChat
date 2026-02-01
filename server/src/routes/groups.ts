import { Router } from "express";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";
import { userManager } from "../managers/UserManager";
import { WebSocketEvent, type WebSocketMessage } from "../types";

export const groupsRouter = Router();

type CreateGroupBody = {
    name?: string;
    memberIds?: string[];
    avatarUrl?: string | null;
};

type UpdateGroupBody = {
    name?: string;
    avatarUrl?: string | null;
};

type ModifyMembersBody = {
    memberIds?: string[];
};

function notifyUser(userId: string, type: WebSocketEvent, data: any): void {
    const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
    };
    userManager.sendMessageToUser(userId, message);
}

async function assertGroupMember(
    groupId: string,
    userId: string,
): Promise<boolean> {
    const membership = await supabase
        .from("group_members")
        .select("group_id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();

    if (membership.error) {
        throw membership.error;
    }

    return !!membership.data;
}

groupsRouter.post("/groups", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { name, memberIds, avatarUrl } = req.body as CreateGroupBody;
        const trimmedName = typeof name === "string" ? name.trim() : "";

        if (!trimmedName) {
            res.status(400).json({ error: "name is required" });
            return;
        }

        const normalizedMemberIds = Array.isArray(memberIds)
            ? memberIds.map((id) => String(id)).filter(Boolean)
            : [];

        const uniqueMemberIds = Array.from(
            new Set([userId, ...normalizedMemberIds]),
        );

        const createdGroup = await supabase
            .from("groups")
            .insert({
                name: trimmedName,
                owner_id: userId,
                avatar_url: avatarUrl ?? null,
            })
            .select("id, name, owner_id, avatar_url, created_at")
            .single();

        if (createdGroup.error || !createdGroup.data) {
            next(createdGroup.error);
            return;
        }

        const groupId = createdGroup.data.id;

        const membersToInsert = uniqueMemberIds.map((id) => ({
            group_id: groupId,
            user_id: id,
            role: id === userId ? "owner" : "member",
        }));

        const insertedMembers = await supabase
            .from("group_members")
            .insert(membersToInsert)
            .select("group_id, user_id, role, joined_at");

        if (insertedMembers.error) {
            next(insertedMembers.error);
            return;
        }

        const createdMemberIds = Array.from(
            new Set(
                (insertedMembers.data || [])
                    .map((m: any) => String(m.user_id || ""))
                    .filter(Boolean),
            ),
        ).filter((id) => id !== userId);

        createdMemberIds.forEach((memberId) => {
            notifyUser(memberId, WebSocketEvent.GROUP_MEMBERSHIP_CHANGED, {
                action: "added",
                groupId: String(groupId),
            });
        });

        res.status(201).json({
            group: {
                id: createdGroup.data.id,
                name: createdGroup.data.name,
                ownerId: createdGroup.data.owner_id,
                avatarUrl: createdGroup.data.avatar_url ?? null,
                createdAt: createdGroup.data.created_at,
            },
            members: (insertedMembers.data || []).map((m: any) => ({
                groupId: m.group_id,
                userId: m.user_id,
                role: m.role,
                joinedAt: m.joined_at,
            })),
        });
    } catch (err) {
        next(err);
    }
});

groupsRouter.get("/groups", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const membership = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", userId);

        if (membership.error) {
            next(membership.error);
            return;
        }

        const groupIds = (membership.data || [])
            .map((m: any) => m.group_id)
            .filter(Boolean);

        if (groupIds.length === 0) {
            res.json({ groups: [] });
            return;
        }

        const groups = await supabase
            .from("groups")
            .select("id, name, owner_id, avatar_url, created_at")
            .in("id", groupIds)
            .order("created_at", { ascending: false });

        if (groups.error) {
            next(groups.error);
            return;
        }

        res.json({
            groups: (groups.data || []).map((g: any) => ({
                id: g.id,
                name: g.name,
                ownerId: g.owner_id,
                avatarUrl: g.avatar_url ?? null,
                createdAt: g.created_at,
            })),
        });
    } catch (err) {
        next(err);
    }
});

groupsRouter.get(
    "/groups/:groupId/members",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const groupId = String(req.params.groupId || "");
            if (!groupId) {
                res.status(400).json({ error: "groupId is required" });
                return;
            }

            const isMember = await assertGroupMember(groupId, userId);
            if (!isMember) {
                res.status(403).json({ error: "forbidden" });
                return;
            }

            const members = await supabase
                .from("group_members")
                .select("user_id, role, joined_at")
                .eq("group_id", groupId);

            if (members.error) {
                next(members.error);
                return;
            }

            const memberIds = (members.data || [])
                .map((m: any) => m.user_id)
                .filter(Boolean);

            const users = memberIds.length
                ? await supabase
                      .from("users")
                      .select("id, username, nickname, avatar_url")
                      .in("id", memberIds)
                : { data: [], error: null };

            if (users.error) {
                next(users.error);
                return;
            }

            const userMap = new Map(
                (users.data || []).map((u: any) => [u.id, u] as const),
            );

            res.json({
                members: (members.data || []).map((m: any) => {
                    const u = userMap.get(m.user_id);
                    return {
                        user: u
                            ? {
                                  id: u.id,
                                  username: u.username,
                                  nickname: u.nickname ?? u.username,
                                  avatarUrl: u.avatar_url ?? null,
                              }
                            : null,
                        role: m.role,
                        joinedAt: m.joined_at,
                    };
                }),
            });
        } catch (err) {
            next(err);
        }
    },
);

groupsRouter.get(
    "/groups/:groupId/messages",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const groupId = String(req.params.groupId || "");
            if (!groupId) {
                res.status(400).json({ error: "groupId is required" });
                return;
            }

            const isMember = await assertGroupMember(groupId, userId);
            if (!isMember) {
                res.status(403).json({ error: "forbidden" });
                return;
            }

            const limitRaw = req.query.limit;
            const limit =
                typeof limitRaw === "string" &&
                Number.isFinite(Number(limitRaw))
                    ? Math.min(200, Math.max(1, Number(limitRaw)))
                    : 200;

            const buildQuery = (select: string) =>
                supabase
                    .from("messages")
                    .select(select)
                    .eq("group_id", groupId)
                    .order("created_at", { ascending: true })
                    .limit(limit);

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

            const senderIds = Array.from(
                new Set(
                    rows
                        .map((m: any) => String(m.sender_id || ""))
                        .filter(Boolean),
                ),
            );

            let senderMap = new Map<string, any>();
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

            res.json({
                messages: rows.map((m: any) => ({
                    ...(senderMap.get(String(m.sender_id))
                        ? {
                              senderNickname: senderMap.get(String(m.sender_id))
                                  .nickname,
                              senderAvatarUrl: senderMap.get(
                                  String(m.sender_id),
                              ).avatarUrl,
                          }
                        : { senderNickname: null, senderAvatarUrl: null }),
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
    },
);

groupsRouter.post(
    "/groups/:groupId/members",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const groupId = String(req.params.groupId || "");
            if (!groupId) {
                res.status(400).json({ error: "groupId is required" });
                return;
            }

            const membership = await supabase
                .from("group_members")
                .select("role")
                .eq("group_id", groupId)
                .eq("user_id", userId)
                .maybeSingle();

            if (membership.error) {
                next(membership.error);
                return;
            }

            if (!membership.data || membership.data.role !== "owner") {
                res.status(403).json({ error: "forbidden" });
                return;
            }

            const body = req.body as ModifyMembersBody;
            const memberIds = Array.isArray(body.memberIds)
                ? body.memberIds.map((id) => String(id)).filter(Boolean)
                : [];

            const uniqueMemberIds = Array.from(new Set(memberIds)).filter(
                (id) => id !== userId,
            );

            if (!uniqueMemberIds.length) {
                res.status(400).json({ error: "memberIds is required" });
                return;
            }

            const existing = await supabase
                .from("group_members")
                .select("user_id")
                .eq("group_id", groupId)
                .in("user_id", uniqueMemberIds);

            if (existing.error) {
                next(existing.error);
                return;
            }

            const existingSet = new Set(
                (existing.data || []).map((m: any) => String(m.user_id)),
            );

            const toInsert = uniqueMemberIds
                .filter((id) => !existingSet.has(id))
                .map((id) => ({
                    group_id: groupId,
                    user_id: id,
                    role: "member",
                }));

            if (!toInsert.length) {
                res.json({ membersAdded: [] });
                return;
            }

            const inserted = await supabase
                .from("group_members")
                .insert(toInsert)
                .select("group_id, user_id, role, joined_at");

            if (inserted.error) {
                next(inserted.error);
                return;
            }

            const addedUserIds = Array.from(
                new Set(
                    (inserted.data || [])
                        .map((m: any) => String(m.user_id || ""))
                        .filter(Boolean),
                ),
            );

            addedUserIds.forEach((addedUserId) => {
                notifyUser(
                    addedUserId,
                    WebSocketEvent.GROUP_MEMBERSHIP_CHANGED,
                    {
                        action: "added",
                        groupId,
                    },
                );
            });

            res.json({
                membersAdded: (inserted.data || []).map((m: any) => ({
                    groupId: m.group_id,
                    userId: m.user_id,
                    role: m.role,
                    joinedAt: m.joined_at,
                })),
            });
        } catch (err) {
            next(err);
        }
    },
);

groupsRouter.delete(
    "/groups/:groupId/members/:memberId",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const groupId = String(req.params.groupId || "");
            const memberId = String(req.params.memberId || "");
            if (!groupId || !memberId) {
                res.status(400).json({
                    error: "groupId and memberId are required",
                });
                return;
            }

            const membership = await supabase
                .from("group_members")
                .select("role")
                .eq("group_id", groupId)
                .eq("user_id", userId)
                .maybeSingle();

            if (membership.error) {
                next(membership.error);
                return;
            }

            if (!membership.data || membership.data.role !== "owner") {
                res.status(403).json({ error: "forbidden" });
                return;
            }

            const target = await supabase
                .from("group_members")
                .select("role")
                .eq("group_id", groupId)
                .eq("user_id", memberId)
                .maybeSingle();

            if (target.error) {
                next(target.error);
                return;
            }

            if (!target.data) {
                res.status(404).json({ error: "member not found" });
                return;
            }

            if (target.data.role === "owner") {
                res.status(400).json({ error: "cannot remove owner" });
                return;
            }

            const removed = await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId)
                .eq("user_id", memberId);

            if (removed.error) {
                next(removed.error);
                return;
            }

            notifyUser(memberId, WebSocketEvent.GROUP_MEMBERSHIP_CHANGED, {
                action: "kicked",
                groupId,
            });

            res.json({ success: true, removedUserId: memberId });
        } catch (err) {
            next(err);
        }
    },
);

groupsRouter.post(
    "/groups/:groupId/leave",
    requireAuth,
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const groupId = String(req.params.groupId || "");
            if (!groupId) {
                res.status(400).json({ error: "groupId is required" });
                return;
            }

            const membership = await supabase
                .from("group_members")
                .select("role")
                .eq("group_id", groupId)
                .eq("user_id", userId)
                .maybeSingle();

            if (membership.error) {
                next(membership.error);
                return;
            }

            if (!membership.data) {
                res.status(404).json({ error: "member not found" });
                return;
            }

            if (membership.data.role === "owner") {
                res.status(400).json({ error: "owner cannot leave" });
                return;
            }

            const removed = await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId)
                .eq("user_id", userId);

            if (removed.error) {
                next(removed.error);
                return;
            }

            notifyUser(userId, WebSocketEvent.GROUP_MEMBERSHIP_CHANGED, {
                action: "left",
                groupId,
            });

            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    },
);

groupsRouter.patch("/groups/:groupId", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const groupId = String(req.params.groupId || "");
        if (!groupId) {
            res.status(400).json({ error: "groupId is required" });
            return;
        }

        const membership = await supabase
            .from("group_members")
            .select("role")
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

        if (
            membership.data.role !== "owner" &&
            membership.data.role !== "admin"
        ) {
            res.status(403).json({ error: "forbidden" });
            return;
        }

        const { name, avatarUrl } = req.body as UpdateGroupBody;
        const patch: any = {};
        if (typeof name === "string") {
            const trimmed = name.trim();
            if (!trimmed) {
                res.status(400).json({ error: "name cannot be empty" });
                return;
            }
            patch.name = trimmed;
        }
        if (avatarUrl !== undefined) {
            patch.avatar_url = avatarUrl;
        }

        const updated = await supabase
            .from("groups")
            .update(patch)
            .eq("id", groupId)
            .select("id, name, owner_id, avatar_url, created_at")
            .single();

        if (updated.error) {
            next(updated.error);
            return;
        }

        res.json({
            group: {
                id: updated.data.id,
                name: updated.data.name,
                ownerId: updated.data.owner_id,
                avatarUrl: updated.data.avatar_url ?? null,
                createdAt: updated.data.created_at,
            },
        });
    } catch (err) {
        next(err);
    }
});
