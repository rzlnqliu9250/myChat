<template>
  <div class="chat-container">
    <chat-sidebar
      :current-user="currentUser"
      v-model:searchQuery="searchQuery"
      v-model:friendRequestUsername="friendRequestUsername"
      :friend-request-loading="friendRequestLoading"
      :friend-request-error="friendRequestError"
      :friend-request-success="friendRequestSuccess"
      :incoming-requests="incomingRequests"
      :request-action-loading-ids="requestActionLoadingIds"
      :friends="filteredFriends"
      :selected-friend-id="selectedFriend?.id || null"
      :unread-counts="unreadCounts"
      @logout="handleLogout"
      @sendFriendRequest="sendFriendRequest"
      @acceptRequest="acceptRequest"
      @rejectRequest="rejectRequest"
      @selectFriend="selectFriend"
      @deleteFriend="handleDeleteFriend"
      @avatarSelected="handleAvatarSelected"
    />

    <!-- 主内容区：聊天窗口 -->
    <main class="chat-main">
      <transition name="chat-fade-slide" mode="out-in">
        <div v-if="!selectedFriend" key="no-selection" class="no-selection">
          <div class="no-selection-content">
            <h2>选择一个好友开始聊天</h2>
            <p>从左侧列表中选择一个好友，开始您的聊天之旅</p>
          </div>
        </div>
        <div v-else :key="selectedFriend?.id" class="chat-window">
          <!-- 聊天头部 -->
          <ChatHeader :friend="selectedFriend" />

          <!-- 聊天消息区域 -->
          <div class="chat-messages" ref="messagesContainer">
            <message-bubble
              v-for="message in messages"
              :key="message.id"
              :message="message"
              :current-user-id="currentUser?.id || ''"
            />
          </div>

          <!-- 聊天输入区域 -->
          <footer class="chat-input-area">
            <chat-input
              @send="handleSendMessage"
              @sendMedia="handleSendMedia"
            />
          </footer>
        </div>
      </transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import { WebSocketEvent } from "../models/WebSocket";
import MessageBubble from "../components/chat/MessageBubble.vue";
import ChatInput from "../components/chat/ChatInput.vue";
import ChatSidebar from "../components/chat/ChatSidebar.vue";
import ChatHeader from "../components/chat/ChatHeader.vue";
import { apiDelete } from "../services/api";
import { useAvatarUpload } from "../composables/chat/useAvatarUpload";
import { useDesktopNotify } from "../composables/chat/useDesktopNotify";
import { useFriendRequests } from "../composables/chat/useFriendRequests";
import { useFriends } from "../composables/chat/useFriends";
import { useScrollMessagesToBottom } from "../composables/chat/useScrollMessagesToBottom";
import { useUnreadCounts } from "../composables/chat/useUnreadCounts";
import { useChatMessages } from "../composables/chat/useChatMessages";
import type { UiFriend } from "../types/chat";

const router = useRouter();
const userStore = useUserStore();
const { send, on, connect } = useWebSocket();

const searchQuery = ref("");
const selectedFriend = ref<UiFriend | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

let fetchMessagesImpl: (friendId: string) => Promise<void> = async () => {};

const { unreadCounts, incrementUnread, clearUnread } = useUnreadCounts();
const { scrollMessagesToBottom } = useScrollMessagesToBottom(messagesContainer);
const { handleAvatarSelected } = useAvatarUpload(userStore);

const setStoreFriends = (uiFriends: UiFriend[]) => {
  userStore.setFriends(
    uiFriends.map((f) => ({
      id: f.id,
      username: f.username,
      nickname: f.nickname,
      avatar: f.avatarUrl || undefined,
      status: f.status as any,
    })),
  );
};

const { friends, fetchFriends } = useFriends(
  () => userStore.token,
  setStoreFriends,
);

const {
  friendRequestUsername,
  friendRequestLoading,
  friendRequestError,
  friendRequestSuccess,
  incomingRequests,
  requestActionLoadingIds,
  sendFriendRequest,
  acceptRequest,
  rejectRequest,
  fetchIncomingRequests,
} = useFriendRequests(() => userStore.token, fetchFriends);

// 当前登录用户
const currentUser = computed(() => userStore.currentUser);

const selectFriend = async (friend: UiFriend) => {
  selectedFriend.value = friend;
  if (friend?.id) {
    clearUnread(friend.id);
  }
  await fetchMessagesImpl(friend.id);
};

const { maybeNotifyDesktop } = useDesktopNotify(friends, selectFriend);

