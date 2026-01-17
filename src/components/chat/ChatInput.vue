<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
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
}>();

const message = ref("");

const handleSend = () => {
  if (message.value.trim() && !props.disabled) {
    emit("send", message.value.trim());
    message.value = "";
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
