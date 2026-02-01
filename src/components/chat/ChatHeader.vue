<template>
  <header class="chat-header">
    <div class="chat-header-info">
      <template v-if="friend">
        <div class="friend-avatar">
          <img
            v-if="friend.avatarUrl"
            class="avatar-image"
            :src="friend.avatarUrl"
            alt="avatar"
          />
          <span v-else>
            {{ (friend.nickname || friend.username).charAt(0) }}
          </span>
        </div>
        <div>
          <h3 class="friend-name">{{ friend.nickname || friend.username }}</h3>
          <span class="friend-status">
            <span class="status-indicator" :class="friend.status"></span>
            {{ friend.status }}
          </span>
        </div>
      </template>

      <template v-else-if="group">
        <div class="friend-avatar">
          <img
            v-if="group.avatarUrl"
            class="avatar-image"
            :src="group.avatarUrl"
            alt="avatar"
          />
          <span v-else>
            {{ group.name.charAt(0) }}
          </span>
        </div>
        <div>
          <h3 class="friend-name">{{ group.name }}</h3>
          <span class="friend-status">群聊</span>
        </div>
      </template>
    </div>

    <button
      v-if="group"
      class="group-manage-button"
      @click="emit('openGroupManage')"
    >
      群管理
    </button>
  </header>
</template>

<script setup lang="ts">
import type { UiFriend, UiGroup } from "../../types/chat";

const emit = defineEmits<{
  (e: "openGroupManage"): void;
}>();

defineProps<{ friend: UiFriend | null; group: UiGroup | null }>();
</script>

<style scoped>
.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 2;
  background-color: white;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

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

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.friend-name {
  font-weight: 600;
  font-size: 16px;
}

.friend-status {
  font-size: 12px;
  color: #666;
}

.group-manage-button {
  background: transparent;
  position: relative;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid #0001f0;
  border-radius: 12px;
  outline: none;
  overflow: hidden;
  color: #0001f0;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
}

.group-manage-button:hover {
  color: #fff;
}

.group-manage-button::before {
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

.group-manage-button:hover::before {
  box-shadow: inset 0 0 0 10em #0001f0;
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
