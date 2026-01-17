// src/server/WebSocketServer.ts
import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import { WebSocketMessage, Client, WebSocketEvent } from "../types";
import { logger } from "../utils/logger";
import { messageHandler } from "../handlers/MessageHandler";
import { userManager } from "../managers/UserManager";

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private server: http.Server;
  private clients = new Map<string, Client>(); // key: socket id, value: client

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
        this.handleConnection(socket, req);
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
  private handleConnection(socket: WebSocket, req: http.IncomingMessage): void {
    // 从查询参数中获取token或userId（实际应用中应该进行更严格的身份验证）
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const userId =
      url.searchParams.get("userId") ||
      `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建临时客户端对象（等待正式登录）
    const client: Client = {
      userId,
      socket,
      connectedAt: Date.now(),
    };

    // 生成唯一的socket ID（使用内存地址的哈希值）
    const socketId = `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.clients.set(socketId, client);

    logger.info(`Client connected: ${socketId}, User ID: ${userId}`);

    // 处理客户端消息
    socket.on("message", (data: Buffer | string) => {
      this.handleClientMessage(data, client, socketId);
    });

    // 处理客户端断开连接
    socket.on("close", (code: number, reason: Buffer) => {
      this.handleClientDisconnect(client, socketId, code, reason.toString());
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
      logger.error(`Failed to parse message from client ${socketId}:`, error);

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
    // 从客户端映射中移除
    this.clients.delete(socketId);

    // 移除用户连接
    userManager.removeUser(client.userId);

    // 通知其他用户该用户下线
    userManager.notifyUserOffline(client.userId);

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
   * 获取当前连接的客户端数量
   */
  getConnectionsCount(): number {
    return this.clients.size;
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
