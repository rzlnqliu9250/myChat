// src/managers/GroupManager.ts
import { Group, WebSocketMessage, WebSocketEvent } from "../types";
import { logger } from "../utils/logger";
import { userManager } from "./UserManager";

class GroupManager {
  private groups: Map<string, Group> = new Map();

  /**
   * 创建群组
   */
  createGroup(group: Group): string {
    this.groups.set(group.id, group);
    logger.info(
      `Group created: ${group.id}, Name: ${group.name}, Members: ${group.memberIds.length}`,
    );
    return group.id;
  }

  /**
   * 获取群组
   */
  getGroup(groupId: string): Group | undefined {
    return this.groups.get(groupId);
  }

  /**
   * 获取所有群组
   */
  getAllGroups(): Group[] {
    return Array.from(this.groups.values());
  }

  /**
   * 添加成员到群组
   */
  addMemberToGroup(groupId: string, memberId: string): boolean {
    const group = this.groups.get(groupId);
    if (group && !group.memberIds.includes(memberId)) {
      group.memberIds.push(memberId);
      logger.info(`Added member ${memberId} to group ${groupId}`);
      return true;
    }
    return false;
  }

  /**
   * 从群组移除成员
   */
  removeMemberFromGroup(groupId: string, memberId: string): boolean {
    const group = this.groups.get(groupId);
    if (group) {
      const initialLength = group.memberIds.length;
      group.memberIds = group.memberIds.filter((id) => id !== memberId);
      const removed = group.memberIds.length < initialLength;
      if (removed) {
        logger.info(`Removed member ${memberId} from group ${groupId}`);
      }
      return removed;
    }
    return false;
  }

  /**
   * 检查用户是否在群组中
   */
  isUserInGroup(groupId: string, userId: string): boolean {
    const group = this.groups.get(groupId);
    return !!group && group.memberIds.includes(userId);
  }

  /**
   * 发送消息到群组
   */
  sendMessageToGroup(
    groupId: string,
    message: WebSocketMessage,
    excludeSenderId?: string,
  ): void {
    const group = this.groups.get(groupId);
    if (!group) {
      logger.warn(`Group not found: ${groupId}`);
      return;
    }

    // 发送消息给群组内所有在线成员
    group.memberIds.forEach((memberId) => {
      if (excludeSenderId && memberId === excludeSenderId) {
        return;
      }

      userManager.sendMessageToUser(memberId, message);
    });

    logger.info(
      `Sent group message to group ${groupId}, Members: ${group.memberIds.length}`,
    );
  }

  /**
   * 获取用户所在的所有群组
   */
  getUserGroups(userId: string): Group[] {
    return Array.from(this.groups.values()).filter((group) =>
      group.memberIds.includes(userId),
    );
  }

  /**
   * 发送群组成员变化通知
   */
  notifyMemberChange(
    groupId: string,
    memberId: string,
    action: "add" | "remove",
  ): void {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    const message: WebSocketMessage = {
      type: WebSocketEvent.GROUP_MESSAGE,
      data: {
        groupId,
        type: "system",
        content:
          action === "add"
            ? `${memberId} joined the group`
            : `${memberId} left the group`,
        memberId,
        action,
      },
      timestamp: Date.now(),
    };

    this.sendMessageToGroup(groupId, message);
  }
}

export const groupManager = new GroupManager();
