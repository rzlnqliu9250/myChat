<template>
  <div class="chat-container">
    <ConfirmCards
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :confirm-color="confirmState.confirmColor"
      :cancel-color="confirmState.cancelColor"
      @confirm="handleConfirmOk"
      @cancel="handleConfirmCancel"
    />

    <GroupManageModal
      v-if="groupManageOpen"
      :group="selectedGroup"
      :friends="friends"
      :current-user="currentUser"
      @close="closeGroupManage"
      @refresh-groups="fetchGroups"
      @group-left="handleGroupLeft"
    />

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
      :all-friends="friends"
      :groups="groups"
      :selected-friend-id="selectedFriend?.id || null"
      :selected-group-id="selectedGroup?.id || null"
      :unread-counts="unreadCounts"
      :favorites="favorites"
      @logout="handleLogout"
      @deleteAccount="handleDeleteAccount"
      @sendFriendRequest="sendFriendRequest"
      @acceptRequest="acceptRequest"
      @rejectRequest="rejectRequest"
      @selectFriend="selectFriend"
      @selectGroup="selectGroup"
      @selectFavorite="handleSelectFavorite"
      @createGroup="handleCreateGroup"
      @updateNickname="handleUpdateNickname"
      @deleteFriend="handleDeleteFriend"
      @avatarSelected="handleAvatarSelected"
    />

    <main class="chat-main">
      <transition name="chat-fade-slide" mode="out-in">
        <div
          v-if="!selectedFriend && !selectedGroup"
          key="no-selection"
          class="no-selection"
        >
          <div class="no-selection-content">
            <h2>选择一个好友开始聊天</h2>
            <p>从左侧列表中选择一个好友，开始您的聊天之旅</p>
          </div>
        </div>
        <div
          v-else
          :key="selectedFriend?.id || selectedGroup?.id"
          class="chat-window"
        >
          <ChatHeader
            :friend="selectedFriend"
            :group="selectedGroup"
            @openGroupManage="openGroupManage"
          />

          <div class="message-search-bar">
            <input
              v-model="messageSearchQuery"
              class="message-search-input"
              type="text"
              placeholder="搜索当前会话消息"
              :disabled="!selectedFriend && !selectedGroup"
              @keydown.enter.prevent="handleMessageSearch"
            />
            <button
              class="message-search-btn"
              :disabled="messageSearchLoading || (!selectedFriend && !selectedGroup)"
              @click="handleMessageSearch"
            >
              搜索
            </button>
            <button
              v-if="messageSearchOpen"
              class="message-search-close"
              @click="closeMessageSearch"
            >
              关闭
            </button>
          </div>

          <div class="chat-messages" ref="messagesContainer">
            <div
              v-for="message in messages"
              :key="message.id"
              class="message-row"
              :data-message-id="message.id"
              :class="{
                'message-row-highlight': highlightMessageId === message.id,
                'message-row-sent': message.senderId === (currentUser?.id || ''),
                'message-row-received': message.senderId !== (currentUser?.id || ''),
              }"
            >
              <message-bubble
                :message="message"
                :current-user-id="currentUser?.id || ''"
                @toggle-favorite="handleToggleFavorite"
              />
            </div>
          </div>

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

  <Teleport to="body">
    <div
      v-if="messageSearchOpen"
      class="message-search-overlay"
      @click.self="closeMessageSearch"
    >
      <div class="message-search-panel">
        <div class="message-search-panel-header">
          <div class="message-search-panel-title">搜索结果</div>
          <button class="message-search-panel-close" @click="closeMessageSearch">
            关闭
          </button>
        </div>

        <div v-if="messageSearchError" class="message-search-error">
          {{ messageSearchError }}
        </div>

        <div v-else class="message-search-results">
          <div v-if="messageSearchLoading" class="message-search-loading">
            加载中...
          </div>
          <div
            v-else-if="messageSearchResults.length === 0"
            class="message-search-empty"
          >
            暂无结果
          </div>
          <button
            v-else
            v-for="item in messageSearchResults"
            :key="item.id"
            class="message-search-item"
            @click="jumpToSearchedMessage(item.id)"
          >
            <div class="message-search-item-top">
              <span class="message-search-item-sender">
                {{ item.senderNickname || (item.senderId === currentUser?.id ? '我' : '对方') }}
              </span>
              <span class="message-search-item-time">{{ formatSearchTime(item.createTime) }}</span>
            </div>
            <div class="message-search-item-content">
              {{ item.type === 'image' ? '[图片]' : item.type === 'video' ? '[视频]' : item.content }}
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import { WebSocketEvent } from "../models/WebSocket";
import MessageBubble from "../components/chat/MessageBubble.vue";
import ChatInput from "../components/chat/ChatInput.vue";
import ChatSidebar from "../components/chat/ChatSidebar.vue";
import ChatHeader from "../components/chat/ChatHeader.vue";
import ConfirmCards from "../components/ui/ConfirmCards.vue";
import GroupManageModal from "../components/chat/GroupManageModal.vue"; // 引入新组件
import { apiDelete, apiGet, apiPatch, apiRequest } from "../services/api"; // 去除了 apiPost，因为主文件不再需要
import { useAvatarUpload } from "../composables/chat/useAvatarUpload";
import { useDesktopNotify } from "../composables/chat/useDesktopNotify";
import { useFriendRequests } from "../composables/chat/useFriendRequests";
import { useFriends } from "../composables/chat/useFriends";
import { useGroups } from "../composables/chat/useGroups";
import { useScrollMessagesToBottom } from "../composables/chat/useScrollMessagesToBottom";
import { useUnreadCounts } from "../composables/chat/useUnreadCounts";
import { useChatMessages } from "../composables/chat/useChatMessages";
import type { UiFriend, UiGroup } from "../types/chat";
import type { Message } from "../models/Message";

