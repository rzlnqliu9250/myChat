// src/models/Message.ts
export const MessageType = {
  TEXT: "text",
  IMAGE: "image",
  FILE: "file",
  SYSTEM: "system",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

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
  receiverId: string; // 单聊是用户ID，群聊是群组ID
  groupId?: string; // 群聊时的群组ID
  content: string;
  type: MessageTypeValue;
  status: MessageStatusValue;
  createTime: number;
  updateTime: number;
}

export interface Group {
  id: string;
  name: string;
  avatar?: string;
  memberIds: string[];
  createTime: number;
}
