<template>
  <div class="chat-container">
    <!-- 侧边栏：好友列表 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="user-info">
          <div class="user-avatar">
            {{ currentUser?.nickname?.charAt(0) || "U" }}
          </div>
          <div class="user-details">
            <h3 class="user-name">{{ currentUser?.nickname || "未登录" }}</h3>
            <span class="user-status">{{
              currentUser?.status || "offline"
            }}</span>
          </div>
        </div>
        <button class="logout-button" @click="handleLogout">退出登录</button>
      </div>

      <!-- 搜索框 -->
      <div class="search-box">
        <input
          type="text"
          placeholder="搜索好友..."
          v-model="searchQuery"
          class="search-input"
        />
      </div>

      <div class="friend-actions">
        <div class="friend-actions-title">添加好友</div>
        <div class="friend-request-form">
          <input
            v-model="friendRequestUsername"
            class="friend-request-input"
            placeholder="输入对方用户名"
            type="text"
          />
          <button
            class="friend-request-button"
            :disabled="friendRequestLoading || !friendRequestUsername"
            @click="sendFriendRequest"
          >
            发送
          </button>
        </div>
        <div v-if="friendRequestError" class="friend-request-error">
          {{ friendRequestError }}
        </div>
        <div v-if="friendRequestSuccess" class="friend-request-success">
          {{ friendRequestSuccess }}
        </div>
      </div>

      <div class="friend-requests" v-if="incomingRequests.length">
        <div class="friend-requests-title">
          好友申请
          <span class="friend-requests-count"
            >({{ incomingRequests.length }})</span
          >
        </div>
        <div
          v-for="req in incomingRequests"
          :key="req.id"
          class="friend-request-item"
        >
          <div class="friend-request-user">
            {{ req.fromUser?.nickname || req.fromUser?.username || "未知用户" }}
          </div>
          <div class="friend-request-actions">
            <button
              class="friend-request-action accept"
              :disabled="requestActionLoadingIds.has(req.id)"
              @click="acceptRequest(req.id)"
            >
              同意
            </button>
            <button
              class="friend-request-action reject"
              :disabled="requestActionLoadingIds.has(req.id)"
              @click="rejectRequest(req.id)"
            >
              拒绝
            </button>
          </div>
        </div>
      </div>

      <!-- 好友列表 -->
      <div class="friend-list">
        <h4 class="friend-list-title">好友列表</h4>
        <div
          v-for="friend in filteredFriends"
          :key="friend.id"
          class="friend-item"
          :class="{ active: selectedFriend?.id === friend.id }"
          @click="selectFriend(friend)"
        >
          <div class="friend-avatar">{{ friend.nickname.charAt(0) }}</div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.nickname }}</div>
            <div class="friend-status">
              <span class="status-indicator" :class="friend.status"></span>
              {{ friend.status }}
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区：聊天窗口 -->
    <main class="chat-main">
      <div v-if="!selectedFriend" class="no-selection">
        <div class="no-selection-content">
          <h2>选择一个好友开始聊天</h2>
          <p>从左侧列表中选择一个好友，开始您的聊天之旅</p>
        </div>
      </div>
      <div v-else class="chat-window">
        <!-- 聊天头部 -->
        <header class="chat-header">
          <div class="chat-header-info">
            <div class="friend-avatar">
              {{ selectedFriend.nickname.charAt(0) }}
            </div>
            <div>
              <h3 class="friend-name">{{ selectedFriend.nickname }}</h3>
              <span class="friend-status">
                <span
                  class="status-indicator"
                  :class="selectedFriend.status"
                ></span>
                {{ selectedFriend.status }}
              </span>
            </div>
          </div>
        </header>

        <!-- 聊天消息区域 -->
        <div class="chat-messages">
          <message-bubble
            v-for="message in messages"
            :key="message.id"
            :message="message"
            :current-user-id="currentUser?.id || ''"
          />
        </div>

        <!-- 聊天输入区域 -->
        <footer class="chat-input-area">
          <chat-input @send="handleSendMessage" />
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import type { Message } from "../models/Message";
import MessageBubble from "../components/chat/MessageBubble.vue";
import ChatInput from "../components/chat/ChatInput.vue";

const router = useRouter();
const userStore = useUserStore();
const { send, on, connect } = useWebSocket();

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080";

const searchQuery = ref("");
const selectedFriend = ref<any>(null);
const messages = ref<Message[]>([]);

// 当前登录用户
const currentUser = computed(() => userStore.currentUser);

