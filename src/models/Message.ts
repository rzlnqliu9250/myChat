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
  receiverId: string;
  content: string;
  type: MessageTypeValue;
  status: MessageStatusValue;
  createTime: number;
  updateTime: number;
}
