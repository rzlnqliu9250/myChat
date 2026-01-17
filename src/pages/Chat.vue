<template>
  <div class="chat-container">
    <!-- 侧边栏：好友列表 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="user-info">
          <div class="user-avatar">
            {{ currentUser?.nickname?.charAt(0) || "U" }}
          </div>
          <div class="user-details">
            <h3 class="user-name">{{ currentUser?.nickname || "未登录" }}</h3>
            <span class="user-status">{{
              currentUser?.status || "offline"
            }}</span>
          </div>
        </div>
        <button class="logout-button" @click="handleLogout">退出登录</button>
      </div>

      <!-- 搜索框 -->
      <div class="search-box">
        <input
          type="text"
          placeholder="搜索好友..."
          v-model="searchQuery"
          class="search-input"
        />
      </div>

      <!-- 好友列表 -->
      <div class="friend-list">
        <h4 class="friend-list-title">好友列表</h4>
        <div
          v-for="friend in filteredFriends"
          :key="friend.id"
          class="friend-item"
          :class="{ active: selectedFriend?.id === friend.id }"
          @click="selectFriend(friend)"
        >
          <div class="friend-avatar">{{ friend.nickname.charAt(0) }}</div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.nickname }}</div>
            <div class="friend-status">
              <span class="status-indicator" :class="friend.status"></span>
              {{ friend.status }}
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区：聊天窗口 -->
    <main class="chat-main">
      <div v-if="!selectedFriend" class="no-selection">
        <div class="no-selection-content">
          <h2>选择一个好友开始聊天</h2>
          <p>从左侧列表中选择一个好友，开始您的聊天之旅</p>
        </div>
      </div>
      <div v-else class="chat-window">
        <!-- 聊天头部 -->
        <header class="chat-header">
          <div class="chat-header-info">
            <div class="friend-avatar">
              {{ selectedFriend.nickname.charAt(0) }}
            </div>
            <div>
              <h3 class="friend-name">{{ selectedFriend.nickname }}</h3>
              <span class="friend-status">
                <span
                  class="status-indicator"
                  :class="selectedFriend.status"
                ></span>
                {{ selectedFriend.status }}
              </span>
            </div>
          </div>
        </header>

        <!-- 聊天消息区域 -->
        <div class="chat-messages">
          <message-bubble
            v-for="message in messages"
            :key="message.id"
            :message="message"
            :current-user-id="currentUser?.id || ''"
          />
        </div>

        <!-- 聊天输入区域 -->
        <footer class="chat-input-area">
          <chat-input @send="handleSendMessage" />
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import type { Message } from "../models/Message";
import MessageBubble from "../components/chat/MessageBubble.vue";
import ChatInput from "../components/chat/ChatInput.vue";

const router = useRouter();
const userStore = useUserStore();
const { send, on, connect } = useWebSocket();

const searchQuery = ref("");
const selectedFriend = ref<any>(null);
const messages = ref<Message[]>([]);

// 当前登录用户
const currentUser = computed(() => userStore.currentUser);

// 模拟好友列表数据
const mockFriends = ref([
  {
    id: "user1",
    username: "friend1",
    nickname: "张三",
    status: "online" as const,
  },
  {
    id: "user2",
    username: "friend2",
    nickname: "李四",
    status: "offline" as const,
  },
  {
    id: "user3",
    username: "friend3",
    nickname: "王五",
    status: "busy" as const,
  },
  {
    id: "user4",
    username: "friend4",
    nickname: "赵六",
    status: "online" as const,
  },
  {
    id: "user5",
    username: "friend5",
    nickname: "孙七",
    status: "away" as const,
  },
]);

// 筛选好友
const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return mockFriends.value;
  }
  return mockFriends.value.filter(
    (friend) =>
      friend.nickname.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

// 选择好友
const selectFriend = (friend: any) => {
  selectedFriend.value = friend;
  // 获取与该好友的聊天记录（模拟）
  loadMessages(friend.id);
};

// 加载聊天记录
const loadMessages = (friendId: string) => {
  // 模拟加载聊天记录
  messages.value = [
    {
      id: "msg1",
      senderId: friendId,
      receiverId: currentUser.value?.id || "",
      content: "你好！",
      type: "text" as const,
      status: "read" as const,
      createTime: Date.now() - 3600000,
      updateTime: Date.now() - 3600000,
    },
    {
      id: "msg2",
      senderId: currentUser.value?.id || "",
      receiverId: friendId,
      content: "你好！最近怎么样？",
      type: "text" as const,
      status: "read" as const,
      createTime: Date.now() - 3500000,
      updateTime: Date.now() - 3500000,
    },
    {
      id: "msg3",
      senderId: friendId,
      receiverId: currentUser.value?.id || "",
      content: "挺好的，谢谢！",
      type: "text" as const,
      status: "read" as const,
      createTime: Date.now() - 3400000,
      updateTime: Date.now() - 3400000,
    },
  ];
};

// 发送消息
const handleSendMessage = (content: string) => {
  if (!selectedFriend.value || !currentUser.value) {
    return;
  }

  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId: currentUser.value.id,
    receiverId: selectedFriend.value.id,
    content: content,
    type: "text" as const,
    status: "sending" as const,
    createTime: Date.now(),
    updateTime: Date.now(),
  };

  // 添加到本地消息列表
  messages.value.push(message);

  // 发送消息到服务器（实际应该通过WebSocket发送）
  send("message_receive" as any, {
    content: content,
    receiverId: selectedFriend.value.id,
    type: "text",
  });

  // 模拟对方回复
  setTimeout(() => {
    if (!currentUser.value) return;

    const reply: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: selectedFriend.value.id,
      receiverId: currentUser.value.id,
      content: `你好，${currentUser.value.nickname}！这是一条自动回复。`,
      type: "text" as const,
      status: "read" as const,
      createTime: Date.now(),
      updateTime: Date.now(),
    };
    messages.value.push(reply);
  }, 1000);
};

// 退出登录
const handleLogout = () => {
  userStore.logout();
  router.push("/login");
};

// 组件挂载时的初始化
onMounted(() => {
  // 如果未登录，跳转到登录页
  if (!currentUser.value) {
    router.push("/login");
    return;
  }

  // 连接WebSocket
  connect();

  // 模拟加载好友列表
  userStore.setFriends(mockFriends.value);

  // 监听新消息
  on("message_receive" as any, (message: any) => {
    console.log("收到新消息:", message);
    // 处理收到的消息
  });
});
</script>

<style scoped>
.chat-container {
  width: 100%;
  height: 100vh;
  display: flex;
  background-color: #f5f5f5;
}

/* 侧边栏样式 */
.sidebar {
  width: 300px;
  background-color: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
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
  background-color: #646cff;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 16px;
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
  background-color: #ff5252;
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

/* 搜索框样式 */
.search-box {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.search-input:focus {
  border-color: #646cff;
}

/* 好友列表样式 */
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

.friend-item:hover {
  background-color: #f0f0f0;
}

.friend-item.active {
  background-color: #e8eaf6;
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

/* 主内容区样式 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.no-selection {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #999;
}

.no-selection-content {
  text-align: center;
}

/* 聊天窗口样式 */
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  margin: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 聊天消息区域 */
.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 聊天输入区域 */
.chat-input-area {
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
}

.message-input:focus {
  border-color: #646cff;
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
}

.send-button:hover:not(:disabled) {
  background-color: #535bf2;
}

.send-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
}
</style>
