import { Router } from "express";
import multer from "multer";
import { supabase } from "../db/supabase";
import { requireAuth } from "../middleware/auth";

export const uploadsRouter = Router();

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AVATAR_MAX_BYTES },
});

const uploadMedia = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MEDIA_MAX_BYTES },
});

function getFileExt(originalName: string): string {
    const dotIdx = originalName.lastIndexOf(".");
    if (dotIdx < 0) {
        return "";
    }
    const ext = originalName.slice(dotIdx).trim();
    if (!ext || ext.length > 10) {
        return "";
    }
    return ext;
}

function randomToken(): string {
    return Math.random().toString(36).slice(2, 10);
}

uploadsRouter.post(
    "/upload/avatar/temp",
    uploadAvatar.single("file"),
    async (req, res, next) => {
        try {
            const file = req.file;
            if (!file) {
                res.status(400).json({ error: "missing file" });
                return;
            }

            if (!file.mimetype.startsWith("image/")) {
                res.status(400).json({ error: "invalid avatar type" });
                return;
            }

            const ext = getFileExt(file.originalname);
            const objectPath = `temp/${Date.now()}_${randomToken()}${ext}`;

            const uploaded = await supabase.storage
                .from("avatars")
                .upload(objectPath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });

            if (uploaded.error) {
                next(uploaded.error);
                return;
            }

            const publicUrl = supabase.storage
                .from("avatars")
                .getPublicUrl(objectPath).data.publicUrl;

            res.status(201).json({ url: publicUrl });
        } catch (err) {
            next(err);
        }
    },
);

uploadsRouter.post(
    "/upload/avatar",
    requireAuth,
    uploadAvatar.single("file"),
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const file = req.file;
            if (!file) {
                res.status(400).json({ error: "missing file" });
                return;
            }

            if (!file.mimetype.startsWith("image/")) {
                res.status(400).json({ error: "invalid avatar type" });
                return;
            }

            const ext = getFileExt(file.originalname);
            const objectPath = `${userId}/${Date.now()}_${randomToken()}${ext}`;

            const uploaded = await supabase.storage
                .from("avatars")
                .upload(objectPath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });

            if (uploaded.error) {
                next(uploaded.error);
                return;
            }

            const publicUrl = supabase.storage
                .from("avatars")
                .getPublicUrl(objectPath).data.publicUrl;

            const updated = await supabase
                .from("users")
                .update({ avatar_url: publicUrl })
                .eq("id", userId);

            if (updated.error) {
                next(updated.error);
                return;
            }

            res.status(201).json({ url: publicUrl });
        } catch (err) {
            next(err);
        }
    },
);

uploadsRouter.post(
    "/upload/chat-media",
    requireAuth,
    uploadMedia.single("file"),
    async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const file = req.file;
            if (!file) {
                res.status(400).json({ error: "missing file" });
                return;
            }

            const isImage = file.mimetype.startsWith("image/");
            const isVideo = file.mimetype.startsWith("video/");
            if (!isImage && !isVideo) {
                res.status(400).json({ error: "invalid media type" });
                return;
            }

            const ext = getFileExt(file.originalname);
            const objectPath = `${userId}/${Date.now()}_${randomToken()}${ext}`;

            const uploaded = await supabase.storage
                .from("chat-media")
                .upload(objectPath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });

            if (uploaded.error) {
                next(uploaded.error);
                return;
            }

            const publicUrl = supabase.storage
                .from("chat-media")
                .getPublicUrl(objectPath).data.publicUrl;

            res.status(201).json({
                url: publicUrl,
                mime: file.mimetype,
                size: file.size,
            });
        } catch (err) {
            next(err);
        }
    },
);