// Chat.vue 是“聊天主页面”的编排层（Orchestrator）：
// - 负责把各种 composables 组装起来（好友列表/群组/消息/未读/通知/头像上传等）
// - 负责维护当前选中的会话（selectedFriend/selectedGroup）
// - 负责绑定 WebSocket 事件，把服务端推送交给对应模块处理
// 注意：这里尽量不写底层逻辑（例如 WS 重连/HTTP 封装/消息状态机），底层逻辑都沉到 composables/services。
const router = useRouter();
const userStore = useUserStore();
const { send, on, connect } = useWebSocket();

// searchQuery: 搜索好友/群组使用
const searchQuery = ref("");

// selectedFriend/selectedGroup：当前窗口正在看的会话。
// 约束：同一时刻只能选中一个（单聊 or 群聊），切换时会清空 messages 并重新拉取。
const selectedFriend = ref<UiFriend | null>(null);
const selectedGroup = ref<UiGroup | null>(null);

// messagesContainer：消息滚动容器 DOM
const messagesContainer = ref<HTMLElement | null>(null);

// 收藏消息列表
const favorites = ref<Message[]>([]);

// fetchMessagesImpl/fetchGroupMessagesImpl：用于在一些回调里延迟调用 fetch（避免闭包捕获问题）。
let fetchMessagesImpl: (friendId: string) => Promise<void> = async () => {};
let fetchGroupMessagesImpl: (groupId: string) => Promise<void> = async () => {};

// 未读计数模块：
// - unreadCounts: { [friendId]: number }
// - incrementUnread: 收到非当前会话消息时 +1
// - clearUnread: 切换到会话时清零
const { unreadCounts, conversationKey, incrementUnread, clearUnread } =
  useUnreadCounts();

// 滚动模块：封装“滚动到底部”的实现细节（例如 nextTick/容器高度变化）
const { scrollMessagesToBottom } = useScrollMessagesToBottom(messagesContainer);

// 头像上传模块：用于个人信息/头像相关操作
const { handleAvatarSelected } = useAvatarUpload(userStore);

// setStoreFriends：把 UI Friend 映射到 userStore 里维护的 User（主要用于展示/在线状态更新）
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

// 群组模块：拉取群列表、创建群等
const { groups, fetchGroups, createGroup } = useGroups(() => userStore.token);

// ================= 群组管理弹窗控制 =================
const groupManageOpen = ref(false);

const openGroupManage = () => {
  if (!selectedGroup.value) return;
  groupManageOpen.value = true;
};

const closeGroupManage = () => {
  groupManageOpen.value = false;
};

const handleGroupLeft = async () => {
  closeGroupManage();
  selectedGroup.value = null;
  messages.value = [];
  await fetchGroups();
};
// ===================================================

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
  selectedGroup.value = null;
  if (friend?.id) {
    clearUnread(conversationKey("friend", friend.id));
  }
  await fetchMessagesImpl(friend.id);
};

const selectGroup = async (group: UiGroup) => {
  selectedGroup.value = group;
  selectedFriend.value = null;
  if (group?.id) {
    clearUnread(conversationKey("group", group.id));
  }
  await fetchGroupMessagesImpl(group.id);
};

