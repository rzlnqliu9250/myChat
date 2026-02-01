/**
 * 类型定义：服务端内部使用的 WebSocket 事件、消息结构、用户与连接对象类型。
 */
// src/types/index.ts
//所有 WS 事件名的“统一字典”
export enum WebSocketEvent {
    CONNECT = "connect", //连接
    DISCONNECT = "disconnect", //断开
    ERROR = "error", //错误
    HEARTBEAT = "heartbeat", //心跳

    // 业务事件
    MESSAGE_RECEIVE = "message_receive", //收消息
    GROUP_MEMBERSHIP_CHANGED = "group_membership_changed", //群成员变更
    USER_ONLINE = "user_online", //上线
    USER_OFFLINE = "user_offline", //下线
    FRIEND_REQUEST_CREATED = "friend_request_created", //好友申请创建
    FRIEND_REQUEST_ACCEPTED = "friend_request_accepted", //好友申请同意
    FRIEND_REQUEST_REJECTED = "friend_request_rejected", //好友申请拒绝
    FRIEND_REMOVED = "friend_removed", //删除好友
}

//服务端和客户端所有 WS 消息都长这样
export interface WebSocketMessage {
    type: WebSocketEvent;
    data: any;
    timestamp: number; //消息时间戳
}

//服务端使用的用户信息结构
export interface User {
    id: string;
    username: string;
    nickname: string;
    status: "online" | "offline";
    lastOnline?: number;
}

//一次 WebSocket 连接对应的“服务端连接对象”
export interface Client {
    userId: string;
    socket: any; // socket：真正的 WebSocket 连接对象，用来 send() 消息,使用any类型避免WebSocket类型冲突
    connectedAt: number; //连接建立时间，用于日志/调试/统计
}
