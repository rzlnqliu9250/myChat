// src/index.ts
import http from "http";
import { logger } from "./utils/logger";
import { ChatWebSocketServer } from "./server/WebSocketServer";

const PORT = process.env.PORT || 3001;

class ChatServer {
  private server: http.Server;
  private wsServer: ChatWebSocketServer;

  constructor() {
    // 创建HTTP服务器
    this.server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    });

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
