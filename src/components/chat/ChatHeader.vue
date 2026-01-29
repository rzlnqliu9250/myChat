<template>
  <header class="chat-header">
    <div class="chat-header-info">
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
    </div>
  </header>
</template>

<script setup lang="ts">
import type { UiFriend } from "../../types/chat";

defineProps<{ friend: UiFriend }>();
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