const handleCreateGroup = async (
  payload: { name: string; memberIds: string[] },
  callbacks: { onSuccess: () => void; onError: (msg: string) => void },
) => {
  try {
    const created = await createGroup(payload);
    await fetchGroups();
    await selectGroup(created);
    callbacks.onSuccess();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    callbacks.onError(msg || "创建群聊失败");
  }
};

const { maybeNotifyDesktop } = useDesktopNotify(friends, selectFriend);

const filteredFriends = computed(() => {
  if (!searchQuery.value) return friends.value;
  const q = searchQuery.value.toLowerCase();
  return friends.value.filter(
    (friend) =>
      (friend.nickname || "").toLowerCase().includes(q) ||
      (friend.username || "").toLowerCase().includes(q),
  );
});

// setFriendStatus：统一更新某个好友的在线状态。
// 说明：
// - ChatSidebar 展示用的是 friends（UiFriend[]）
// - userStore 里也维护了一份 friends（User[]）用于全局展示
// 因此这里需要同时更新两边的数据源。
const setFriendStatus = (friendId: string, status: "online" | "offline") => {
  const target = friends.value.find((f) => f.id === friendId);
  if (target) {
    target.status = status;
  }

  if (selectedFriend.value?.id === friendId && selectedFriend.value) {
    selectedFriend.value.status = status;
  }

  setStoreFriends(friends.value);
};

// 消息模块：
// - fetchMessages/fetchGroupMessages：切换会话后拉取历史
// - handleSendMessage/handleSendMedia：发送消息（内部会做乐观插入 sending）
// - handleMessageReceive：WS 收到 message_receive 后的统一入口（回执/新消息/未读/通知）
const {
  messages,
  fetchMessages,
  fetchGroupMessages,
  searchMessages,
  handleSendMessage,
  handleSendMedia,
  handleMessageReceive,
  handleMessageRead,
} = useChatMessages({
  getToken: () => userStore.token,
  currentUser,
  selectedFriend,
  selectedGroup,
  friends,
  scrollMessagesToBottom,
  conversationKey,
  incrementUnread,
  maybeNotifyDesktop,
  send: (type, data) => {
    send(type as any, data as any);
  },
});

// 这里保存 fetch* 的引用，供其他回调使用
fetchMessagesImpl = fetchMessages;
fetchGroupMessagesImpl = fetchGroupMessages;

const messageSearchQuery = ref("");
const messageSearchOpen = ref(false);
const messageSearchLoading = ref(false);
const messageSearchError = ref<string | null>(null);
const messageSearchResults = ref<any[]>([]);
const highlightMessageId = ref<string | null>(null);

const closeMessageSearch = () => {
  messageSearchOpen.value = false;
  messageSearchLoading.value = false;
  messageSearchError.value = null;
  messageSearchResults.value = [];
};

const handleToggleFavorite = async (payload: {
  messageId: string;
  favorited: boolean;
}) => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  const messageIdText = String(payload.messageId);
  if (!/^\d+$/.test(messageIdText)) {
    return;
  }

  const idx = messages.value.findIndex((m) => String(m.id) === messageIdText);
  if (idx < 0) {
    return;
  }

  const existing = messages.value[idx];
  if (!existing) {
    return;
  }

  const prev = Boolean(existing.isFavorited);
  messages.value[idx] = { ...existing, isFavorited: payload.favorited };

  try {
    if (payload.favorited) {
      await apiRequest<{ ok: boolean }>(
        "/api/favorites",
        {
          method: "POST",
          body: JSON.stringify({ messageId: Number(messageIdText) }),
        },
        token,
      );
    } else {
      await apiDelete<void>(`/api/favorites/${messageIdText}`, token);
    }
    // 更新收藏列表
    await fetchFavorites();
  } catch {
    const latest = messages.value[idx];
    if (latest) {
      messages.value[idx] = { ...latest, isFavorited: prev };
    }
  }
};

const handleMessageSearch = async () => {
  if (!selectedFriend.value && !selectedGroup.value) {
    return;
  }

  const q = messageSearchQuery.value.trim();
  if (!q) {
    closeMessageSearch();
    return;
  }

  messageSearchOpen.value = true;
  messageSearchLoading.value = true;
  messageSearchError.value = null;
  messageSearchResults.value = [];

  try {
    const friendId = selectedFriend.value?.id;
    const groupId = selectedGroup.value?.id;
    const results = await searchMessages({
      q,
      friendId: friendId || undefined,
      groupId: groupId || undefined,
      limit: 100,
      offset: 0,
    });
    messageSearchResults.value = results;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    messageSearchError.value = msg || "搜索失败";
  } finally {
    messageSearchLoading.value = false;
  }
};

