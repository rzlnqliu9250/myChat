/**
 * WebSocket 协议模型：统一定义事件名常量、事件类型与消息信封结构。
 */
// 系统事件
export const WebSocketEvent = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",
  HEARTBEAT: "heartbeat",

  // 业务事件
  MESSAGE_RECEIVE: "message_receive",
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",
  FRIEND_REQUEST_CREATED: "friend_request_created",
  FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",
  FRIEND_REQUEST_REJECTED: "friend_request_rejected",
  FRIEND_REMOVED: "friend_removed",
} as const;

export type WebSocketEventType =
  (typeof WebSocketEvent)[keyof typeof WebSocketEvent];

export interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: number;
}
