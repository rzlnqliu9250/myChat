/**
 * 消息模型：定义聊天消息的数据结构与状态枚举（发送中/已发送/已送达/已读/失败）。
 */
// src/models/Message.ts
export const MessageStatus = {
  SENDING: "sending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
} as const;

export type MessageStatusValue =
  (typeof MessageStatus)[keyof typeof MessageStatus];

export interface Message {
  id: string;
  senderId: string;
  senderNickname?: string | null;
  senderAvatarUrl?: string | null;
  receiverId: string | null;
  groupId?: string | null;
  content: string;
  type: "text" | "image" | "video" | "file" | "system";
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  status: MessageStatusValue;
  createTime: number;
  updateTime: number;
}
