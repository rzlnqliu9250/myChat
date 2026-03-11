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
      @logout="handleLogout"
      @deleteAccount="handleDeleteAccount"
      @sendFriendRequest="sendFriendRequest"
      @acceptRequest="acceptRequest"
      @rejectRequest="rejectRequest"
      @selectFriend="selectFriend"
      @selectGroup="selectGroup"
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

          <div class="chat-messages" ref="messagesContainer">
            <message-bubble
              v-for="message in messages"
              :key="message.id"
              :message="message"
              :current-user-id="currentUser?.id || ''"
            />
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from "vue";
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
import { apiDelete, apiPatch } from "../services/api"; // 去除了 apiGet 和 apiPost，因为主文件不再需要
import { useAvatarUpload } from "../composables/chat/useAvatarUpload";
import { useDesktopNotify } from "../composables/chat/useDesktopNotify";
import { useFriendRequests } from "../composables/chat/useFriendRequests";
import { useFriends } from "../composables/chat/useFriends";
import { useGroups } from "../composables/chat/useGroups";
import { useScrollMessagesToBottom } from "../composables/chat/useScrollMessagesToBottom";
import { useUnreadCounts } from "../composables/chat/useUnreadCounts";
import { useChatMessages } from "../composables/chat/useChatMessages";
import type { UiFriend, UiGroup } from "../types/chat";

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

// fetchMessagesImpl/fetchGroupMessagesImpl：用于在一些回调里延迟调用 fetch（避免闭包捕获问题）。
let fetchMessagesImpl: (friendId: string) => Promise<void> = async () => {};
let fetchGroupMessagesImpl: (groupId: string) => Promise<void> = async () => {};

// 未读计数模块：
// - unreadCounts: { [friendId]: number }
// - incrementUnread: 收到非当前会话消息时 +1
// - clearUnread: 切换到会话时清零
const { unreadCounts, incrementUnread, clearUnread } = useUnreadCounts();

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
    clearUnread(friend.id);
  }
  await fetchMessagesImpl(friend.id);
};

const selectGroup = async (group: UiGroup) => {
  selectedGroup.value = group;
  selectedFriend.value = null;
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
  handleSendMessage,
  handleSendMedia,
  handleMessageReceive,
} = useChatMessages({
  getToken: () => userStore.token,
  currentUser,
  selectedFriend,
  selectedGroup,
  friends,
  scrollMessagesToBottom,
  incrementUnread,
  maybeNotifyDesktop,
  send,
});

// 这里保存 fetch* 的引用，供其他回调使用
fetchMessagesImpl = fetchMessages;
fetchGroupMessagesImpl = fetchGroupMessages;

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
