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
  receiverId: string;
  content: string;
  type: "text" | "image" | "file" | "system";
  status: MessageStatusValue;
  createTime: number;
  updateTime: number;
}
