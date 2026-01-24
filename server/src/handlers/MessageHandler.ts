/**
 *服务端 WebSocket 的“业务消息分发与处理中心”：客户端发来的 WS 消息先到这里，
 根据 message.type 分流到不同处理函数（心跳、发消息），
 并负责写数据库 + 转发给对方 + 回传发送状态。
 */
// src/handlers/MessageHandler.ts
import { WebSocketMessage, WebSocketEvent, Client } from "../types";
import { logger } from "../utils/logger";
import { userManager } from "../managers/UserManager";
import { supabase } from "../db/supabase";

class MessageHandler {
    /**
     * 处理接收到的消息,入口分发器（总开关）
     * 所有 WS 消息先进入这一层，再“按事件类型”分发
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
            default:
                logger.warn(`Unknown message type: ${message.type}`);
        }
    }

    /**
     * 处理心跳消息（保活/检测连接）
     * 心跳就是客户端定时发 ping，服务端回 pong，用来保活连接并快速检测断线，从而触发重连，保证聊天稳定。
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
     * 校验参数 → 写入数据库 → 给接收方推送 → 给发送方回传状态（sent/delivered/failed）→ 记录日志
     */
    private async handleSingleChat(
        message: WebSocketMessage,
        client: Client,
    ): Promise<void> {
        // receiverId：发给谁（对方用户 id）
        // content：消息内容（文本）
        // type：消息类型（比如 text）
        // clientMessageId：客户端生成的临时 id（用于前端把“sending 的那条消息”匹配到回执）
        const { receiverId, content, type, clientMessageId } = message.data;

        if (!receiverId || typeof content !== "string") {
            logger.warn("没有接收者ID或消息内容不是字符串");
            return;
        }

        // .toISOString() - Date 对象的方法
        // 将日期时间转换为 ISO 8601 格式的字符串
        // 格式：YYYY-MM-DDTHH:mm:ss.sssZ
        const createdAt = new Date().toISOString();
        //写入数据库：把消息持久化
        const insertResult = await supabase //等数据库操作完成
            .from("messages") //选中要操作的表,表名是 messages
            .insert({
                //.insert({...})：插入一条记录（写入数据库）
                sender_id: client.userId, //发送方 id（当前 websocket 连接对应的用户）
                receiver_id: receiverId, //接收方 id
                content, //消息内容
                is_read: false, //默认未读
            })
            .select("id, created_at") //插入成功后，把这两个字段取回来
            .single(); //.single() 会把返回结构从 “数组” 变成 “对象”,期望只返回一条记录，而不是数组

        //如果写入数据库失败，那么发消息给自己消息保存失败
        if (insertResult.error || !insertResult.data) {
            logger.error("消息保存失败:", insertResult.error);

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

            userManager.sendMessageToUser(client.userId, failedMessage); //发回给发送者自己消息保存失败
            return;
        }
        //写库成功：取正式消息 id + 计算消息时间
        const messageId = String(insertResult.data.id);
        const createTimeMs = insertResult.data.created_at
            ? new Date(insertResult.data.created_at).getTime()
            : new Date(createdAt).getTime();

        //构造“要推给接收方”的消息（先标记 sent）
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

        //推送给接收方，并拿到是否送达成功的结果
        const delivered = userManager.sendMessageToUser(
            receiverId,
            chatMessage,
        );
        //给发送方回一条“状态回执”（sent(已发送) 或 delivered(已送达)）
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
}

export const messageHandler = new MessageHandler();
