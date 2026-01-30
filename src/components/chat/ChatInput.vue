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
      <div class="tooltip-container" :class="{ 'is-disabled': disabled }">
        <button
          type="button"
          class="media-button"
          @click="triggerPick"
          :disabled="disabled"
        >
          <svg
            class="media-icon"
            height="30"
            width="30"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 7v10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
            />
            <path
              d="M7 12h10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <div class="tooltip-bubble" role="tooltip">
          <p class="tooltip-text">发送图片或视频</p>
        </div>
      </div>
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
        <div class="svg-wrapper-1">
          <div class="svg-wrapper">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
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
  background-color: #fff;
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

.media-icon {
  transition: transform 0.5s;
}

.tooltip-container {
  position: relative;
  flex-shrink: 0;
  flex-grow: 0;
}

.tooltip-container:hover:not(.is-disabled) .media-icon {
  transform: rotate(360deg) scale(1.1);
}

.tooltip-bubble {
  position: absolute;
  left: 0;
  bottom: 0;
  width: auto;
  min-width: 140px;
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

.tooltip-bubble::before {
  content: "";
  position: absolute;
  left: 16px;
  bottom: -6px;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  background: #9aa0a6;
}

.tooltip-text {
  margin: 0;
  padding: 0;
  text-align: center;
  color: #fff;
}

.tooltip-container:hover:not(.is-disabled) .tooltip-bubble {
  opacity: 1;
  transform: translateY(-52px);
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
  border-color: #0001f0;
}

.message-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.send-button {
  font-family: inherit;
  font-size: 14px;
  background: #0001f0;
  color: white;
  padding: 0.7em 1em;
  padding-left: 0.9em;
  display: flex;
  align-items: center;
  border: none;
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
  align-self: flex-end;
  white-space: nowrap;
}

.send-button span {
  display: block;
  margin-left: 0.3em;
  transition: all 0.3s ease-in-out;
}

.send-button svg {
  display: block;
  transform-origin: center center;
  transition: transform 0.3s ease-in-out;
}

.send-button:hover:not(:disabled) .svg-wrapper {
  animation: fly-1 0.6s ease-in-out infinite alternate;
}

.send-button:hover:not(:disabled) svg {
  transform: translateX(1.2em) rotate(45deg) scale(1.1);
}

.send-button:hover:not(:disabled) span {
  transform: translateX(5em);
}

.send-button:active {
  transform: scale(0.95);
}

.send-button:disabled {
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
</style>