const formatSearchTime = (ts: number) => {
  const d = new Date(ts);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
};

const jumpToSearchedMessage = async (messageId: string) => {
  closeMessageSearch();
  highlightMessageId.value = messageId;
  await nextTick();

  const container = messagesContainer.value;
  if (!container) {
    return;
  }

  const escapeSelector = (value: string) => {
    const cssAny = (globalThis as any).CSS;
    if (cssAny && typeof cssAny.escape === "function") {
      return cssAny.escape(value);
    }
    return value.replace(/"/g, "\\\"");
  };

  const el = container.querySelector(
    `[data-message-id="${escapeSelector(String(messageId))}"]`,
  ) as HTMLElement | null;

  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  window.setTimeout(() => {
    if (highlightMessageId.value === messageId) {
      highlightMessageId.value = null;
    }
  }, 2000);
};

// ================= 确认框状态聚合优化 =================
type ConfirmAction = "logout" | "deleteFriend" | "deleteAccount";

const confirmState = reactive({
  open: false,
  title: "",
  message: "",
  confirmText: "确认",
  cancelText: "取消",
  confirmColor: "green" as "red" | "blue" | "green",
  cancelColor: "blue" as "red" | "blue" | "green",
  action: null as ConfirmAction | null,
  payload: null as UiFriend | null,
});

const openConfirm = (config: Partial<typeof confirmState>) => {
  Object.assign(confirmState, { ...config, open: true });
};

const closeConfirm = () => {
  confirmState.open = false;
  confirmState.action = null;
  confirmState.payload = null;
};

const handleConfirmCancel = () => {
  closeConfirm();
};

const handleConfirmOk = async () => {
  const { action, payload: friend } = confirmState;
  closeConfirm();

  if (action === "logout") {
    userStore.logout();
    router.push("/login");
    return;
  }

  if (action === "deleteFriend" && friend) {
    await confirmDeleteFriend(friend);
  }

  if (action === "deleteAccount") {
    await confirmDeleteAccount();
  }
};
// ===================================================

