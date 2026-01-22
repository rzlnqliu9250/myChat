// src/models/User.ts
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  status: "online" | "offline" | "busy" | "away";
  lastOnline?: number;
}
