/**
 * 用户状态仓库（Pinia）：管理当前用户、token、本地持久化、好友列表与在线用户集合。
 */
// src/stores/userStore.ts
import { defineStore } from "pinia";
import type { User } from "../models/User";

function loadStoredUser(): User | null {
  const raw = localStorage.getItem("currentUser");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem("currentUser");
    return null;
  }
}

export const useUserStore = defineStore("user", {
  state: () => ({
    currentUser: loadStoredUser(),
    token: localStorage.getItem("token") || null,
    friends: [] as User[],
    onlineUsers: new Set<string>(),
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    getFriendById: (state) => (id: string) =>
      state.friends.find((friend) => friend.id === id),
    isUserOnline: (state) => (id: string) => state.onlineUsers.has(id),
  },

  actions: {
    setCurrentUser(user: User) {
      this.currentUser = user;
      localStorage.setItem("currentUser", JSON.stringify(user));
    },

    setToken(token: string) {
      this.token = token;
      localStorage.setItem("token", token);
    },

    clearToken() {
      this.token = null;
      localStorage.removeItem("token");
    },

    logout() {
      this.currentUser = null;
      localStorage.removeItem("currentUser");
      this.clearToken();
      this.friends = [];
      this.onlineUsers.clear();
    },

    setFriends(friends: User[]) {
      this.friends = friends;
    },

    addFriend(friend: User) {
      if (!this.friends.find((f) => f.id === friend.id)) {
        this.friends.push(friend);
      }
    },

    updateUserStatus(
      userId: string,
      status: "online" | "offline" | "busy" | "away",
    ) {
      // 更新好友列表中的用户状态
      const friend = this.friends.find((f) => f.id === userId);
      if (friend) {
        friend.status = status;
      }

      // 更新当前用户状态
      if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser.status = status;
      }

      // 更新在线用户集合
      if (status === "online") {
        this.onlineUsers.add(userId);
      } else {
        this.onlineUsers.delete(userId);
      }
    },
  },
});
