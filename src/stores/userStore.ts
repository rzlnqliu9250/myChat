// src/stores/userStore.ts
import { defineStore } from "pinia";
import type { User } from "../models/User";

export const useUserStore = defineStore("user", {
  state: () => ({
    currentUser: null as User | null,
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
