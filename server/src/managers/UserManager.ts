/**
 * 在线用户管理：用户上线时登记连接,断开时移除连接,推送消息,获取所有在线用户,广播“上线/下线”事件
 */
// src/managers/UserManager.ts
import { WebSocket } from "ws";
import { Client, WebSocketMessage, WebSocketEvent, User } from "../types";
import { logger } from "../utils/logger";

class UserManager {
    private users: Map<string, Client> = new Map(); //记录“这个用户当前对应的 WebSocket 连接”
    private userInfos: Map<string, User> = new Map(); //缓存“用户的展示信息”（给上线广播时用）

    //用户上线时登记连接
    addUser(socket: WebSocket, userId: string, userInfo: User): void {
        const client: Client = {
            userId,
            socket,
            connectedAt: Date.now(),
        };

        this.users.set(userId, client); //把该用户标记为在线并记录连接
        this.userInfos.set(userId, userInfo); //保存用户信息供后续广播使用

        //打日志：当前在线人数 this.users.size
        logger.info(
            `User connected: ${userId}, Total users: ${this.users.size}`,
        );
    }

    //用户断开时移除连接（并返回是否真的移除了）
    removeUser(userId: string, socket?: WebSocket): boolean {
        const client = this.users.get(userId); //拿到当前记录的连接
        if (!client) {
            return false;
        }
        //只有“断开的就是当前那条连接”才允许删除,
        //这样可以避免“旧连接 close 误删新连接”导致的假下线。
        if (socket && client.socket !== socket) {
            return false;
        }

        //删除连接
        this.users.delete(userId);
        this.userInfos.delete(userId);

        logger.info(
            `User disconnected: ${userId}, Total users: ${this.users.size}`,
        );
        return true;
        //返回值 boolean 的意义：
        //调用方（比如 WS close）可以据此决定要不要广播 USER_OFFLINE
    }

    // 拿到该用户的 Client（用来发消息）
    getUser(userId: string): Client | undefined {
        return this.users.get(userId);
    }

    // 返回当前在线 userId 列表
    getOnlineUserIds(): string[] {
        return Array.from(this.users.keys());
    }

    //获取所有在线用户
    getOnlineUsers(): User[] {
        return this.getOnlineUserIds()
            .map((userId) => this.userInfos.get(userId))
            .filter((user): user is User => user !== undefined);
    }

    //检查用户是否在线,用于好友列表接口的 online: boolean
    isUserOnline(userId: string): boolean {
        return this.users.has(userId);
    }

    //拿到对方的 WebSocket 连接，然后 socket.send(...) 把消息推过去。
    //互相发消息的真正发送动作（WS 层）
    sendMessageToUser(userId: string, message: WebSocketMessage): boolean {
        const client = this.users.get(userId); //找到用户连接 client
        //成功返回 true，失败捕获异常返回 false
        //判断消息是否“送达对方”（对方在线且发送成功）
        //判断连接仍然是 WebSocket.OPEN
        if (client && client.socket.readyState === WebSocket.OPEN) {
            try {
                client.socket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                logger.error(
                    `Failed to send message to user ${userId}:`,
                    error,
                );
                return false;
            }
        }
        return false;
    }

    /**
     * 广播消息给所有在线用户(当前只用于广播“上线/下线”事件)
     */
    broadcastMessage(message: WebSocketMessage, excludeUserId?: string): void {
        //遍历 users 的所有在线连接
        this.users.forEach((client, userId) => {
            if (excludeUserId && userId === excludeUserId) {
                return;
            }

            if (client.socket.readyState === WebSocket.OPEN) {
                try {
                    client.socket.send(JSON.stringify(message));
                } catch (error) {
                    logger.error(
                        `Failed to broadcast message to user ${userId}:`,
                        error,
                    );
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
