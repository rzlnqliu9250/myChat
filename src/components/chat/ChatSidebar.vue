<template>
  <!-- 侧边栏：好友列表 -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="user-info">
        <input
          ref="avatarInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleAvatarFileChange"
        />
        <div class="user-avatar" @click="triggerAvatarPick">
          <img
            v-if="currentUser?.avatar"
            class="avatar-image"
            :src="currentUser.avatar"
            alt="avatar"
          />
          <span v-else>
            {{
              (currentUser?.nickname || currentUser?.username || "U").charAt(0)
            }}
          </span>
        </div>
        <div class="user-details">
          <h3 class="user-name">
            {{ currentUser?.nickname || currentUser?.username || "未登录" }}
          </h3>
          <span class="user-status">{{
            currentUser?.status || "offline"
          }}</span>
        </div>
      </div>
      <button class="logout-button" @click="emit('logout')">退出登录</button>
    </div>

    <!-- 搜索框 -->
    <div class="search-box">
      <input
        type="text"
        placeholder="搜索好友..."
        :value="searchQuery"
        class="search-input"
        @input="onSearchInput"
      />
    </div>

    <div class="friend-actions">
      <div class="friend-actions-title">添加好友</div>
      <div class="friend-request-form">
        <input
          :value="friendRequestUsername"
          class="friend-request-input"
          placeholder="输入对方用户名"
          type="text"
          @input="onFriendRequestUsernameInput"
        />
        <button
          class="friend-request-button"
          :disabled="friendRequestLoading || !friendRequestUsername"
          @click="emit('sendFriendRequest')"
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
            @click="emit('acceptRequest', req.id)"
          >
            同意
          </button>
          <button
            class="friend-request-action reject"
            :disabled="requestActionLoadingIds.has(req.id)"
            @click="emit('rejectRequest', req.id)"
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
        v-for="friend in friends"
        :key="friend.id"
        class="friend-item"
        :class="{ active: selectedFriendId === friend.id }"
        @click="emit('selectFriend', friend)"
      >
        <div class="friend-avatar">
          <img
            v-if="friend.avatarUrl"
            class="avatar-image"
            :src="friend.avatarUrl"
            alt="avatar"
          />
          <span v-else>{{
            (friend.nickname || friend.username).charAt(0)
          }}</span>
        </div>
        <div class="friend-info">
          <div class="friend-name">
            {{ friend.nickname || friend.username }}
            <span v-if="unreadCounts[friend.id]" class="unread-dot"></span>
          </div>
          <div class="friend-status">
            <span class="status-indicator" :class="friend.status"></span>
            {{ friend.status }}
          </div>
        </div>
        <button
          class="friend-delete-button"
          @click.stop="emit('deleteFriend', friend)"
        >
          删除
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { IncomingRequest, UiFriend } from "../../types/chat";

type AnyUser = {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  status?: string;
};

defineProps<{
  currentUser: AnyUser | null;
  searchQuery: string;
  friendRequestUsername: string;
  friendRequestLoading: boolean;
  friendRequestError: string | null;
  friendRequestSuccess: string | null;
  incomingRequests: IncomingRequest[];
  requestActionLoadingIds: Set<string>;
  friends: UiFriend[];
  selectedFriendId: string | null;
  unreadCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "update:friendRequestUsername", value: string): void;
  (e: "logout"): void;
  (e: "sendFriendRequest"): void;
  (e: "acceptRequest", requestId: string): void;
  (e: "rejectRequest", requestId: string): void;
  (e: "selectFriend", friend: UiFriend): void;
  (e: "deleteFriend", friend: UiFriend): void;
  (e: "avatarSelected", file: File): void;
}>();

const avatarInput = ref<HTMLInputElement | null>(null);

const triggerAvatarPick = () => {
  avatarInput.value?.click();
};

const handleAvatarFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  emit("avatarSelected", file);

  try {
    if (input) {
      input.value = "";
    }
  } catch {
    // ignore
  }
};

const onSearchInput = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  emit("update:searchQuery", input?.value || "");
};

const onFriendRequestUsernameInput = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  emit("update:friendRequestUsername", input?.value || "");
};
</script>

<style scoped>
/* 侧边栏样式 */
.sidebar {
  width: 300px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: none;
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
  background-color: #0001f0;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 16px;
}

.user-avatar {
  cursor: pointer;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
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
  background-color: rgb(239, 148, 158);
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

.search-box {
  padding: 15px;
}

.search-input {
  width: 90%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.search-input:focus {
  border-color: #0001f0;
}

.friend-actions {
  padding: 12px 15px;
  border-bottom: none;
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
  background-color: #0001f0;
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

.friend-delete-button {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background-color: rgb(239, 148, 158);
  color: white;
  cursor: pointer;
  font-size: 12px;
}

.friend-delete-button:hover {
  background-color: #ff1744;
}

.friend-item:hover {
  background-color: #f0f0f0;
}

.friend-item.active {
  background-color: #e8eaf6;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff1744;
  display: inline-block;
  margin-left: 8px;
  animation: unreadPulse 1.4s ease-in-out infinite;
}

@keyframes unreadPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  60% {
    transform: scale(1.35);
    opacity: 0.65;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .unread-dot {
    animation: none;
  }
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
</style>
