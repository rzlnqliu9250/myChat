<template>
  <div class="chat-container">
    <ConfirmCards
      :open="confirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmConfirmText"
      :cancel-text="confirmCancelText"
      :confirm-color="confirmConfirmColor"
      :cancel-color="confirmCancelColor"
      @confirm="handleConfirmOk"
      @cancel="handleConfirmCancel"
    />

    <div v-if="groupManageOpen" class="group-manage-overlay">
      <div class="group-manage-card">
        <div class="group-manage-header">
          <div class="group-manage-title">
            {{ selectedGroup?.name }}
          </div>
          <button class="group-manage-close" @click="closeGroupManage">
            关闭
          </button>
        </div>

        <div v-if="groupManageError" class="group-manage-error">
          {{ groupManageError }}
        </div>

        <div v-if="groupManageLoading" class="group-manage-loading">
          加载中...
        </div>

        <div v-else class="group-manage-body">
          <div class="group-manage-section">
            <div class="group-manage-section-title">成员列表</div>

            <div class="group-members">
              <div
                v-for="m in groupMembers"
                :key="m.user?.id || m.joinedAt"
                class="group-member"
              >
                <div class="group-member-left">
                  <div class="group-member-avatar">
                    <img
                      v-if="m.user?.avatarUrl"
                      class="group-member-avatar-image"
                      :src="m.user.avatarUrl"
                      alt="avatar"
                    />
                    <span v-else class="group-member-avatar-text">
                      {{
                        (m.user?.nickname || m.user?.username || "?").charAt(0)
                      }}
                    </span>
                  </div>
                  <div class="group-member-meta">
                    <div class="group-member-name">
                      {{ m.user?.nickname || m.user?.username || "未知用户" }}
                    </div>
                    <div class="group-member-role">{{ m.role }}</div>
                  </div>
                </div>

                <button
                  v-if="isGroupOwner && m.user?.id && m.role !== 'owner'"
                  class="group-member-kick"
                  @click="kickMember(m.user.id)"
                >
                  踢出
                </button>
              </div>
            </div>
          </div>

          <div v-if="isGroupOwner" class="group-manage-section">
            <div class="group-manage-section-title">
              继续加人（从好友中选择）
            </div>

            <div class="group-add-list">
              <label
                v-for="f in addCandidates"
                :key="f.id"
                class="group-add-item"
              >
                <input
                  type="checkbox"
                  class="group-add-checkbox ui-checkbox"
                  :checked="addMemberIds.has(f.id)"
                  @change="toggleAddMember(f.id)"
                />
                <span class="group-add-text">{{
                  f.nickname || f.username
                }}</span>
              </label>
            </div>

            <button
              class="group-add-confirm"
              :disabled="addMembersSubmitting || !addMemberIds.size"
              @click="addMembers"
            >
              {{ addMembersSubmitting ? "添加中..." : "添加成员" }}
            </button>
          </div>

          <div class="group-manage-section">
            <div class="group-manage-section-title">退出群聊</div>
            <button
              class="group-leave"
              :disabled="leaveSubmitting || isGroupOwner"
              @click="leaveGroup"
            >
              {{ leaveSubmitting ? "处理中..." : "退出群聊" }}
            </button>
          </div>
        </div>
      </div>
    </div>

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

    <!-- 主内容区：聊天窗口 -->
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
          <!-- 聊天头部 -->
          <ChatHeader
            :friend="selectedFriend"
            :group="selectedGroup"
            @openGroupManage="openGroupManage"
          />

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
import ConfirmCards from "../components/ui/ConfirmCards.vue";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { useAvatarUpload } from "../composables/chat/useAvatarUpload";
import { useDesktopNotify } from "../composables/chat/useDesktopNotify";
import { useFriendRequests } from "../composables/chat/useFriendRequests";
import { useFriends } from "../composables/chat/useFriends";
import { useGroups } from "../composables/chat/useGroups";
import { useScrollMessagesToBottom } from "../composables/chat/useScrollMessagesToBottom";
import { useUnreadCounts } from "../composables/chat/useUnreadCounts";
import { useChatMessages } from "../composables/chat/useChatMessages";
import type { UiFriend, UiGroup } from "../types/chat";

const router = useRouter();
const userStore = useUserStore();
const { send, on, connect } = useWebSocket();

const searchQuery = ref("");
const selectedFriend = ref<UiFriend | null>(null);
const selectedGroup = ref<UiGroup | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

