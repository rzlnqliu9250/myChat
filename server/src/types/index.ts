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
    MESSAGE_READ = "message_read",
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