type ApiFriend = {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  online: boolean;
};

type UiFriend = ApiFriend & {
  status: "online" | "offline";
};

const friends = ref<UiFriend[]>([]);

type IncomingRequest = {
  id: string;
  fromUser: {
    id: string;
    username: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  status: string;
};

const friendRequestUsername = ref("");
const friendRequestLoading = ref(false);
const friendRequestError = ref<string | null>(null);
const friendRequestSuccess = ref<string | null>(null);

const incomingRequests = ref<IncomingRequest[]>([]);
const requestActionLoadingIds = ref(new Set<string>());

const fetchFriends = async () => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  const resp = await fetch(`${apiBase}/api/friends`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const err = (await resp.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error || "加载好友失败");
  }

  const data = (await resp.json()) as { friends: ApiFriend[] };
  friends.value = (data.friends || []).map((f) => ({
    ...f,
    status: f.online ? ("online" as const) : ("offline" as const),
  }));

  userStore.setFriends(
    friends.value.map((f) => ({
      id: f.id,
      username: f.username,
      nickname: f.nickname,
      avatar: f.avatarUrl || undefined,
      status: f.status,
    })),
  );
};

const fetchMessages = async (friendId: string) => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  const resp = await fetch(`${apiBase}/api/messages/${friendId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const err = (await resp.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error || "加载聊天记录失败");
  }

  const data = (await resp.json()) as {
    messages: {
      id: string;
      senderId: string;
      receiverId: string;
      content: string;
      isRead: boolean;
      createdAt: string;
    }[];
  };

  messages.value = (data.messages || []).map((m) => {
    const ts = new Date(m.createdAt).getTime();
    return {
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      type: "text" as const,
      status: m.isRead ? ("read" as const) : ("delivered" as const),
      createTime: ts,
      updateTime: ts,
    } satisfies Message;
  });
};

const fetchIncomingRequests = async () => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  const resp = await fetch(`${apiBase}/api/friends/requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const err = (await resp.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error || "加载好友申请失败");
  }

  const data = (await resp.json()) as { requests: IncomingRequest[] };
  incomingRequests.value = data.requests || [];
};

