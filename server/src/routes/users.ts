import { Router } from "express";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";
import { hashPassword } from "../utils/password";

export const usersRouter = Router();

type UpdateMeBody = {
    nickname?: string;
};

usersRouter.patch("/users/me", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const body = req.body as UpdateMeBody;
        const nicknameRaw =
            typeof body.nickname === "string" ? body.nickname : "";
        const nickname = nicknameRaw.trim();

        if (!nickname) {
            res.status(400).json({ error: "nickname is required" });
            return;
        }

        const updated = await supabase
            .from("users")
            .update({ nickname })
            .eq("id", userId)
            .select("id, username, nickname, avatar_url")
            .single();

        if (updated.error) {
            next(updated.error);
            return;
        }

        res.json({
            user: {
                id: updated.data.id,
                username: updated.data.username,
                nickname: updated.data.nickname ?? updated.data.username,
                avatarUrl: updated.data.avatar_url ?? null,
            },
        });
    } catch (err) {
        next(err);
    }
});

usersRouter.delete("/users/me", requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const owned = await supabase
            .from("groups")
            .select("id")
            .eq("owner_id", userId)
            .limit(1);

        if (owned.error) {
            next(owned.error);
            return;
        }

        if ((owned.data || []).length > 0) {
            res.status(400).json({
                error: "群主无法注销账号，请先转让或解散自己创建的群聊",
            });
            return;
        }

        const removedMembership = await supabase
            .from("group_members")
            .delete()
            .eq("user_id", userId);

        if (removedMembership.error) {
            next(removedMembership.error);
            return;
        }

        const removedFriendships = await supabase
            .from("friendships")
            .delete()
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        if (removedFriendships.error) {
            next(removedFriendships.error);
            return;
        }

        const now = Date.now();
        const deletedUsername = `deleted_${userId}_${now}`;
        const deletedNickname = "已注销用户";
        const newPasswordHash = await hashPassword(
            Math.random().toString(36).slice(2) +
                Math.random().toString(36).slice(2),
        );

        const updated = await supabase
            .from("users")
            .update({
                username: deletedUsername,
                nickname: deletedNickname,
                avatar_url: null,
                password: newPasswordHash,
            })
            .eq("id", userId);

        if (updated.error) {
            next(updated.error);
            return;
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});