const confirmDeleteFriend = async (friend: UiFriend) => {
  const token = userStore.token;
  if (!token) return;

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

const handleDeleteFriend = async (friend: UiFriend) => {
  const name = friend.nickname || friend.username;
  openConfirm({
    action: "deleteFriend",
    payload: friend,
    title: "删除好友",
    message: `确定删除好友「${name}」吗？`,
    confirmText: "确定删除",
    cancelText: "取消",
    confirmColor: "red",
    cancelColor: "blue",
  });
};

const handleLogout = () => {
  openConfirm({
    action: "logout",
    title: "退出登录",
    message: "确定要退出登录吗？",
    confirmText: "退出登录",
    cancelText: "取消",
    confirmColor: "red",
    cancelColor: "blue",
  });
};

const confirmDeleteAccount = async () => {
  const token = userStore.token;
  if (!token) return;

  try {
    await apiDelete<{ success: boolean }>("/api/users/me", token);
    userStore.logout();
    router.push("/login");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    friendRequestError.value = msg || "注销账号失败";
  }
};

const handleDeleteAccount = () => {
  openConfirm({
    action: "deleteAccount",
    title: "注销账号",
    message: "确定要注销账号吗？此操作不可恢复。",
    confirmText: "确认注销",
    cancelText: "取消",
    confirmColor: "red",
    cancelColor: "blue",
  });
};

// 获取收藏消息列表
const fetchFavorites = async () => {
  const token = userStore.token;
  if (!token) return;

  try {
    const data = await apiGet<{
      messages: (Omit<Message, "createTime" | "updateTime"> & {
        createdAt?: string;
        createTime?: number;
        updateTime?: number;
      })[];
    }>("/api/favorites", token);

    favorites.value = (data.messages || []).map((m: (typeof data.messages)[number]) => {
      const createdAt = (m as any).createdAt;
      const ts = typeof createdAt === "string" ? new Date(createdAt).getTime() : Date.now();
      return {
        ...(m as any),
        createTime: typeof (m as any).createTime === "number" ? (m as any).createTime : ts,
        updateTime: typeof (m as any).updateTime === "number" ? (m as any).updateTime : ts,
      } as Message;
    });
  } catch (error) {
    console.error('获取收藏消息失败:', error);
  }
};

// 处理选择收藏消息
const handleSelectFavorite = async (message: Message) => {
  // 如果是群聊消息，切换到群聊
  if (message.groupId) {
    const group = groups.value.find(g => g.id === message.groupId);
    if (group) {
      await selectGroup(group);
    }
  }
  // 如果是单聊消息，切换到对应的好友
  else if (message.receiverId && message.senderId) {
    const friendId = message.senderId === currentUser.value?.id ? message.receiverId : message.senderId;
    const friend = friends.value.find(f => f.id === friendId);
    if (friend) {
      await selectFriend(friend);
    }
  }
  
  // 滚动到对应的消息
  nextTick(() => {
    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
};

const handleUpdateNickname = (
  payload: { nickname: string },
  callbacks: { onSuccess: () => void; onError: (msg: string) => void },
) => {
  const token = userStore.token;
  if (!token) {
    callbacks.onError("未登录");
    return;
  }

  void apiPatch<{
    user: {
      id: string;
      username: string;
      nickname: string;
      avatarUrl?: string | null;
    };
  }>("/api/users/me", { nickname: payload.nickname }, token)
    .then((data) => {
      const existing = userStore.currentUser;
      if (existing) {
        userStore.setCurrentUser({
          ...existing,
          nickname: data.user.nickname || data.user.username,
        });
      }
      callbacks.onSuccess();
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : "";
      callbacks.onError(msg || "更换昵称失败");
    });
};

// ================= 生命周期与 WebSocket 初始化 =================
onMounted(() => {
  if (!userStore.token) {
    router.push("/login");
    return;
  }

  connect();

  void fetchFriends().catch((e) => console.error(e));
  void fetchIncomingRequests().catch((e) => console.error(e));
  void fetchGroups().catch((e) => console.error(e));
  void fetchFavorites().catch((e) => console.error(e));

  on(
    WebSocketEvent.GROUP_MEMBERSHIP_CHANGED,
    (data: { action?: string; groupId?: string } | undefined) => {
      const groupId = data?.groupId ? String(data.groupId) : "";
      if (!groupId) return;

      const action = data?.action ? String(data.action) : "";
      void fetchGroups().catch((e) => console.error(e));

      if (
        selectedGroup.value?.id === groupId &&
        (action === "kicked" || action === "left")
      ) {
        closeGroupManage();
        selectedGroup.value = null;
        messages.value = [];
      }
    },
  );

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
    if (userId) setFriendStatus(userId, "online");
  });

  on(WebSocketEvent.USER_OFFLINE, (data: { userId?: string } | undefined) => {
    const userId = data?.userId ? String(data.userId) : "";
    if (userId) setFriendStatus(userId, "offline");
  });

  on(
    WebSocketEvent.FRIEND_REMOVED,
    (data: { userId?: string; friendId?: string } | undefined) => {
      const myId = currentUser.value?.id;
      const removedA = data?.userId;
      const removedB = data?.friendId;

      if (removedA) clearUnread(removedA);
      if (removedB) clearUnread(removedB);

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

  on(WebSocketEvent.MESSAGE_RECEIVE, (message: any) => {
    handleMessageReceive(message);
  });

  on(WebSocketEvent.MESSAGE_READ, (payload: any) => {
    handleMessageRead(payload);
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

.message-row {
  display: flex;
  width: 100%;
}

.message-row-sent {
  justify-content: flex-end;
}

.message-row-received {
  justify-content: flex-start;
}

.message-search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.message-search-input {
  flex: 1;
  height: 38px;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 0 12px;
  outline: none;
}

.message-search-input:disabled {
  background: #f7f7f7;
}

.message-search-btn,
.message-search-close,
.message-search-panel-close {
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
}

.message-search-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.message-row-highlight {
  animation: msg-highlight 2s ease;
}

@keyframes msg-highlight {
  0% {
    background: rgba(255, 230, 120, 0.65);
    border-radius: 12px;
  }
  70% {
    background: rgba(255, 230, 120, 0.35);
    border-radius: 12px;
  }
  100% {
    background: transparent;
    border-radius: 12px;
  }
}

.message-search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
  z-index: 2500;
}

.message-search-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(420px, 92vw);
  background: #fff;
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.message-search-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
}

.message-search-panel-title {
  font-weight: 800;
}

.message-search-error {
  padding: 14px;
  color: #d32f2f;
}

.message-search-results {
  flex: 1;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message-search-loading,
.message-search-empty {
  padding: 14px;
  color: #777;
}

.message-search-item {
  text-align: left;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  cursor: pointer;
}

.message-search-item:hover {
  border-color: #cfd8dc;
  background: #fafafa;
}

.message-search-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #666;
  font-size: 12px;
}

.message-search-item-sender {
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-search-item-time {
  flex-shrink: 0;
}

.message-search-item-content {
  margin-top: 6px;
  color: #111;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
