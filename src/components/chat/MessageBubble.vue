<template>
  <div
    class="message-bubble"
    :class="{
      sent: message.senderId === currentUserId,
      received: message.senderId !== currentUserId,
      'group-received': message.groupId && message.senderId !== currentUserId,
    }"
  >
    <template v-if="message.groupId && message.senderId !== currentUserId">
      <div class="group-sender-avatar">
        <img
          v-if="message.senderAvatarUrl"
          class="group-sender-avatar-image"
          :src="message.senderAvatarUrl"
          alt="avatar"
        />
        <span v-else class="group-sender-avatar-text">
          {{ (message.senderNickname || "?").charAt(0) }}
        </span>
      </div>

      <div class="group-received-body">
        <div class="group-sender-name">{{ message.senderNickname }}</div>

        <div
          class="message-content"
          :class="{
            'has-media': message.type === 'image' || message.type === 'video',
          }"
        >
          <img
            v-if="message.type === 'image' && message.mediaUrl"
            class="message-media message-image"
            :src="message.mediaUrl"
            alt="image"
            @click="openImagePreview(message.mediaUrl)"
          />
          <video
            v-else-if="message.type === 'video' && message.mediaUrl"
            class="message-media message-video"
            :src="message.mediaUrl"
            controls
            preload="metadata"
          ></video>
          <span v-else>{{ message.content }}</span>
        </div>

        <div class="message-meta">
          <span class="message-time">{{ formatTime(message.createTime) }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        class="message-content"
        :class="{
          'has-media': message.type === 'image' || message.type === 'video',
        }"
      >
        <img
          v-if="message.type === 'image' && message.mediaUrl"
          class="message-media message-image"
          :src="message.mediaUrl"
          alt="image"
          @click="openImagePreview(message.mediaUrl)"
        />
        <video
          v-else-if="message.type === 'video' && message.mediaUrl"
          class="message-media message-video"
          :src="message.mediaUrl"
          controls
          preload="metadata"
        ></video>
        <span v-else>{{ message.content }}</span>
      </div>
      <div class="message-meta">
        <span class="message-time">{{ formatTime(message.createTime) }}</span>
        <span
          v-if="message.senderId === currentUserId && !message.groupId"
          class="message-status"
        >
          {{ getStatusText(message.status) }}
        </span>
      </div>
    </template>
  </div>

  <Teleport to="body">
    <div
      v-if="previewOpen"
      class="image-preview-overlay"
      @click.self="closeImagePreview"
    >
      <button class="image-preview-close" @click="closeImagePreview">
        关闭
      </button>
      <img
        v-if="previewUrl"
        class="image-preview-image"
        :src="previewUrl"
        alt="preview"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { MessageStatus } from "../../models/Message";
import type { Message } from "../../models/Message";

interface Props {
  message: Message;
  currentUserId: string;
}

const props = defineProps<Props>();

const previewOpen = ref(false);
const previewUrl = ref<string | null>(null);

const openImagePreview = (url: string | null | undefined) => {
  if (!url) {
    return;
  }
  previewUrl.value = url;
  previewOpen.value = true;
};

const closeImagePreview = () => {
  previewOpen.value = false;
  previewUrl.value = null;
};

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// 获取消息状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case MessageStatus.SENDING:
      return "发送中...";
    case MessageStatus.SENT:
      return "已发送";
    case MessageStatus.DELIVERED:
      return "已送达";
    case MessageStatus.READ:
      return "已读";
    case MessageStatus.FAILED:
      return "发送失败";
    default:
      return "";
  }
};
</script>

<style scoped>
.message-bubble {
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.message-bubble.group-received {
  max-width: 85%;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}

.group-sender-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #0001f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.group-sender-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-sender-avatar-text {
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.group-sender-name {
  font-size: 12px;
  font-weight: 700;
  color: #666;
  line-height: 1;
}

.group-received-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.message-bubble.sent {
  align-self: flex-end;
}

.message-bubble.received {
  align-self: flex-start;
}

.message-content {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

.message-content.has-media {
  padding: 4px;
  background-color: transparent;
}

.message-media {
  display: block;
  max-width: 260px;
  max-height: 260px;
  border-radius: 12px;
}

.message-video {
  max-width: 320px;
  max-height: 320px;
}

.message-bubble.sent .message-content {
  background-color: #0001f0;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble.sent .message-content.has-media {
  background-color: transparent;
  color: inherit;
}

.message-bubble.received .message-content {
  background-color: #f0f0f0;
  color: #333;
  border-top-left-radius: 4px;
}

.message-bubble.received .message-content.has-media {
  background-color: transparent;
  color: inherit;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #999;
}

.message-bubble.sent .message-meta {
  justify-content: flex-end;
}

.message-bubble.received .message-meta {
  justify-content: flex-start;
}

.message-status {
  color: #64b5f6;
}

.message-media.message-image {
  cursor: zoom-in;
}

.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 2000;
}

.image-preview-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 12px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
}

.image-preview-image {
  max-width: min(92vw, 980px);
  max-height: 88vh;
  object-fit: contain;
  border-radius: 12px;
}
</style>