const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return friends.value;
  }
  const q = searchQuery.value.toLowerCase();
  return friends.value.filter(
    (friend) =>
      (friend.nickname || "").toLowerCase().includes(q) ||
      (friend.username || "").toLowerCase().includes(q),
  );
});

const {
  messages,
  fetchMessages,
  handleSendMessage,
  handleSendMedia,
  handleMessageReceive,
} = useChatMessages({
  getToken: () => userStore.token,
  currentUser,
  selectedFriend,
  friends,
  scrollMessagesToBottom,
  incrementUnread,
  maybeNotifyDesktop,
  send,
});

fetchMessagesImpl = fetchMessages;

const setFriendStatus = (
  friendId: string,
  status: "online" | "offline",
): void => {
  const target = friends.value.find((f) => f.id === friendId);
  if (target) {
    target.status = status;
  }

  if (selectedFriend.value?.id === friendId) {
    selectedFriend.value.status = status;
  }

  setStoreFriends(friends.value);
};

const handleDeleteFriend = async (friend: UiFriend) => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  const name = friend.nickname || friend.username;
  const confirmed = window.confirm(`确定删除好友「${name}」吗？`);
  if (!confirmed) {
    return;
  }

  try {
    await apiDelete<{ success: boolean }>(`/api/friends/${friend.id}`, token);

    if (selectedFriend.value?.id === friend.id) {
      selectedFriend.value = null;
      messages.value = [];
    }

    await fetchFriends();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    friendRequestError.value = msg && msg !== "请求失败" ? msg : "删除好友失败";
  }
};

// 退出登录
const handleLogout = () => {
  userStore.logout();
  router.push("/login");
};

// 组件挂载时的初始化
onMounted(() => {
  // 如果未登录，跳转到登录页
  if (!userStore.token) {
    router.push("/login");
    return;
  }

  // 连接WebSocket
  connect();

  void fetchFriends().catch((e) => console.error(e));
  void fetchIncomingRequests().catch((e) => console.error(e));

  on(WebSocketEvent.FRIEND_REQUEST_CREATED, () => {
    void fetchIncomingRequests().catch((e) => console.error(e));
  });

  on(WebSocketEvent.FRIEND_REQUEST_ACCEPTED, () => {
    void Promise.all([fetchFriends(), fetchIncomingRequests()]).catch((e) =>
      console.error(e),
    );
  });

  on(WebSocketEvent.FRIEND_REQUEST_REJECTED, () => {
    friendRequestError.value = "好友申请被对方拒绝";
    window.setTimeout(() => {
      if (friendRequestError.value === "好友申请被对方拒绝") {
        friendRequestError.value = null;
      }
    }, 3000);
  });

  on(WebSocketEvent.USER_ONLINE, (data: { userId?: string } | undefined) => {
    const userId = data?.userId ? String(data.userId) : "";
    if (!userId) {
      return;
    }
    setFriendStatus(userId, "online");
  });

  on(WebSocketEvent.USER_OFFLINE, (data: { userId?: string } | undefined) => {
    const userId = data?.userId ? String(data.userId) : "";
    if (!userId) {
      return;
    }
    setFriendStatus(userId, "offline");
  });

  on(
    WebSocketEvent.FRIEND_REMOVED,
    (data: { userId?: string; friendId?: string } | undefined) => {
      const myId = currentUser.value?.id;
      const removedA = data?.userId;
      const removedB = data?.friendId;

      if (removedA) {
        clearUnread(removedA);
      }
      if (removedB) {
        clearUnread(removedB);
      }

      if (
        selectedFriend.value?.id &&
        (selectedFriend.value.id === removedA ||
          selectedFriend.value.id === removedB)
      ) {
        selectedFriend.value = null;
        messages.value = [];
      }

      void fetchFriends().catch((e) => console.error(e));

      if (myId && (myId === removedA || myId === removedB)) {
        void fetchIncomingRequests().catch((e) => console.error(e));
      }
    },
  );

  // 监听新消息
  on(WebSocketEvent.MESSAGE_RECEIVE, (message: any) => {
    handleMessageReceive(message);
  });
});
</script>

<style scoped>
.chat-container {
  width: 100%;
  height: 100vh;
  display: flex;
  background-color: #f5f5f5;
}

/* 主内容区样式 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
  min-height: 0;
}

.no-selection {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #999;
}

.no-selection-content {
  text-align: center;
}

/* 聊天窗口样式 */
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  margin: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  min-height: 0;
  overflow: hidden;
}

/* 聊天消息区域 */
.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.chat-fade-slide-enter-active,
.chat-fade-slide-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.chat-fade-slide-enter-from,
.chat-fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
