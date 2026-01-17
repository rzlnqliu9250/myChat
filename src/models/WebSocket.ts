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
  GROUP_MESSAGE: "group_message",
  MESSAGE_READ: "message_read",
} as const;

export type WebSocketEventType =
  (typeof WebSocketEvent)[keyof typeof WebSocketEvent];

export interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: number;
}

export interface HeartbeatMessage {
  type: typeof WebSocketEvent.HEARTBEAT;
  data: {
    ping: number;
  };
  timestamp: number;
}
