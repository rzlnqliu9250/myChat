// src/handlers/MessageHandler.ts
import { WebSocketMessage, WebSocketEvent, Client } from "../types";
import { logger } from "../utils/logger";
import { userManager } from "../managers/UserManager";
import { supabase } from "../db/supabase";

class MessageHandler {
    /**
     * 处理接收到的消息
     */
    handleMessage(message: WebSocketMessage, client: Client): void {
        logger.debug(`Received message from user ${client.userId}:`, message);

        switch (message.type) {
            case WebSocketEvent.HEARTBEAT:
                this.handleHeartbeat(message, client);
                break;
            case WebSocketEvent.MESSAGE_RECEIVE:
                void this.handleSingleChat(message, client);
                break;
            case WebSocketEvent.MESSAGE_READ:
                this.handleMessageRead(message, client);
                break;
            default:
                logger.warn(`Unknown message type: ${message.type}`);
        }
    }

    /**
     * 处理心跳消息
     */
    private handleHeartbeat(message: WebSocketMessage, client: Client): void {
        const response: WebSocketMessage = {
            type: WebSocketEvent.HEARTBEAT,
            data: { pong: Date.now() },
            timestamp: Date.now(),
        };

        userManager.sendMessageToUser(client.userId, response);
        logger.debug(`Sent heartbeat response to user ${client.userId}`);
    }

    /**
     * 处理单聊消息
     */
    private async handleSingleChat(
        message: WebSocketMessage,
        client: Client,
    ): Promise<void> {
        const { receiverId, content, type, clientMessageId } = message.data;

        if (!receiverId || typeof content !== "string") {
            logger.warn("Invalid single chat payload");
            return;
        }

        const createdAt = new Date().toISOString();
        const insertResult = await supabase
            .from("messages")
            .insert({
                sender_id: client.userId,
                receiver_id: receiverId,
                content,
                is_read: false,
            })
            .select("id, created_at")
            .single();

        if (insertResult.error || !insertResult.data) {
            logger.error("Failed to persist message:", insertResult.error);

            const failedMessage: WebSocketMessage = {
                type: WebSocketEvent.MESSAGE_RECEIVE,
                data: {
                    clientMessageId,
                    id: `temp_${Date.now()}`,
                    senderId: client.userId,
                    receiverId,
                    content,
                    type,
                    status: "failed" as const,
                    createTime: Date.now(),
                    updateTime: Date.now(),
                },
                timestamp: Date.now(),
            };

            userManager.sendMessageToUser(client.userId, failedMessage);
            return;
        }

        const messageId = String(insertResult.data.id);
        const createTimeMs = insertResult.data.created_at
            ? new Date(insertResult.data.created_at).getTime()
            : new Date(createdAt).getTime();

        const chatMessage: WebSocketMessage = {
            type: WebSocketEvent.MESSAGE_RECEIVE,
            data: {
                clientMessageId,
                id: messageId,
                senderId: client.userId,
                receiverId,
                content,
                type,
                status: "sent" as const,
                createTime: createTimeMs,
                updateTime: createTimeMs,
            },
            timestamp: Date.now(),
        };

        const delivered = userManager.sendMessageToUser(
            receiverId,
            chatMessage,
        );

        const statusMessage: WebSocketMessage = {
            type: WebSocketEvent.MESSAGE_RECEIVE,
            data: {
                ...chatMessage.data,
                status: delivered ? ("delivered" as const) : ("sent" as const),
            },
            timestamp: Date.now(),
        };

        userManager.sendMessageToUser(client.userId, statusMessage);

        logger.info(
            `Single chat message from ${client.userId} to ${receiverId}: ${content.substring(0, 20)}...`,
        );
    }

    /**
     * 处理消息已读通知
     */
    private handleMessageRead(message: WebSocketMessage, client: Client): void {
        const { messageId, receiverId } = message.data;

        // 创建已读通知消息
        const readMessage: WebSocketMessage = {
            type: WebSocketEvent.MESSAGE_READ,
            data: {
                messageId,
                readerId: client.userId,
                readTime: Date.now(),
            },
            timestamp: Date.now(),
        };

        // 发送已读通知给消息发送方
        userManager.sendMessageToUser(receiverId, readMessage);

        logger.info(`Message ${messageId} read by user ${client.userId}`);
    }
}

export const messageHandler = new MessageHandler();
