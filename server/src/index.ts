/**
 * 服务端入口：创建 Express HTTP 服务并挂载业务路由，同时初始化 WebSocket 服务与优雅退出。
 */
// src/index.ts
import http from "http"; //Node 内置模块，用来创建 http.Server
import cors from "cors"; //允许前端跨域访问后端接口
import dotenv from "dotenv"; //读取 .env 环境变量文件（例如端口、数据库密钥等）
import express from "express"; //HTTP API 框架（处理路由、中间件）
import path from "path"; //读取 .env 环境变量文件（例如端口、数据库密钥等）
import { logger } from "./utils/logger"; //自定义日志工具（替代 console.log）
import { ChatWebSocketServer } from "./server/WebSocketServer"; //WebSocket 服务端
import { authRouter } from "./routes/auth"; //注册与登录接口
import { friendsRouter } from "./routes/friends"; //好友列表接口
import { messagesRouter } from "./routes/messages"; //消息接口
import { errorHandler } from "./middleware/errorHandler"; //统一错误处理中间件

//读取环境变量（dotenv）
dotenv.config({ path: path.resolve(process.cwd(), ".env") }); //当前目录的 .env
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") }); //上一级目录的 .env

const PORT = process.env.PORT || 8080; //优先用环境变量 PORT没有就默认 8080

//把“启动流程”封装起来
class ChatServer {
    private server: http.Server;
    private wsServer: ChatWebSocketServer;

    constructor() {
        const app = express();

        app.use(cors()); //允许跨域请求
        app.use(express.json()); //把请求体 JSON 自动解析成 req.body

        // 健康检查接口,用来测试服务器是否活着
        app.get("/health", (_req, res) => {
            res.status(200).json({ status: "ok", timestamp: Date.now() });
        });

        //挂载业务路由（统一加 /api 前缀）
        //比如：
        // authRouter 里如果是 /login，最终变成 /api/login
        // friendsRouter 里 /friends，最终是 /api/friends
        app.use("/api", authRouter);
        app.use("/api", friendsRouter);
        app.use("/api", messagesRouter);

        app.use(errorHandler); //错误处理中间件,统一捕获路由里 next(err) 抛出的错误

        this.server = http.createServer(app); // 用 Express app 创建 HTTP server

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
            //HTTP server 出错时记录日志
            logger.error("HTTP server error:", error);
        });

        // 处理进程终止信号
        process.on("SIGTERM", () => this.shutdown()); //系统/容器发来的“请退出”信号
        process.on("SIGINT", () => this.shutdown()); //在终端按 Ctrl + C
    }

    /**
     * 启动服务器
     */
    start(): void {
        this.server.listen(PORT, () => {
            //listen(PORT) 开始对外提供 HTTP 服务
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

// 启动入口（实例化并 start）
const chatServer = new ChatServer();
chatServer.start();
