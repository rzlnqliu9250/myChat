<template>
  <div
    class="message-bubble"
    :class="{ sent: message.senderId === currentUserId }"
  >
    <div class="message-content">
      {{ message.content }}
    </div>
    <div class="message-meta">
      <span class="message-time">{{ formatTime(message.createTime) }}</span>
      <span v-if="message.senderId === currentUserId" class="message-status">
        {{ getStatusText(message.status) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageStatus } from "../../models/Message";
import type { Message } from "../../models/Message";

interface Props {
  message: Message;
  currentUserId: string;
}

const props = defineProps<Props>();

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

.message-bubble.sent .message-content {
  background-color: #646cff;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble.received .message-content {
  background-color: #f0f0f0;
  color: #333;
  border-bottom-left-radius: 4px;
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
</style>
