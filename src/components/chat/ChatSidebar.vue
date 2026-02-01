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
        <div class="avatar-tooltip-container">
          <div class="user-avatar" @click="triggerAvatarPick">
            <img
              v-if="currentUser?.avatar"
              class="avatar-image"
              :src="currentUser.avatar"
              alt="avatar"
            />
            <span v-else>
              {{
                (currentUser?.nickname || currentUser?.username || "U").charAt(
                  0,
                )
              }}
            </span>
          </div>
          <div class="avatar-tooltip-bubble" role="tooltip">
            <p class="avatar-tooltip-text">更换头像</p>
          </div>
        </div>
        <div class="user-details">
          <div class="nickname-tooltip-container">
            <h3 class="user-name" @click="openEditNickname">
              {{ currentUser?.nickname || currentUser?.username || "未登录" }}
            </h3>
            <div class="nickname-tooltip-bubble" role="tooltip">
              <p class="avatar-tooltip-text">更换昵称</p>
            </div>
          </div>
          <span class="user-account">{{ currentUser?.username || "" }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="logout-button" @click="emit('logout')">
          <span>退出登录</span>
        </button>
        <button class="delete-account-button" @click="emit('deleteAccount')">
          <span>注销账号</span>
        </button>
      </div>
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

    <div class="list-tabs">
      <input
        id="chat-tab-friends"
        class="list-tab-input"
        type="radio"
        name="chat-list-tab"
        value="friends"
        v-model="activeListTab"
      />
      <label class="list-tab-label" for="chat-tab-friends">好友</label>

      <input
        id="chat-tab-groups"
        class="list-tab-input"
        type="radio"
        name="chat-list-tab"
        value="groups"
        v-model="activeListTab"
      />
      <label class="list-tab-label" for="chat-tab-groups">群聊</label>

      <div class="list-tab-glider"></div>
    </div>

    <div v-if="activeListTab === 'friends'" class="friend-list">
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

    <div v-else class="group-list">
      <div class="group-list-header">
        <h4 class="group-list-title">群聊列表</h4>
        <button class="group-create-button" @click="openCreateGroup">
          创建群聊
        </button>
      </div>
      <div
        v-for="group in groups"
        :key="group.id"
        class="group-item"
        :class="{ active: selectedGroupId === group.id }"
        @click="emit('selectGroup', group)"
      >
        <div class="group-avatar">
          <img
            v-if="group.avatarUrl"
            class="avatar-image"
            :src="group.avatarUrl"
            alt="avatar"
          />
          <span v-else>{{ group.name.charAt(0) }}</span>
        </div>
        <div class="group-info">
          <div class="group-name">{{ group.name }}</div>
        </div>
      </div>
    </div>

    <div
      v-if="createGroupOpen"
      class="create-group-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div class="create-group-card">
        <div class="create-group-title">创建群聊</div>

        <div class="create-group-field">
          <label class="create-group-label">群名称</label>
          <input
            v-model="createGroupName"
            class="create-group-input"
            type="text"
            placeholder="输入群名称"
          />
        </div>

        <div class="create-group-field">
          <label class="create-group-label">选择好友</label>
          <div class="create-group-members">
            <label
              v-for="f in allFriends"
              :key="f.id"
              class="create-group-member"
            >
              <input
                class="create-group-checkbox ui-checkbox"
                type="checkbox"
                :value="f.id"
                :checked="selectedMemberIds.has(f.id)"
                @change="toggleMember(f.id)"
              />
              <span class="create-group-member-text">
                {{ f.nickname || f.username }}
              </span>
            </label>
          </div>
        </div>

        <div v-if="createGroupError" class="create-group-error">
          {{ createGroupError }}
        </div>

        <div class="create-group-actions">
          <button class="create-group-cancel" @click="closeCreateGroup">
            取消
          </button>
          <button
            class="create-group-confirm"
            :disabled="createGroupSubmitting"
            @click="submitCreateGroup"
          >
            {{ createGroupSubmitting ? "创建中..." : "创建" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="editNicknameOpen"
      class="edit-nickname-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div class="edit-nickname-card">
        <div class="edit-nickname-title">更换昵称</div>

        <div class="edit-nickname-field">
          <label class="edit-nickname-label">昵称</label>
          <input
            v-model="editNicknameValue"
            class="edit-nickname-input"
            type="text"
            placeholder="输入新的昵称"
          />
        </div>

        <div v-if="editNicknameError" class="edit-nickname-error">
          {{ editNicknameError }}
        </div>

        <div class="edit-nickname-actions">
          <button class="edit-nickname-cancel" @click="closeEditNickname">
            取消
          </button>
          <button
            class="edit-nickname-confirm"
            :disabled="editNicknameSubmitting"
            @click="submitEditNickname"
          >
            {{ editNicknameSubmitting ? "保存中..." : "保存" }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { IncomingRequest, UiFriend, UiGroup } from "../../types/chat";

type AnyUser = {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  status?: string;
};

const props = defineProps<{
  currentUser: AnyUser | null;
  searchQuery: string;
  friendRequestUsername: string;
  friendRequestLoading: boolean;
  friendRequestError: string | null;
  friendRequestSuccess: string | null;
  incomingRequests: IncomingRequest[];
  requestActionLoadingIds: Set<string>;
  friends: UiFriend[];
  allFriends: UiFriend[];
  selectedFriendId: string | null;
  groups: UiGroup[];
  selectedGroupId: string | null;
  unreadCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "update:friendRequestUsername", value: string): void;
  (e: "logout"): void;
  (e: "deleteAccount"): void;
  (e: "sendFriendRequest"): void;
  (e: "acceptRequest", requestId: string): void;
  (e: "rejectRequest", requestId: string): void;
  (e: "selectFriend", friend: UiFriend): void;
  (e: "selectGroup", group: UiGroup): void;
  (
    e: "createGroup",
    payload: { name: string; memberIds: string[] },
    callbacks: { onSuccess: () => void; onError: (msg: string) => void },
  ): void;
  (
    e: "updateNickname",
    payload: { nickname: string },
    callbacks: { onSuccess: () => void; onError: (msg: string) => void },
  ): void;
  (e: "deleteFriend", friend: UiFriend): void;
  (e: "avatarSelected", file: File): void;
}>();

const avatarInput = ref<HTMLInputElement | null>(null);

const activeListTab = ref<"friends" | "groups">("friends");

const createGroupOpen = ref(false);
const createGroupName = ref("");
const selectedMemberIds = ref<Set<string>>(new Set());
const createGroupSubmitting = ref(false);
const createGroupError = ref<string | null>(null);

const editNicknameOpen = ref(false);
const editNicknameValue = ref("");
const editNicknameSubmitting = ref(false);
const editNicknameError = ref<string | null>(null);

const searchLabel = "搜索好友".split("");
const friendRequestLabel = "添加好友".split("");

const triggerAvatarPick = () => {
  avatarInput.value?.click();
};

const openCreateGroup = () => {
  createGroupName.value = "";
  selectedMemberIds.value = new Set();
  createGroupSubmitting.value = false;
  createGroupError.value = null;
  createGroupOpen.value = true;
};

const closeCreateGroup = () => {
  createGroupOpen.value = false;
};

const openEditNickname = () => {
  editNicknameValue.value = (
    props.currentUser?.nickname ||
    props.currentUser?.username ||
    ""
  ).trim();
  editNicknameSubmitting.value = false;
  editNicknameError.value = null;
  editNicknameOpen.value = true;
};

const closeEditNickname = () => {
  editNicknameOpen.value = false;
  editNicknameSubmitting.value = false;
  editNicknameError.value = null;
};

const submitEditNickname = async () => {
  const nickname = editNicknameValue.value.trim();
  if (!nickname) {
    editNicknameError.value = "请输入昵称";
    return;
  }

  editNicknameSubmitting.value = true;
  editNicknameError.value = null;

  emit(
    "updateNickname",
    { nickname },
    {
      onSuccess: () => {
        editNicknameSubmitting.value = false;
        closeEditNickname();
      },
      onError: (msg) => {
        editNicknameSubmitting.value = false;
        editNicknameError.value = msg || "更换昵称失败";
      },
    },
  );
};

const toggleMember = (userId: string) => {
  const next = new Set(selectedMemberIds.value);
  if (next.has(userId)) {
    next.delete(userId);
  } else {
    next.add(userId);
  }
  selectedMemberIds.value = next;
};

const submitCreateGroup = async () => {
  const name = createGroupName.value.trim();
  const memberIds = Array.from(selectedMemberIds.value);

  if (!name) {
    createGroupError.value = "请输入群名称";
    return;
  }

  if (!memberIds.length) {
    createGroupError.value = "请选择至少一个好友";
    return;
  }

  createGroupSubmitting.value = true;
  createGroupError.value = null;

  emit(
    "createGroup",
    { name, memberIds },
    {
      onSuccess: () => {
        createGroupSubmitting.value = false;
        closeCreateGroup();
      },
      onError: (msg: string) => {
        createGroupSubmitting.value = false;
        createGroupError.value = msg || "创建失败";
      },
    },
  );
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-direction: column;
  justify-content: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-tooltip-container {
  position: relative;
  flex-shrink: 0;
  flex-grow: 0;
}

.avatar-tooltip-bubble {
  position: absolute;
  left: 0;
  top: 0;
  width: auto;
  min-width: 90px;
  transform: translateY(0);
  border-radius: 8px;
  background: #9aa0a6;
  padding: 10px 12px;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.avatar-tooltip-bubble::before {
  content: "";
  position: absolute;
  left: 16px;
  top: -6px;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  background: #9aa0a6;
}

.avatar-tooltip-text {
  margin: 0;
  padding: 0;
  text-align: center;
  color: #fff;
}

.avatar-tooltip-container:hover .avatar-tooltip-bubble {
  opacity: 1;
  transform: translateY(55px);
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
  min-width: 0;
}

.user-name {
  margin: 0;
  line-height: 1.2;
  cursor: pointer;
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nickname-tooltip-container {
  position: relative;
  width: fit-content;
  max-width: 160px;
}

.nickname-tooltip-bubble {
  position: absolute;
  left: 0;
  top: 0;
  width: auto;
  min-width: 90px;
  transform: translateY(0);
  border-radius: 8px;
  background: #9aa0a6;
  padding: 10px 12px;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.nickname-tooltip-bubble::before {
  content: "";
  position: absolute;
  left: 16px;
  top: -6px;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  background: #9aa0a6;
}

.nickname-tooltip-container:hover .nickname-tooltip-bubble {
  opacity: 1;
  transform: translateY(40px);
}

.user-account {
  font-size: 12px;
  color: #666;
  line-height: 1.2;
  margin-top: 2px;
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.delete-account-button {
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

.delete-account-button span {
  margin: 0;
}

.delete-account-button::before {
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

.delete-account-button:hover {
  color: #fff;
  border: 1px solid #ff1744;
}

.delete-account-button:hover::before {
  box-shadow: inset 0 0 0 10em #ff1744;
}

.edit-nickname-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 999;
}

.edit-nickname-card {
  width: min(520px, 92vw);
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.edit-nickname-title {
  font-size: 18px;
  font-weight: 800;
  color: #111;
  margin-bottom: 14px;
}

.edit-nickname-field {
  margin-bottom: 12px;
}

.edit-nickname-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 6px;
}

.edit-nickname-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;
}

.edit-nickname-input:focus {
  border-color: #0001f0;
}

.edit-nickname-error {
  font-size: 12px;
  color: #d32f2f;
  margin-top: 6px;
}

.edit-nickname-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
}

.edit-nickname-cancel {
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
}

.edit-nickname-confirm {
  background: #0001f0;
  color: #fff;
  border: 0;
  border-radius: 12px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 800;
}

.edit-nickname-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.list-tabs {
  display: flex;
  position: relative;
  width: fit-content;
  margin: 12px 15px 0;
  padding: 0;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 999px;
  overflow: hidden;
}

.list-tab-input {
  display: none;
}

.list-tab-label {
  min-width: 88px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  color: #111;
  cursor: pointer;
  position: relative;
  z-index: 2;
  transition: color 0.25s ease;
  user-select: none;
}

.list-tab-label:hover {
  color: #000;
}

.list-tab-input:checked + .list-tab-label {
  color: #fff;
}

.list-tab-glider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50%;
  background: #0001f0;
  border-radius: 999px;
  z-index: 1;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

#chat-tab-friends:checked ~ .list-tab-glider {
  transform: translateX(0%);
}

#chat-tab-groups:checked ~ .list-tab-glider {
  transform: translateX(100%);
}

.friend-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.group-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 15px;
}

.group-list-title {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-create-button {
  background: transparent;
  position: relative;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid #0001f0;
  border-radius: 10px;
  outline: none;
  overflow: hidden;
  color: #0001f0;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.group-create-button:hover {
  color: #fff;
  border: 1px solid #0001f0;
}

.group-create-button::before {
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

.group-create-button:hover::before {
  box-shadow: inset 0 0 0 10em #0001f0;
}

.create-group-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 999;
}

.create-group-card {
  width: min(520px, 92vw);
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.create-group-title {
  font-size: 18px;
  font-weight: 700;
  color: #111;
  margin-bottom: 14px;
}

.create-group-field {
  margin-bottom: 12px;
}

.create-group-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 6px;
}

.create-group-input {
  width: 95%;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;
}

.create-group-input:focus {
  border-color: #0001f0;
}

.create-group-members {
  max-height: 220px;
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.create-group-member {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.create-group-checkbox {
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

.create-group-member-text {
  font-size: 14px;
  color: #111;
}

.create-group-error {
  margin-top: 6px;
  font-size: 12px;
  color: #ff1744;
}

.create-group-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.create-group-cancel,
.create-group-confirm {
  background: transparent;
  position: relative;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  overflow: hidden;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.create-group-cancel {
  border: 1px solid #111;
  color: #111;
}

.create-group-cancel:hover {
  color: #fff;
  border: 1px solid #111;
}

.create-group-confirm {
  border: 1px solid #0001f0;
  color: #0001f0;
}

.create-group-confirm:hover {
  color: #fff;
  border: 1px solid #0001f0;
}

.create-group-cancel::before,
.create-group-confirm::before {
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

.create-group-cancel:hover::before {
  box-shadow: inset 0 0 0 10em #111;
}

.create-group-confirm:hover::before {
  box-shadow: inset 0 0 0 10em #0001f0;
}

.create-group-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.create-group-confirm:disabled:hover {
  color: #0001f0;
}

.create-group-confirm:disabled:hover::before {
  box-shadow: none;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 8px;
}

.group-item:hover {
  background-color: #f0f0f0;
}

.group-item.active {
  background-color: #e8eaf6;
}

.group-avatar {
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

.group-info {
  flex: 1;
  min-width: 0;
}

.group-name {
  font-weight: 600;
  font-size: 16px;
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
