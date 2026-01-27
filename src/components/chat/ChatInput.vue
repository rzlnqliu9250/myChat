<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <input
        ref="fileInput"
        type="file"
        accept="image/*,video/*"
        style="display: none"
        @change="handleFileChange"
      />
      <button
        type="button"
        class="media-button"
        @click="triggerPick"
        :disabled="disabled"
      >
        +
      </button>
      <textarea
        v-model="message"
        placeholder="输入消息..."
        class="message-input"
        @keydown.enter.prevent="handleSend"
        rows="1"
        :disabled="disabled"
      ></textarea>
      <button
        class="send-button"
        @click="handleSend"
        :disabled="!message.trim() || disabled"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface Props {
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  send: [content: string];
  sendMedia: [file: File];
}>();

const message = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const handleSend = () => {
  if (message.value.trim() && !props.disabled) {
    emit("send", message.value.trim());
    message.value = "";
  }
};

const triggerPick = () => {
  if (props.disabled) {
    return;
  }
  fileInput.value?.click();
};

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  emit("sendMedia", file);

  try {
    input.value = "";
  } catch {
    // ignore
  }
};
</script>

<style scoped>
.chat-input-container {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.media-button {
  /* --- 你之前的核心样式保持不变 --- */
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #ddd;
  background: #fff;
  color: #555;
  font-size: 22px;
  cursor: pointer;
  flex-shrink: 0;
  flex-grow: 0;
  transition: all 0.2s;

  /* --- 关键修复：去掉点击时的黑边或默认变黑效果 --- */
  outline: none; /* 去掉聚焦时的蓝色或黑色边框 */
  -webkit-tap-highlight-color: transparent; /* 去掉移动端点击时的蓝色阴影 */
}

/* 悬停效果 */
.media-button:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

/* --- 关键修复：自定义点击瞬间的状态，防止变黑 --- */
.media-button:active {
  background-color: #ececec; /* 点击时稍微变深一点灰，而不是变黑 */
  transform: scale(0.95); /* 增加一个轻微缩小的物理反馈，看起来更高级 */
  border-color: #bbb;
}

.media-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 24px;
  resize: none;
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.3s;
  max-height: 120px;
  overflow-y: auto;
  font-family: inherit;
}

.message-input:focus {
  border-color: #646cff;
}

.message-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.send-button {
  padding: 12px 24px;
  background-color: #646cff;
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
  align-self: flex-end;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  background-color: #535bf2;
}

.send-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
}
</style>
