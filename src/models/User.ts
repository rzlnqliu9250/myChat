/**
 * 用户模型：定义前端使用的用户信息结构（用于当前用户/好友列表/在线状态展示）。
 */
// src/models/User.ts
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  status: "online" | "offline" | "busy" | "away";
  lastOnline?: number;
}
