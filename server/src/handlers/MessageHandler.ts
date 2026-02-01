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
                if (message?.data?.groupId) {
                    void this.handleGroupChat(message, client);
                } else {
                    void this.handleSingleChat(message, client);
                }
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
        const {
            receiverId,
            content,
            type,
            clientMessageId,
            mediaUrl,
            mediaMime,
            mediaSize,
        } = message.data;

        if (!receiverId) {
            logger.warn("没有接收者ID");
            return;
        }

        const messageType =
            typeof type === "string" && type ? type : ("text" as const);
        const contentText = typeof content === "string" ? content : "";

        if (
            (messageType === "image" || messageType === "video") &&
            typeof mediaUrl !== "string"
        ) {
            logger.warn("媒体消息缺少 mediaUrl");
            return;
        }

        // .toISOString() - Date 对象的方法
        // 将日期时间转换为 ISO 8601 格式的字符串
        // 格式：YYYY-MM-DDTHH:mm:ss.sssZ
        const createdAt = new Date().toISOString();
        //写入数据库：把消息持久化
        const baseInsert = {
            sender_id: client.userId,
            receiver_id: receiverId,
            content: contentText,
            is_read: false,
            media_url: typeof mediaUrl === "string" ? mediaUrl : null,
            media_mime: typeof mediaMime === "string" ? mediaMime : null,
            media_size: typeof mediaSize === "number" ? mediaSize : null,
        };

        const insertWithMessageType = async () =>
            supabase
                .from("messages")
                .insert({
                    ...baseInsert,
                    message_type: messageType,
                })
                .select("id, created_at")
                .single();

        const insertWithType = async () =>
            supabase
                .from("messages")
                .insert({
                    ...baseInsert,
                    type: messageType,
                })
                .select("id, created_at")
                .single();

        let insertResult = await insertWithMessageType();
        if (
            insertResult.error &&
            (insertResult.error as any).message &&
            String((insertResult.error as any).message).includes("message_type")
        ) {
            insertResult = await insertWithType();
        }

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
                    content: contentText,
                    type: messageType,
                    mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
                    mediaMime: typeof mediaMime === "string" ? mediaMime : null,
                    mediaSize: typeof mediaSize === "number" ? mediaSize : null,
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
                content: contentText,
                type: messageType,
                mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
                mediaMime: typeof mediaMime === "string" ? mediaMime : null,
                mediaSize: typeof mediaSize === "number" ? mediaSize : null,
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

    private async handleGroupChat(
        message: WebSocketMessage,
        client: Client,
    ): Promise<void> {
        const {
            groupId,
            content,
            type,
            clientMessageId,
            mediaUrl,
            mediaMime,
            mediaSize,
        } = message.data;

        const groupIdText =
            typeof groupId === "string" ? groupId : String(groupId || "");
        if (!groupIdText) {
            logger.warn("群聊消息缺少 groupId");
            return;
        }

        const messageType =
            typeof type === "string" && type ? type : ("text" as const);
        const contentText = typeof content === "string" ? content : "";

        if (
            (messageType === "image" || messageType === "video") &&
            typeof mediaUrl !== "string"
        ) {
            logger.warn("媒体消息缺少 mediaUrl");
            return;
        }

        // 校验是否为群成员
        const membership = await supabase
            .from("group_members")
            .select("group_id")
            .eq("group_id", groupIdText)
            .eq("user_id", client.userId)
            .maybeSingle();

        if (membership.error) {
            logger.error("群成员校验失败:", membership.error);
            return;
        }

        if (!membership.data) {
            logger.warn(
                `User ${client.userId} is not a member of group ${groupIdText}`,
            );
            return;
        }

        const senderInfo = await supabase
            .from("users")
            .select("id, username, nickname, avatar_url")
            .eq("id", client.userId)
            .maybeSingle();

        if (senderInfo.error) {
            logger.error("读取发送者信息失败:", senderInfo.error);
        }

        const senderNickname = senderInfo.data
            ? (senderInfo.data.nickname ?? senderInfo.data.username)
            : null;
        const senderAvatarUrl = senderInfo.data
            ? (senderInfo.data.avatar_url ?? null)
            : null;

        const baseInsert = {
            sender_id: client.userId,
            receiver_id: null,
            group_id: groupIdText,
            content: contentText,
            is_read: false,
            media_url: typeof mediaUrl === "string" ? mediaUrl : null,
            media_mime: typeof mediaMime === "string" ? mediaMime : null,
            media_size: typeof mediaSize === "number" ? mediaSize : null,
        };

        const insertWithMessageType = async () =>
            supabase
                .from("messages")
                .insert({
                    ...baseInsert,
                    message_type: messageType,
                })
                .select("id, created_at")
                .single();

        const insertWithType = async () =>
            supabase
                .from("messages")
                .insert({
                    ...baseInsert,
                    type: messageType,
                })
                .select("id, created_at")
                .single();

        let insertResult = await insertWithMessageType();
        if (
            insertResult.error &&
            (insertResult.error as any).message &&
            String((insertResult.error as any).message).includes("message_type")
        ) {
            insertResult = await insertWithType();
        }

        if (insertResult.error || !insertResult.data) {
            logger.error("群消息保存失败:", insertResult.error);

            const failedMessage: WebSocketMessage = {
                type: WebSocketEvent.MESSAGE_RECEIVE,
                data: {
                    clientMessageId,
                    id: `temp_${Date.now()}`,
                    senderId: client.userId,
                    senderNickname,
                    senderAvatarUrl,
                    receiverId: null,
                    groupId: groupIdText,
                    content: contentText,
                    type: messageType,
                    mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
                    mediaMime: typeof mediaMime === "string" ? mediaMime : null,
                    mediaSize: typeof mediaSize === "number" ? mediaSize : null,
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
            : Date.now();

        const chatMessage: WebSocketMessage = {
            type: WebSocketEvent.MESSAGE_RECEIVE,
            data: {
                clientMessageId,
                id: messageId,
                senderId: client.userId,
                senderNickname,
                senderAvatarUrl,
                receiverId: null,
                groupId: groupIdText,
                content: contentText,
                type: messageType,
                mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
                mediaMime: typeof mediaMime === "string" ? mediaMime : null,
                mediaSize: typeof mediaSize === "number" ? mediaSize : null,
                status: "sent" as const,
                createTime: createTimeMs,
                updateTime: createTimeMs,
            },
            timestamp: Date.now(),
        };

        const members = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupIdText);

        if (members.error) {
            logger.error("读取群成员失败:", members.error);
        } else {
            const memberIds = (members.data || [])
                .map((m: any) => String(m.user_id))
                .filter(Boolean);

            memberIds.forEach((uid) => {
                if (uid === client.userId) {
                    return;
                }
                userManager.sendMessageToUser(uid, chatMessage);
            });
        }

        userManager.sendMessageToUser(client.userId, {
            type: WebSocketEvent.MESSAGE_RECEIVE,
            data: {
                ...chatMessage.data,
                status: "delivered" as const,
            },
            timestamp: Date.now(),
        });

        logger.info(
            `Group chat message from ${client.userId} to group ${groupIdText}: ${contentText.substring(0, 20)}...`,
        );
    }
}

export const messageHandler = new MessageHandler();
