/**
 * 认证路由：提供注册与登录接口，登录成功后签发 JWT。
 */
import { Router } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../db/supabase";
import { hashPassword, verifyPassword } from "../utils/password";

export const authRouter = Router();
//注册接口
authRouter.post("/register", async (req, res, next) => {
    try {
        const { username, password, avatarUrl, nickname } = req.body as {
            username?: string;
            password?: string;
            avatarUrl?: string;
            nickname?: string;
        };

        if (!username || !password) {
            res.status(400).json({
                error: "需要用户名和密码",
            });
            return;
        }

        // 在 users 表中查询 username = 当前注册用户名 的记录
        // 只取 id 字段（够用）
        // maybeSingle() 表示：
        // 如果查到 1 条：返回那条数据
        // 如果查到 0 条：data 为 null（不算错误）
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
            res.status(409).json({ error: "用户名已经存在" });
            return;
        }

        const passwordHash = await hashPassword(password);

        //users表里加id, username, nickname,avatar_url,再返回
        const created = await supabase
            .from("users")
            .insert({
                username,
                nickname: nickname ?? username,
                password: passwordHash,
                avatar_url: avatarUrl ?? null,
            })
            .select("id, username, nickname, avatar_url")
            .single();

        if (created.error) {
            next(created.error);
            return;
        }

        //注册成功：201 + 返回 user 信息
        res.status(201).json({
            user: {
                id: created.data.id,
                username: created.data.username,
                nickname: created.data.nickname ?? created.data.username,
                avatarUrl: created.data.avatar_url ?? null,
            },
        });
    } catch (err) {
        next(err);
    }
});
//登录接口
authRouter.post("/login", async (req, res, next) => {
    try {
        const { username, password } = req.body as {
            username?: string;
            password?: string;
        };

        if (!username || !password) {
            res.status(400).json({
                error: "username and password are required",
            });
            return;
        }

        const userResult = await supabase
            .from("users")
            .select("id, username, nickname, password, avatar_url")
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

        //校验密码：用 bcrypt 比对
        const ok = await verifyPassword(password, user.password);
        if (!ok) {
            res.status(401).json({ error: "invalid credentials" });
            return;
        }

        //读取 JWT 密钥
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({ error: "Server misconfigured" });
            return;
        }

        //签发 token
        //jwt.sign：把一段身份信息用服务端密钥 secret 签名，生成一个 token 字符串。
        const token = jwt.sign({ userId: user.id }, secret, {
            expiresIn: "7d", //token 有效期 7 天
        });

        //返回给前端：token + 用户信息
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                nickname: user.nickname ?? user.username,
                avatarUrl: user.avatar_url ?? null,
            },
        });
    } catch (err) {
        next(err);
    }
});
