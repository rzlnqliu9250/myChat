/**
 * 服务端入口：创建 Express HTTP 服务并挂载业务路由，同时初始化 WebSocket 服务与优雅退出。
 */
// src/index.ts
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { logger } from "./utils/logger";
import { ChatWebSocketServer } from "./server/WebSocketServer";
import { authRouter } from "./routes/auth";
import { friendsRouter } from "./routes/friends";
import { messagesRouter } from "./routes/messages";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const PORT = process.env.PORT || 8080;

class ChatServer {
    private server: http.Server;
    private wsServer: ChatWebSocketServer;

    constructor() {
        const app = express();

        app.use(cors());
        app.use(express.json());

        app.get("/health", (_req, res) => {
            res.status(200).json({ status: "ok", timestamp: Date.now() });
        });

        app.use("/api", authRouter);
        app.use("/api", friendsRouter);
        app.use("/api", messagesRouter);

        app.use(errorHandler);

        this.server = http.createServer(app);

        // 初始化WebSocket服务器
        this.wsServer = new ChatWebSocketServer(this.server);

        // 设置服务器事件监听器
        this.setupEventListeners();
    }

    /**
     * 设置服务器事件监听器
     */
    private setupEventListeners(): void {
        // 处理HTTP服务器错误
        this.server.on("error", (error) => {
            logger.error("HTTP server error:", error);
        });

        // 处理进程终止信号
        process.on("SIGTERM", () => this.shutdown());
        process.on("SIGINT", () => this.shutdown());
    }

    /**
     * 启动服务器
     */
    start(): void {
        this.server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`WebSocket server ready at ws://localhost:${PORT}`);
            logger.info(`Health check: http://localhost:${PORT}/health`);
        });
    }

    /**
     * 关闭服务器
     */
    private shutdown(): void {
        logger.info("Shutting down server...");

        // 关闭WebSocket服务器
        this.wsServer.close();

        // 关闭HTTP服务器
        this.server.close(() => {
            logger.info("Server closed");
            process.exit(0);
        });
    }
}

// 启动服务器
const chatServer = new ChatServer();
chatServer.start();
