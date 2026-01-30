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
      <button class="logout-button" @click="emit('logout')">
        <span>退出登录</span>
      </button>
    </div>

    <!-- 搜索框 -->
    <div class="search-box">
      <div class="form-control search-control">
        <input
          type="text"
          placeholder="输入好友账号或昵称"
          :value="searchQuery"
          class="search-input"
          @input="onSearchInput"
        />
        <label>
          <span
            v-for="(ch, i) in searchLabel"
            :key="`${ch}-${i}`"
            :style="{ transitionDelay: `${i * 50}ms` }"
            >{{ ch }}</span
          >
        </label>
      </div>
    </div>

    <div class="friend-actions">
      <div class="friend-request-form">
        <div class="form-control friend-request-control">
          <input
            :value="friendRequestUsername"
            class="friend-request-input"
            placeholder="输入对方账号"
            type="text"
            required
            @input="onFriendRequestUsernameInput"
          />
          <label>
            <span
              v-for="(ch, i) in friendRequestLabel"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
              >{{ ch }}</span
            >
          </label>
        </div>
        <button
          class="friend-request-button"
          :disabled="friendRequestLoading || !friendRequestUsername"
          @click="emit('sendFriendRequest')"
        >
          <div class="svg-wrapper-1">
            <div class="svg-wrapper">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
                <path fill="none" d="M0 0h24v24H0z"></path>
                <path
                  fill="currentColor"
                  d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z"
                ></path>
              </svg>
            </div>
          </div>
          <span>发送</span>
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
          <span>删除</span>
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

const searchLabel = "搜索好友".split("");
const friendRequestLabel = "添加好友".split("");

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
  background: transparent;
  position: relative;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid rgb(239, 148, 158);
  border-radius: 25px;
  outline: none;
  overflow: hidden;
  color: rgb(239, 148, 158);
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.logout-button span {
  margin: 0;
}

.logout-button::before {
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

.logout-button:hover {
  color: #fff;
  border: 1px solid #ff1744;
}

.logout-button:hover::before {
  box-shadow: inset 0 0 0 10em #ff1744;
}

.search-box {
  padding: 12px 15px;
}

.search-input {
  background-color: transparent;
  border: 0;
  border-bottom: 2px #f5f5f5 solid;
  display: block;
  width: 100%;
  padding: 13px 0 7px;
  font-size: 14px;
  color: #222;
  outline: none;
  box-shadow: none;
}

.search-input::placeholder {
  color: #9aa0a6;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.search-input:focus::placeholder {
  opacity: 1;
  transition-delay: 0.4s;
}

.form-control.search-control {
  position: relative;
  width: 100%;
  margin: 0;
}

.form-control.search-control .search-input:focus,
.form-control.search-control .search-input:not(:placeholder-shown) {
  border-bottom-color: #111;
}

.form-control.search-control label {
  position: absolute;
  top: 10px;
  left: 0;
  pointer-events: none;
}

.form-control.search-control label span {
  display: inline-block;
  font-size: 14px;
  min-width: 5px;
  color: #666;
  transition: 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.form-control.search-control .search-input:focus + label span,
.form-control.search-control
  .search-input:not(:placeholder-shown)
  + label
  span {
  color: #111;
  transform: translateY(-30px);
}

.friend-actions {
  padding: 12px 15px;
  border-bottom: none;
}

.friend-request-form {
  display: flex;
  gap: 8px;
}

.form-control.friend-request-control {
  position: relative;
  flex: 1;
  margin: 0;
  min-width: 0;
}

.friend-request-input {
  background-color: transparent;
  border: 0;
  border-bottom: 2px #f5f5f5 solid;
  display: block;
  width: 100%;
  padding: 13px 0 7px;
  font-size: 14px;
  color: #222;
}

.friend-request-input::placeholder {
  color: #9aa0a6;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.friend-request-input:focus::placeholder {
  opacity: 1;
  transition-delay: 0.4s;
}

.form-control.friend-request-control .friend-request-input:focus,
.form-control.friend-request-control .friend-request-input:valid {
  outline: 0;
  border-bottom-color: #111;
}

.form-control.friend-request-control label {
  position: absolute;
  top: 10px;
  left: 0;
  pointer-events: none;
}

.form-control.friend-request-control label span {
  display: inline-block;
  font-size: 14px;
  min-width: 5px;
  color: #666;
  transition: 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.form-control.friend-request-control .friend-request-input:focus + label span,
.form-control.friend-request-control .friend-request-input:valid + label span {
  color: #111;
  transform: translateY(-30px);
}

.friend-request-button {
  font-family: inherit;
  font-size: 13px;
  background: #0001f0;
  color: white;
  padding: 0.45em 0.75em;
  padding-left: 0.7em;
  display: flex;
  align-items: center;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
}

.friend-request-button span {
  display: block;
  margin-left: 0.3em;
  transition: all 0.3s ease-in-out;
}

.friend-request-button svg {
  display: block;
  transform-origin: center center;
  transition: transform 0.3s ease-in-out;
}

.friend-request-button:hover:not(:disabled) .svg-wrapper {
  animation: fly-1 0.6s ease-in-out infinite alternate;
}

.friend-request-button:hover:not(:disabled) svg {
  transform: translateX(0.95em) rotate(45deg) scale(1.08);
}

.friend-request-button:hover:not(:disabled) span {
  transform: translateX(3.4em);
}

.friend-request-button:active {
  transform: scale(0.95);
}

.friend-request-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
}

@keyframes fly-1 {
  from {
    transform: translateY(0.1em);
  }

  to {
    transform: translateY(-0.1em);
  }
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
  background: transparent;
  position: relative;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid rgb(239, 148, 158);
  border-radius: 25px;
  outline: none;
  overflow: hidden;
  color: rgb(239, 148, 158);
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.friend-delete-button span {
  margin: 0;
}

.friend-delete-button::before {
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

.friend-delete-button:hover {
  color: #fff;
  border: 1px solid #ff1744;
}

.friend-delete-button:hover::before {
  box-shadow: inset 0 0 0 10em #ff1744;
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