const sendFriendRequest = async () => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  friendRequestLoading.value = true;
  friendRequestError.value = null;
  friendRequestSuccess.value = null;

  try {
    const resp = await fetch(`${apiBase}/api/friends/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: friendRequestUsername.value }),
    });

    if (!resp.ok) {
      const err = (await resp.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(err?.error || "发送好友申请失败");
    }

    friendRequestSuccess.value = "已发送好友申请";
    friendRequestUsername.value = "";
    await fetchIncomingRequests();
  } catch (e) {
    friendRequestError.value =
      e instanceof Error ? e.message : "发送好友申请失败";
  } finally {
    friendRequestLoading.value = false;
  }
};

const acceptRequest = async (requestId: string) => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  requestActionLoadingIds.value.add(requestId);
  try {
    const resp = await fetch(
      `${apiBase}/api/friends/requests/${requestId}/accept`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!resp.ok) {
      const err = (await resp.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(err?.error || "同意失败");
    }

    await Promise.all([fetchIncomingRequests(), fetchFriends()]);
  } catch (e) {
    friendRequestError.value = e instanceof Error ? e.message : "同意失败";
  } finally {
    requestActionLoadingIds.value.delete(requestId);
  }
};

const rejectRequest = async (requestId: string) => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  requestActionLoadingIds.value.add(requestId);
  try {
    const resp = await fetch(
      `${apiBase}/api/friends/requests/${requestId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!resp.ok) {
      const err = (await resp.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(err?.error || "拒绝失败");
    }

    await fetchIncomingRequests();
  } catch (e) {
    friendRequestError.value = e instanceof Error ? e.message : "拒绝失败";
  } finally {
    requestActionLoadingIds.value.delete(requestId);
  }
};

// 筛选好友
const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return friends.value;
  }
  return friends.value.filter(
    (friend) =>
      friend.nickname.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

// 选择好友
const selectFriend = async (friend: any) => {
  selectedFriend.value = friend;
  await fetchMessages(friend.id);
};

// 发送消息
const handleSendMessage = (content: string) => {
  if (!selectedFriend.value || !currentUser.value) {
    return;
  }

  const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const message: Message = {
    id: clientMessageId,
    senderId: currentUser.value.id,
    receiverId: selectedFriend.value.id,
    content: content,
    type: "text" as const,
    status: "sending" as const,
    createTime: Date.now(),
    updateTime: Date.now(),
  };

  // 添加到本地消息列表
  messages.value.push(message);

  // 发送消息到服务器（实际应该通过WebSocket发送）
  send("message_receive" as any, {
    clientMessageId,
    content: content,
    receiverId: selectedFriend.value.id,
    type: "text",
  });
};

// 退出登录
const handleLogout = () => {
  userStore.logout();
  router.push("/login");
};

// 组件挂载时的初始化
onMounted(() => {
  // 如果未登录，跳转到登录页
  if (!currentUser.value) {
    router.push("/login");
    return;
  }

  // 连接WebSocket
  connect();

  void fetchFriends().catch((e) => console.error(e));
  void fetchIncomingRequests().catch((e) => console.error(e));

  // 监听新消息
  on("message_receive" as any, (message: any) => {
    if (!message) {
      return;
    }

    const me = currentUser.value?.id;
    const friendId = selectedFriend.value?.id;

    // 如果是我发出的消息回执：用 clientMessageId 找到本地 sending 消息并更新
    if (message.clientMessageId && me && message.senderId === me) {
      const idx = messages.value.findIndex(
        (m) => m.id === message.clientMessageId,
      );
      if (idx >= 0) {
        messages.value[idx] = {
          ...messages.value[idx],
          id: String(message.id),
          status: message.status || messages.value[idx].status,
          updateTime: message.updateTime || Date.now(),
        };
        return;
      }
    }

    // 其他情况：如果当前正在跟该好友聊天，则追加
    const isCurrentConversation =
      me &&
      friendId &&
      ((message.senderId === friendId && message.receiverId === me) ||
        (message.senderId === me && message.receiverId === friendId));

    if (isCurrentConversation) {
      messages.value.push({
        id: String(message.id),
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        type: (message.type || "text") as any,
        status: (message.status || "delivered") as any,
        createTime: message.createTime || Date.now(),
        updateTime: message.updateTime || Date.now(),
      });
    }
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

/* 侧边栏样式 */
.sidebar {
  width: 300px;
  background-color: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar,
.friend-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #646cff;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 16px;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name,
.friend-name {
  font-weight: 600;
  font-size: 16px;
}

.user-status,
.friend-status {
  font-size: 12px;
  color: #666;
}

.logout-button {
  padding: 6px 12px;
  background-color: #ff5252;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.logout-button:hover {
  background-color: #ff1744;
}

/* 搜索框样式 */
.search-box {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.search-input:focus {
  border-color: #646cff;
}

.friend-actions {
  padding: 12px 15px;
  border-bottom: 1px solid #e0e0e0;
}

.friend-actions-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.friend-request-form {
  display: flex;
  gap: 8px;
}

.friend-request-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.friend-request-button {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background-color: #646cff;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.friend-request-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
}

.friend-request-error {
  margin-top: 8px;
  font-size: 12px;
  color: #d32f2f;
}

.friend-request-success {
  margin-top: 8px;
  font-size: 12px;
  color: #2e7d32;
}

.friend-requests {
  padding: 12px 15px;
  border-bottom: 1px solid #e0e0e0;
}

.friend-requests-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.friend-requests-count {
  color: #999;
}

.friend-request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.friend-request-user {
  font-size: 14px;
  color: #333;
}

.friend-request-actions {
  display: flex;
  gap: 6px;
}

.friend-request-action {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: white;
}

.friend-request-action.accept {
  background-color: #42b883;
}

.friend-request-action.reject {
  background-color: #ff5252;
}

.friend-request-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 好友列表样式 */
.friend-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.friend-list-title {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.friend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 8px;
}

.friend-item:hover {
  background-color: #f0f0f0;
}

.friend-item.active {
  background-color: #e8eaf6;
}

.friend-info {
  flex: 1;
}

.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-indicator.online {
  background-color: #4caf50;
}

.status-indicator.offline {
  background-color: #9e9e9e;
}

.status-indicator.busy {
  background-color: #ff9800;
}

.status-indicator.away {
  background-color: #ffc107;
}

/* 主内容区样式 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
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
}

.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 聊天消息区域 */
.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 聊天输入区域 */
.chat-input-area {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 24px;
  resize: none;
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.3s;
  max-height: 120px;
  overflow-y: auto;
}

.message-input:focus {
  border-color: #646cff;
}

.send-button {
  padding: 12px 24px;
  background-color: #646cff;
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
  align-self: flex-end;
}

.send-button:hover:not(:disabled) {
  background-color: #535bf2;
}

.send-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
}
</style>
