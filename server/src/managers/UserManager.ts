// src/managers/UserManager.ts
import { WebSocket } from "ws";
import { Client, WebSocketMessage, WebSocketEvent, User } from "../types";
import { logger } from "../utils/logger";

class UserManager {
  private users: Map<string, Client> = new Map();
  private userInfos: Map<string, User> = new Map();

  /**
   * 添加用户连接
   */
  addUser(socket: WebSocket, userId: string, userInfo: User): void {
    const client: Client = {
      userId,
      socket,
      connectedAt: Date.now(),
    };

    this.users.set(userId, client);
    this.userInfos.set(userId, userInfo);

    logger.info(`User connected: ${userId}, Total users: ${this.users.size}`);
  }

  /**
   * 移除用户连接
   */
  removeUser(userId: string): void {
    const client = this.users.get(userId);
    if (client) {
      this.users.delete(userId);
      logger.info(
        `User disconnected: ${userId}, Total users: ${this.users.size}`,
      );
    }
  }

  /**
   * 获取用户连接
   */
  getUser(userId: string): Client | undefined {
    return this.users.get(userId);
  }

  /**
   * 获取所有在线用户ID
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.users.keys());
  }

  /**
   * 获取所有在线用户
   */
  getOnlineUsers(): User[] {
    return this.getOnlineUserIds()
      .map((userId) => this.userInfos.get(userId))
      .filter((user): user is User => user !== undefined);
  }

  /**
   * 检查用户是否在线
   */
  isUserOnline(userId: string): boolean {
    return this.users.has(userId);
  }

  /**
   * 发送消息给指定用户
   */
  sendMessageToUser(userId: string, message: WebSocketMessage): boolean {
    const client = this.users.get(userId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error(`Failed to send message to user ${userId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * 广播消息给所有在线用户
   */
  broadcastMessage(message: WebSocketMessage, excludeUserId?: string): void {
    this.users.forEach((client, userId) => {
      if (excludeUserId && userId === excludeUserId) {
        return;
      }

      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          logger.error(`Failed to broadcast message to user ${userId}:`, error);
        }
      }
    });
  }

  /**
   * 发送用户上线通知
   */
  notifyUserOnline(userId: string): void {
    const userInfo = this.userInfos.get(userId);
    if (userInfo) {
      const message: WebSocketMessage = {
        type: WebSocketEvent.USER_ONLINE,
        data: {
          userId,
          userInfo,
        },
        timestamp: Date.now(),
      };

      this.broadcastMessage(message);
    }
  }

  /**
   * 发送用户下线通知
   */
  notifyUserOffline(userId: string): void {
    const message: WebSocketMessage = {
      type: WebSocketEvent.USER_OFFLINE,
      data: {
        userId,
      },
      timestamp: Date.now(),
    };

    this.broadcastMessage(message);
  }
}

export const userManager = new UserManager();
