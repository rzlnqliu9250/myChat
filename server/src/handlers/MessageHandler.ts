// src/handlers/MessageHandler.ts
import { WebSocketMessage, WebSocketEvent, Client } from "../types";
import { logger } from "../utils/logger";
import { userManager } from "../managers/UserManager";
import { groupManager } from "../managers/GroupManager";

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
      case WebSocketEvent.LOGIN:
        this.handleLogin(message, client);
        break;
      case WebSocketEvent.MESSAGE_RECEIVE:
        this.handleSingleChat(message, client);
        break;
      case WebSocketEvent.GROUP_MESSAGE:
        this.handleGroupChat(message, client);
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
   * 处理用户登录消息
   */
  private handleLogin(message: WebSocketMessage, client: Client): void {
    const { userId, username, nickname } = message.data;

    // 更新用户信息
    const userInfo = {
      id: userId,
      username,
      nickname,
      status: "online" as const,
      lastOnline: Date.now(),
    };

    // 添加用户到在线列表
    userManager.addUser(client.socket, userId, userInfo);

    // 通知其他用户该用户上线
    userManager.notifyUserOnline(userId);

    // 发送登录成功响应
    const response: WebSocketMessage = {
      type: WebSocketEvent.LOGIN,
      data: {
        success: true,
        message: "Login successful",
        user: userInfo,
        onlineUsers: userManager.getOnlineUsers(),
      },
      timestamp: Date.now(),
    };

    userManager.sendMessageToUser(userId, response);
    logger.info(`User logged in: ${userId}, Username: ${username}`);
  }

  /**
   * 处理单聊消息
   */
  private handleSingleChat(message: WebSocketMessage, client: Client): void {
    const { receiverId, content, type } = message.data;

    // 生成消息ID（实际应用中应该使用更可靠的ID生成方式）
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建消息对象
    const chatMessage: WebSocketMessage = {
      type: WebSocketEvent.MESSAGE_RECEIVE,
      data: {
        id: messageId,
        senderId: client.userId,
        receiverId,
        content,
        type,
        status: "sent" as const,
        createTime: Date.now(),
        updateTime: Date.now(),
      },
      timestamp: Date.now(),
    };

    // 发送消息给接收方
    const sent = userManager.sendMessageToUser(receiverId, chatMessage);

    // 发送消息状态给发送方
    const statusMessage: WebSocketMessage = {
      type: WebSocketEvent.MESSAGE_RECEIVE,
      data: {
        ...chatMessage.data,
        status: sent ? "delivered" : "failed",
      },
      timestamp: Date.now(),
    };

    userManager.sendMessageToUser(client.userId, statusMessage);

    logger.info(
      `Single chat message from ${client.userId} to ${receiverId}: ${content.substring(0, 20)}...`,
    );
  }

  /**
   * 处理群聊消息
   */
  private handleGroupChat(message: WebSocketMessage, client: Client): void {
    const { groupId, content, type } = message.data;

    // 检查用户是否在群组中
    if (!groupManager.isUserInGroup(groupId, client.userId)) {
      logger.warn(`User ${client.userId} is not in group ${groupId}`);
      return;
    }

    // 生成消息ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建群聊消息对象
    const groupMessage: WebSocketMessage = {
      type: WebSocketEvent.GROUP_MESSAGE,
      data: {
        id: messageId,
        senderId: client.userId,
        groupId,
        content,
        type,
        status: "sent" as const,
        createTime: Date.now(),
        updateTime: Date.now(),
      },
      timestamp: Date.now(),
    };

    // 发送消息给群组所有成员
    groupManager.sendMessageToGroup(groupId, groupMessage);

    logger.info(
      `Group message from ${client.userId} to group ${groupId}: ${content.substring(0, 20)}...`,
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