let fetchMessagesImpl: (friendId: string) => Promise<void> = async () => {};
let fetchGroupMessagesImpl: (groupId: string) => Promise<void> = async () => {};

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

const { groups, fetchGroups, createGroup } = useGroups(() => userStore.token);

type GroupMemberRow = {
  user: {
    id: string;
    username: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  role: string;
  joinedAt: string;
};

const groupManageOpen = ref(false);
const groupManageLoading = ref(false);
const groupManageError = ref<string | null>(null);
const groupMembers = ref<GroupMemberRow[]>([]);

const addMemberIds = ref<Set<string>>(new Set());
const addMembersSubmitting = ref(false);
const leaveSubmitting = ref(false);

const isGroupOwner = computed(() => {
  const gid = selectedGroup.value;
  const me = currentUser.value;
  return !!gid && !!me && gid.ownerId === me.id;
});

const groupMemberIdSet = computed(() => {
  return new Set(
    (groupMembers.value || [])
      .map((m) => m.user?.id)
      .filter((id): id is string => !!id),
  );
});

const addCandidates = computed(() => {
  const existing = groupMemberIdSet.value;
  return (friends.value || []).filter((f) => !existing.has(f.id));
});

const fetchGroupMembers = async (groupId: string) => {
  const token = userStore.token;
  if (!token) {
    return;
  }
  groupManageLoading.value = true;
  groupManageError.value = null;
  try {
    const data = await apiGet<{ members: GroupMemberRow[] }>(
      `/api/groups/${groupId}/members`,
      token,
    );
    groupMembers.value = data.members || [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    groupManageError.value = msg || "加载群成员失败";
  } finally {
    groupManageLoading.value = false;
  }
};

const openGroupManage = async () => {
  const g = selectedGroup.value;
  if (!g) {
    return;
  }
  groupManageOpen.value = true;
  addMemberIds.value = new Set();
  await fetchGroupMembers(g.id);
};

const closeGroupManage = () => {
  groupManageOpen.value = false;
  groupManageError.value = null;
  groupMembers.value = [];
  addMemberIds.value = new Set();
};

const toggleAddMember = (userId: string) => {
  const next = new Set(addMemberIds.value);
  if (next.has(userId)) {
    next.delete(userId);
  } else {
    next.add(userId);
  }
  addMemberIds.value = next;
};

const addMembers = async () => {
  const g = selectedGroup.value;
  const token = userStore.token;
  if (!g || !token) {
    return;
  }
  const ids = Array.from(addMemberIds.value);
  if (!ids.length) {
    return;
  }
  addMembersSubmitting.value = true;
  groupManageError.value = null;
  try {
    await apiPost(
      `/api/groups/${g.id}/members`,
      {
        memberIds: ids,
      },
      token,
    );
    addMemberIds.value = new Set();
    await fetchGroupMembers(g.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    groupManageError.value = msg || "添加成员失败";
  } finally {
    addMembersSubmitting.value = false;
  }
};

const kickMember = async (memberId: string) => {
  const g = selectedGroup.value;
  const token = userStore.token;
  if (!g || !token) {
    return;
  }
  groupManageError.value = null;
  try {
    await apiDelete(`/api/groups/${g.id}/members/${memberId}`, token);
    await fetchGroupMembers(g.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    groupManageError.value = msg || "踢人失败";
  }
};

const leaveGroup = async () => {
  const g = selectedGroup.value;
  const token = userStore.token;
  if (!g || !token) {
    return;
  }
  leaveSubmitting.value = true;
  groupManageError.value = null;
  try {
    await apiPost(`/api/groups/${g.id}/leave`, undefined, token);
    closeGroupManage();
    selectedGroup.value = null;
    messages.value = [];
    await fetchGroups();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    groupManageError.value = msg || "退群失败";
  } finally {
    leaveSubmitting.value = false;
  }
};

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

fetchMessagesImpl = fetchMessages;
fetchGroupMessagesImpl = fetchGroupMessages;

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

type ConfirmAction = "logout" | "deleteFriend" | "deleteAccount";

const confirmOpen = ref(false);
const confirmTitle = ref("");
const confirmMessage = ref("");
const confirmConfirmText = ref("确认");
const confirmCancelText = ref("取消");
const confirmConfirmColor = ref<"red" | "blue" | "green">("green");
const confirmCancelColor = ref<"red" | "blue" | "green">("blue");

let pendingConfirmAction: ConfirmAction | null = null;
let pendingFriendToDelete: UiFriend | null = null;

const openConfirm = (payload: {
  action: ConfirmAction;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmColor: "red" | "blue" | "green";
  cancelColor: "red" | "blue" | "green";
}) => {
  pendingConfirmAction = payload.action;
  confirmTitle.value = payload.title;
  confirmMessage.value = payload.message;
  confirmConfirmText.value = payload.confirmText;
  confirmCancelText.value = payload.cancelText;
  confirmConfirmColor.value = payload.confirmColor;
  confirmCancelColor.value = payload.cancelColor;
  confirmOpen.value = true;
};

const closeConfirm = () => {
  confirmOpen.value = false;
  pendingConfirmAction = null;
  pendingFriendToDelete = null;
};

const handleConfirmCancel = () => {
  closeConfirm();
};

const confirmDeleteFriend = async (friend: UiFriend) => {
  const token = userStore.token;
  if (!token) {
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

const handleConfirmOk = async () => {
  const action = pendingConfirmAction;
  const friend = pendingFriendToDelete;
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

const handleDeleteFriend = async (friend: UiFriend) => {
  const token = userStore.token;
  if (!token) {
    return;
  }

  const name = friend.nickname || friend.username;
  pendingFriendToDelete = friend;
  openConfirm({
    action: "deleteFriend",
    title: "删除好友",
    message: `确定删除好友「${name}」吗？`,
    confirmText: "确定删除",
    cancelText: "取消",
    confirmColor: "red",
    cancelColor: "blue",
  });
};

// 退出登录
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
  if (!token) {
    return;
  }

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
  void fetchGroups().catch((e) => console.error(e));

  on(
    WebSocketEvent.GROUP_MEMBERSHIP_CHANGED,
    (data: { action?: string; groupId?: string } | undefined) => {
      const groupId = data?.groupId ? String(data.groupId) : "";
      if (!groupId) {
        return;
      }

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

.group-manage-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 999;
}

.group-manage-card {
  width: min(680px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.group-manage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.group-manage-title {
  font-size: 18px;
  font-weight: 800;
  color: #111;
}

.group-manage-close {
  background: transparent;
  position: relative;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid #111;
  border-radius: 12px;
  outline: none;
  overflow: hidden;
  color: #111;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.group-manage-close:hover {
  color: #fff;
}

.group-manage-close::before {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  content: "";
  border-radius: 50%;
  display: block;
  width: 20em;
  height: 20em;
  left: -5em;
  text-align: center;
  transition: box-shadow 0.5s ease-out;
  z-index: -1;
}

.group-manage-close:hover::before {
  box-shadow: inset 0 0 0 10em #111;
}

.group-manage-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-manage-section-title {
  font-size: 13px;
  font-weight: 800;
  color: #666;
  margin-bottom: 10px;
}

.group-manage-error {
  color: #ff1744;
  font-size: 12px;
  margin-bottom: 10px;
}

.group-manage-loading {
  font-size: 12px;
  color: #666;
}

.group-members {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
}

.group-member-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.group-member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #0001f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.group-member-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-member-avatar-text {
  color: #fff;
  font-weight: 800;
  font-size: 14px;
}

.group-member-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.group-member-name {
  font-weight: 800;
  font-size: 14px;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-member-role {
  font-size: 12px;
  color: #666;
}

.group-member-kick {
  background: transparent;
  position: relative;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid #ff1744;
  border-radius: 12px;
  outline: none;
  overflow: hidden;
  color: #ff1744;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.group-member-kick:hover {
  color: #fff;
}

.group-member-kick::before {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  content: "";
  border-radius: 50%;
  display: block;
  width: 20em;
  height: 20em;
  left: -5em;
  text-align: center;
  transition: box-shadow 0.5s ease-out;
  z-index: -1;
}

.group-member-kick:hover::before {
  box-shadow: inset 0 0 0 10em #ff1744;
}

.group-add-list {
  max-height: 220px;
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-add-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.group-add-checkbox {
  flex-shrink: 0;
}

.ui-checkbox {
  --primary-color: #0001f0;
  --secondary-color: #fff;
  --primary-hover-color: #4096ff;
  --checkbox-diameter: 20px;
  --checkbox-border-radius: 5px;
  --checkbox-border-color: #d9d9d9;
  --checkbox-border-width: 1px;
  --checkbox-border-style: solid;
  --checkmark-size: 1.2;
}

.ui-checkbox,
.ui-checkbox *,
.ui-checkbox *::before,
.ui-checkbox *::after {
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}

.ui-checkbox {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: var(--checkbox-diameter);
  height: var(--checkbox-diameter);
  border-radius: var(--checkbox-border-radius);
  background: var(--secondary-color);
  border: var(--checkbox-border-width) var(--checkbox-border-style)
    var(--checkbox-border-color);
  -webkit-transition: all 0.3s;
  -o-transition: all 0.3s;
  transition: all 0.3s;
  cursor: pointer;
  position: relative;
}

.ui-checkbox::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  -webkit-box-shadow: 0 0 0 calc(var(--checkbox-diameter) / 2.5)
    var(--primary-color);
  box-shadow: 0 0 0 calc(var(--checkbox-diameter) / 2.5) var(--primary-color);
  border-radius: inherit;
  opacity: 0;
  -webkit-transition: all 0.5s cubic-bezier(0.12, 0.4, 0.29, 1.46);
  -o-transition: all 0.5s cubic-bezier(0.12, 0.4, 0.29, 1.46);
  transition: all 0.5s cubic-bezier(0.12, 0.4, 0.29, 1.46);
}

.ui-checkbox::before {
  top: 40%;
  left: 50%;
  content: "";
  position: absolute;
  width: 4px;
  height: 7px;
  border-right: 2px solid var(--secondary-color);
  border-bottom: 2px solid var(--secondary-color);
  -webkit-transform: translate(-50%, -50%) rotate(45deg) scale(0);
  -ms-transform: translate(-50%, -50%) rotate(45deg) scale(0);
  transform: translate(-50%, -50%) rotate(45deg) scale(0);
  opacity: 0;
  -webkit-transition:
    all 0.1s cubic-bezier(0.71, -0.46, 0.88, 0.6),
    opacity 0.1s;
  -o-transition:
    all 0.1s cubic-bezier(0.71, -0.46, 0.88, 0.6),
    opacity 0.1s;
  transition:
    all 0.1s cubic-bezier(0.71, -0.46, 0.88, 0.6),
    opacity 0.1s;
}

.ui-checkbox:hover {
  border-color: var(--primary-color);
}

.ui-checkbox:checked {
  background: var(--primary-color);
  border-color: transparent;
}

.ui-checkbox:checked::before {
  opacity: 1;
  -webkit-transform: translate(-50%, -50%) rotate(45deg)
    scale(var(--checkmark-size));
  -ms-transform: translate(-50%, -50%) rotate(45deg)
    scale(var(--checkmark-size));
  transform: translate(-50%, -50%) rotate(45deg) scale(var(--checkmark-size));
  -webkit-transition: all 0.2s cubic-bezier(0.12, 0.4, 0.29, 1.46) 0.1s;
  -o-transition: all 0.2s cubic-bezier(0.12, 0.4, 0.29, 1.46) 0.1s;
  transition: all 0.2s cubic-bezier(0.12, 0.4, 0.29, 1.46) 0.1s;
}

.ui-checkbox:active:not(:checked)::after {
  -webkit-transition: none;
  -o-transition: none;
  -webkit-box-shadow: none;
  box-shadow: none;
  transition: none;
  opacity: 1;
}

.group-add-text {
  font-size: 14px;
  color: #111;
  font-weight: 700;
}

.group-add-confirm {
  margin-top: 10px;
  background: transparent;
  position: relative;
  color: #0001f0;
  border: 1px solid #0001f0;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  outline: none;
  overflow: hidden;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.group-add-confirm:hover {
  color: #fff;
}

.group-add-confirm::before {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  content: "";
  border-radius: 50%;
  display: block;
  width: 20em;
  height: 20em;
  left: -5em;
  text-align: center;
  transition: box-shadow 0.5s ease-out;
  z-index: -1;
}

.group-add-confirm:hover::before {
  box-shadow: inset 0 0 0 10em #0001f0;
}

.group-add-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.group-add-confirm:disabled:hover {
  color: #0001f0;
}

.group-add-confirm:disabled:hover::before {
  box-shadow: none;
}

.group-leave {
  background: transparent;
  position: relative;
  border: 1px solid #ff1744;
  color: #ff1744;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  outline: none;
  overflow: hidden;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.group-leave:hover {
  color: #fff;
}

.group-leave::before {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  content: "";
  border-radius: 50%;
  display: block;
  width: 20em;
  height: 20em;
  left: -5em;
  text-align: center;
  transition: box-shadow 0.5s ease-out;
  z-index: -1;
}

.group-leave:hover::before {
  box-shadow: inset 0 0 0 10em #ff1744;
}

.group-leave:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.group-leave:disabled:hover {
  color: #ff1744;
}

.group-leave:disabled:hover::before {
  box-shadow: none;
}
</style>
