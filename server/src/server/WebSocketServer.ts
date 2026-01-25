/**
 * WebSocket 服务端：把 HTTP 服务器上的 WebSocket 连接“接进来”，
 * 完成鉴权、登记在线用户、把客户端消息交给 MessageHandler 处理，并在断开时广播离线。
 */
// src/server/WebSocketServer.ts
import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import { WebSocketMessage, Client, WebSocketEvent } from "../types";
import { logger } from "../utils/logger";
import { messageHandler } from "../handlers/MessageHandler";
import { userManager } from "../managers/UserManager";
import { verifyToken } from "../middleware/auth";
import { supabase } from "../db/supabase";

class ChatWebSocketServer {
    private wss: WebSocketServer;
    private server: http.Server;

    //构造器
    constructor(server: http.Server) {
        this.server = server;
        this.wss = new WebSocketServer({ server });
        this.setupEventListeners();
    }

    /**
     * 设置WebSocket事件监听器
     */
    private setupEventListeners(): void {
        // 处理客户端连接
        this.wss.on(
            "connection",
            (socket: WebSocket, req: http.IncomingMessage) => {
                void this.handleConnection(socket, req);
            },
        );

        // 处理WebSocket服务器错误
        this.wss.on("error", (error) => {
            logger.error("WebSocket server error:", error);
        });

        // 处理WebSocket服务器关闭
        this.wss.on("close", () => {
            logger.info("WebSocket server closed");
        });
    }

    /**
     * 处理客户端连接
     */
    private async handleConnection(
        socket: WebSocket,
        req: http.IncomingMessage,
    ): Promise<void> {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const token = url.searchParams.get("token");

        if (!token) {
            socket.close(1008, "Unauthorized");
            return;
        }

        let userId: string;
        try {
            userId = verifyToken(token);
        } catch {
            socket.close(1008, "Unauthorized");
            return;
        }

        // 创建临时客户端对象（等待正式登录）
        const client: Client = {
            userId,
            socket,
            connectedAt: Date.now(),
        };

        // 生成唯一的socket ID（使用内存地址的哈希值）
        const socketId = `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.info(`Client connected: ${socketId}, User ID: ${userId}`);

        const userResult = await supabase
            .from("users")
            .select("id, username, nickname, avatar_url")
            .eq("id", userId)
            .maybeSingle();

        if (userResult.error || !userResult.data) {
            socket.close(1008, "Unauthorized");
            return;
        }

        const wasOnline = userManager.isUserOnline(userId);

        userManager.addUser(socket, userId, {
            id: userResult.data.id,
            username: userResult.data.username,
            nickname: userResult.data.nickname ?? userResult.data.username,
            status: "online",
            lastOnline: Date.now(),
        });

        if (!wasOnline) {
            userManager.notifyUserOnline(userId);
        }

        // 处理客户端消息
        socket.on("message", (data: Buffer | string) => {
            this.handleClientMessage(data, client, socketId);
        });

        // 处理客户端断开连接
        socket.on("close", (code: number, reason: Buffer) => {
            this.handleClientDisconnect(
                client,
                socketId,
                code,
                reason.toString(),
            );
        });

        // 处理客户端错误
        socket.on("error", (error) => {
            this.handleClientError(client, socketId, error);
        });
    }

    /**
     * 处理客户端消息
     */
    private handleClientMessage(
        data: Buffer | string,
        client: Client,
        socketId: string,
    ): void {
        try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            messageHandler.handleMessage(message, client);
        } catch (error) {
            logger.error(
                `Failed to parse message from client ${socketId}:`,
                error,
            );

            // 发送错误响应
            const errorMessage: WebSocketMessage = {
                type: WebSocketEvent.ERROR,
                data: { message: "Invalid message format" },
                timestamp: Date.now(),
            };

            client.socket.send(JSON.stringify(errorMessage));
        }
    }

    /**
     * 处理客户端断开连接
     */
    private handleClientDisconnect(
        client: Client,
        socketId: string,
        code: number,
        reason: string,
    ): void {
        const removed = userManager.removeUser(client.userId, client.socket);
        if (removed) {
            userManager.notifyUserOffline(client.userId);
        }

        logger.info(
            `Client disconnected: ${socketId}, User ID: ${client.userId}, Code: ${code}, Reason: ${reason}`,
        );
    }

    /**
     * 处理客户端错误
     */
    private handleClientError(
        client: Client,
        socketId: string,
        error: Error,
    ): void {
        logger.error(
            `Client error: ${socketId}, User ID: ${client.userId}:`,
            error,
        );
    }

    /**
     * 关闭WebSocket服务器
     */
    close(): void {
        this.wss.close(() => {
            logger.info("WebSocket server closed");
        });
    }
}

export { ChatWebSocketServer };
