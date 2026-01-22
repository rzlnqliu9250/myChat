// src/stores/messageStore.ts
import { defineStore } from "pinia";
import type { Message, MessageStatusValue } from "../models/Message";

export const useMessageStore = defineStore("message", {
  state: () => ({
    messages: [] as Message[],
    conversations: new Map<string, Message[]>(),
    unreadCount: new Map<string, number>(),
  }),

  getters: {
    getMessagesByConversation: (state) => (conversationId: string) => {
      return state.conversations.get(conversationId) || [];
    },

    getUnreadCount: (state) => (conversationId: string) => {
      return state.unreadCount.get(conversationId) || 0;
    },

    totalUnreadCount: (state) => {
      let total = 0;
      for (const count of state.unreadCount.values()) {
        total += count;
      }
      return total;
    },
  },

  actions: {
    addMessage(message: Message) {
      // 添加到全局消息列表
      this.messages.push(message);

      // 添加到对应会话
      const conversationId = message.receiverId;
      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, []);
      }
      this.conversations.get(conversationId)?.push(message);

      // 更新未读计数（如果不是当前用户发送的消息）
      const userStore = useUserStore();
      if (message.senderId !== userStore.currentUser?.id) {
        this.incrementUnreadCount(conversationId);
      }
    },

    incrementUnreadCount(conversationId: string) {
      const currentCount = this.unreadCount.get(conversationId) || 0;
      this.unreadCount.set(conversationId, currentCount + 1);
    },

    resetUnreadCount(conversationId: string) {
      this.unreadCount.set(conversationId, 0);
    },

    updateMessageStatus(messageId: string, status: MessageStatusValue) {
      // 更新全局消息状态
      const message = this.messages.find((m) => m.id === messageId);
      if (message) {
        message.status = status;
        message.updateTime = Date.now();
      }

      // 更新会话中的消息状态
      for (const conversationMessages of this.conversations.values()) {
        const conversationMessage = conversationMessages.find(
          (m) => m.id === messageId,
        );
        if (conversationMessage) {
          conversationMessage.status = status;
          conversationMessage.updateTime = Date.now();
          break;
        }
      }
    },

    setMessages(conversationId: string, messages: Message[]) {
      this.conversations.set(conversationId, messages);
    },

    deleteConversation(conversationId: string) {
      this.conversations.delete(conversationId);
      this.unreadCount.delete(conversationId);
    },
  },
});

// 引入需要的store
import { useUserStore } from "./userStore";
