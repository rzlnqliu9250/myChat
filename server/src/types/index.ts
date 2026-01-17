// src/types/index.ts
export enum WebSocketEvent {
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ERROR = "error",
  HEARTBEAT = "heartbeat",

  // 业务事件
  MESSAGE_RECEIVE = "message_receive",
  USER_ONLINE = "user_online",
  USER_OFFLINE = "user_offline",
  GROUP_MESSAGE = "group_message",
  MESSAGE_READ = "message_read",
  LOGIN = "login",
}

export interface WebSocketMessage {
  type: WebSocketEvent;
  data: any;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  nickname: string;
  status: "online" | "offline" | "busy" | "away";
  lastOnline?: number;
}

export interface Client {
  userId: string;
  socket: any; // 使用any类型避免WebSocket类型冲突
  connectedAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  groupId?: string;
  content: string;
  type: "text" | "image" | "file" | "system";
  status: "sending" | "sent" | "delivered" | "read" | "failed";
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
