/**
 * WebSocket 服务端：把 HTTP 服务器上的 WebSocket 连接“接进来”，
 * 完成鉴权、登记在线用户、把客户端消息交给 MessageHandler 处理，并在断开时广播离线。
 */

// src/server/WebSocketServer.ts

// WebSocket
// 表示一条具体的 WebSocket 连接
// WebSocketServer
// 表示WebSocket 服务端（监听器/服务器），负责：
// 监听 HTTP Server 上的 WebSocket 升级请求
// 接受连接并触发 connection 事件
// 管理所有连接的生命周期
import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import { WebSocketMessage, Client, WebSocketEvent } from "../types";
import { logger } from "../utils/logger";
import { messageHandler } from "../handlers/MessageHandler";
import { userManager } from "../managers/UserManager";
import { verifyToken } from "../middleware/auth";
import { supabase } from "../db/supabase";

// http.Server 是 Node.js 内置 http 模块里的“HTTP 服务器对象类型”。
// 当你在 Node.js 里启动一个后端服务时，本质上就是创建了一个 HTTP 服务器，例如：
// 负责监听端口（比如 3000）
// 接收浏览器/客户端发来的 HTTP 请求（GET/POST…）
// 返回响应（JSON/HTML…）
// 这个“服务器实例”在 Node 里就叫 http.Server。
// 在项目里的作用
// this.wss = new WebSocketServer({ server });
// 意思是：把 WebSocket 服务挂载到已有的 http.Server 上，从而实现：
// HTTP 接口（例如 /api/friends、/api/messages）
// WebSocket 长连接
// 共用同一个端口/同一个服务进程。
// http.Server 在 TypeScript 里经常作为类型标注出现：constructor(server: http.Server)
// 运行时真正传进来的 server 是一个服务器对象实例。

// 负责：
// 建立 WS server（挂在 HTTP server 上）
// 接入连接 + 鉴权
// 登记在线/下线广播
// 收消息 → 解析 → 转交给 MessageHandler
class ChatWebSocketServer {
    private wss: WebSocketServer; //保存 WebSocket 服务端实例（负责监听连接、维护连接列表等）。
    private server: http.Server; //保存传进来的 HTTP Server（WS 是挂载在它上面的）。

    //构造器
    //创建这个类实例时，必须传入一个 HTTP Server。
    constructor(server: http.Server) {
        this.server = server; //把传进来的 HTTP Server 存到成员变量里。
        this.wss = new WebSocketServer({ server }); //创建一个 WebSocketServer，并把它“挂”到这个 HTTP Server 上。
        this.setupEventListeners(); //注册 WebSocketServer 的事件监听（比如连接、错误、关闭等）。
    }

    //设置WebSocket事件监听器
    private setupEventListeners(): void {
        // 监听新连接。
        // ws.on("message", handler) 就是 给 WebSocket（或 WebSocketServer）绑定监听器：
        // 当message事件发生时，让程序自动执行handler。
        // socket：这条连接的 WebSocket 对象（和某一个客户端一对一）。
        // req：这次升级连接的 HTTP 请求对象（用于读取 URL、headers 等）。
        //"connection"：有客户端连上来
        this.wss.on(
            "connection",
            (socket: WebSocket, req: http.IncomingMessage) => {
                void this.handleConnection(socket, req);
                //调用异步函数 handleConnection，并明确告诉 TS “我不在这里 await 它”（避免 lint/ts 提示未处理 Promise）。
            },
        );

        // 记录 WebSocketServer 自身的错误（不是某个客户端 socket 的错误）
        this.wss.on("error", (error) => {
            logger.error("WebSocket server error:", error);
        });

        // 当 WS 服务端整体关闭时打印日志。
        this.wss.on("close", () => {
            logger.info("WebSocket server closed");
        });
    }

    //处理每一个新连接
    private async handleConnection(
        socket: WebSocket,
        req: http.IncomingMessage,
    ): Promise<void> {
        //req.url 里包含 /path?token=xxx 这样的内容。用 new URL 解析出查询参数。
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const token = url.searchParams.get("token"); //查询参数拿到 token。

        if (!token) {
            socket.close(1008, "没token");
            return;
        }

        let userId: string;
        try {
            userId = verifyToken(token); //验证 JWT，有效则返回 userId。
        } catch {
            socket.close(1008, "token校验失败");
            return;
        }

        // 创建临时客户端对象（等待正式登录）
        const client: Client = {
            //Client,type里自己写的类型
            userId,
            socket,
            connectedAt: Date.now(),
        };

        // 生成唯一的socket ID（使用内存地址的哈希值）
        const socketId = `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.info(`Client connected: ${socketId}, User ID: ${userId}`);

        // 查数据库拿用户信息（用于在线列表/广播展示）
        const userResult = await supabase
            .from("users")
            .select("id, username, nickname, avatar_url")
            .eq("id", userId)
            .maybeSingle();

        if (userResult.error || !userResult.data) {
            socket.close(1008, "没有用户");
            return;
        }

        //判断这个 userId 在内存里是否已经算在线
        const wasOnline = userManager.isUserOnline(userId);

        //把当前 socket 注册进在线用户表。
        userManager.addUser(socket, userId, {
            id: userResult.data.id,
            username: userResult.data.username,
            nickname: userResult.data.nickname ?? userResult.data.username,
            status: "online",
            lastOnline: Date.now(),
        });

        //如果之前不在线，才广播上线事件，避免重复广播。
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
            const message: WebSocketMessage = JSON.parse(data.toString()); //获得真实消息
            messageHandler.handleMessage(message, client); //使用消息管理中心的方法分类消息
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
        const removed = userManager.removeUser(client.userId, client.socket); //从在线用户表移除这个 socket。
        if (removed) {
            //为 true 才广播下线
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
     * 关闭整个 WebSocket 服务端
     * 提供一个“优雅关闭”的入口（比如进程退出时调用）。
     */
    close(): void {
        this.wss.close(() => {
            logger.info("WebSocket server closed");
        });
    }
}

export { ChatWebSocketServer };
