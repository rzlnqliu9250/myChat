<template>
  <div class="group-manage-overlay" @click.self="$emit('close')">
    <div class="group-manage-card">
      <div class="group-manage-header">
        <div class="group-manage-title">
          {{ group?.name }}
        </div>
        <button class="group-manage-close" @click="$emit('close')">
          关闭
        </button>
      </div>

      <div v-if="groupManageError" class="group-manage-error">
        {{ groupManageError }}
      </div>

      <div v-if="groupManageLoading" class="group-manage-loading">
        加载中...
      </div>

      <div v-else class="group-manage-body">
        <div class="group-manage-section">
          <div class="group-manage-section-title">成员列表</div>

          <div class="group-members">
            <div
              v-for="m in groupMembers"
              :key="m.user?.id || m.joinedAt"
              class="group-member"
            >
              <div class="group-member-left">
                <div class="group-member-avatar">
                  <img
                    v-if="m.user?.avatarUrl"
                    class="group-member-avatar-image"
                    :src="m.user.avatarUrl"
                    alt="avatar"
                  />
                  <span v-else class="group-member-avatar-text">
                    {{ (m.user?.nickname || m.user?.username || "?").charAt(0) }}
                  </span>
                </div>
                <div class="group-member-meta">
                  <div class="group-member-name">
                    {{ m.user?.nickname || m.user?.username || "未知用户" }}
                  </div>
                  <div class="group-member-role">{{ m.role }}</div>
                </div>
              </div>

              <button
                v-if="isGroupOwner && m.user?.id && m.role !== 'owner'"
                class="group-member-kick"
                @click="kickMember(m.user.id)"
              >
                踢出
              </button>
            </div>
          </div>
        </div>

        <div v-if="isGroupOwner" class="group-manage-section">
          <div class="group-manage-section-title">继续加人（从好友中选择）</div>

          <div class="group-add-list">
            <label
              v-for="f in addCandidates"
              :key="f.id"
              class="group-add-item"
            >
              <input
                type="checkbox"
                class="group-add-checkbox ui-checkbox"
                :checked="addMemberIds.has(f.id)"
                @change="toggleAddMember(f.id)"
              />
              <span class="group-add-text">{{ f.nickname || f.username }}</span>
            </label>
            <div v-if="!addCandidates.length" class="group-add-empty">
              没有可添加的好友
            </div>
          </div>

          <button
            class="group-add-confirm"
            :disabled="addMembersSubmitting || !addMemberIds.size"
            @click="addMembers"
          >
            {{ addMembersSubmitting ? "添加中..." : "添加成员" }}
          </button>
        </div>

        <div class="group-manage-section">
          <div class="group-manage-section-title">退出群聊</div>
          <button
            class="group-leave"
            :disabled="leaveSubmitting || isGroupOwner"
            @click="leaveGroup"
          >
            {{ leaveSubmitting ? "处理中..." : "退出群聊" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiGet, apiPost, apiDelete } from "../../services/api";
import { useUserStore } from "../../stores/userStore";
import type { UiFriend, UiGroup } from "../../types/chat";

// 定义接收的属性
const props = defineProps<{
  group: UiGroup | null;
  friends: UiFriend[];
  currentUser: { id: string } | null;
}>();

// 定义触发的事件
const emit = defineEmits<{
  (e: "close"): void;
  (e: "refresh-groups"): void;
  (e: "group-left"): void;
}>();

const userStore = useUserStore();

type GroupMemberRow = {
  user: {
    id: string;
    username: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  role: string;
  joinedAt: string;
};

const groupManageLoading = ref(false);
const groupManageError = ref<string | null>(null);
const groupMembers = ref<GroupMemberRow[]>([]);
const addMemberIds = ref<Set<string>>(new Set());
const addMembersSubmitting = ref(false);
const leaveSubmitting = ref(false);

const isGroupOwner = computed(() => {
  return !!props.group && !!props.currentUser && props.group.ownerId === props.currentUser.id;
});

const groupMemberIdSet = computed(() => {
  return new Set(
    (groupMembers.value || [])
      .map((m) => m.user?.id)
      .filter((id): id is string => !!id),
  );
});

const addCandidates = computed(() => {
  const existing = groupMemberIdSet.value;
  return (props.friends || []).filter((f) => !existing.has(f.id));
});

const fetchGroupMembers = async () => {
  if (!props.group?.id || !userStore.token) return;
  
  groupManageLoading.value = true;
  groupManageError.value = null;
  try {
    const data = await apiGet<{ members: GroupMemberRow[] }>(
      `/api/groups/${props.group.id}/members`,
      userStore.token,
    );
    groupMembers.value = data.members || [];
  } catch (e) {
    groupManageError.value = e instanceof Error ? e.message : "加载群成员失败";
  } finally {
    groupManageLoading.value = false;
  }
};

const toggleAddMember = (userId: string) => {
  const next = new Set(addMemberIds.value);
  if (next.has(userId)) next.delete(userId);
  else next.add(userId);
  addMemberIds.value = next;
};

const addMembers = async () => {
  if (!props.group?.id || !userStore.token) return;
  const ids = Array.from(addMemberIds.value);
  if (!ids.length) return;

  addMembersSubmitting.value = true;
  groupManageError.value = null;
  try {
    await apiPost(
      `/api/groups/${props.group.id}/members`,
      { memberIds: ids },
      userStore.token,
    );
    addMemberIds.value = new Set();
    await fetchGroupMembers();
  } catch (e) {
    groupManageError.value = e instanceof Error ? e.message : "添加成员失败";
  } finally {
    addMembersSubmitting.value = false;
  }
};

const kickMember = async (memberId: string) => {
  if (!props.group?.id || !userStore.token) return;
  
  groupManageError.value = null;
  try {
    await apiDelete(`/api/groups/${props.group.id}/members/${memberId}`, userStore.token);
    await fetchGroupMembers();
  } catch (e) {
    groupManageError.value = e instanceof Error ? e.message : "踢人失败";
  }
};

const leaveGroup = async () => {
  if (!props.group?.id || !userStore.token) return;
  
  leaveSubmitting.value = true;
  groupManageError.value = null;
  try {
    await apiPost(`/api/groups/${props.group.id}/leave`, undefined, userStore.token);
    emit("group-left"); // 通知父组件已退群，清理当前选中状态
  } catch (e) {
    groupManageError.value = e instanceof Error ? e.message : "退群失败";
  } finally {
    leaveSubmitting.value = false;
  }
};

// 组件挂载时自动获取数据
onMounted(() => {
  fetchGroupMembers();
});
</script>

<style scoped lang="scss">
/* 这里就是你原本 Chat.vue 里的相关样式，我直接搬过来了 */
.group-manage-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 999;
}

.group-manage-card {
  width: min(680px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.group-manage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.group-manage-title {
  font-size: 18px;
  font-weight: 800;
  color: #111;
}

/* 按钮基础样式抽象（优化项：原本有很多重复代码，我稍微整理了下） */
.btn-animated {
  background: transparent;
  position: relative;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  border-radius: 12px;
  outline: none;
  overflow: hidden;
  transition: color 0.3s 0.1s ease-out;
  text-align: center;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-animated::before {
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

.group-manage-close {
  padding: 8px 12px;
  border: 1px solid #111;
  color: #111;
  @extend .btn-animated; 
}
.group-manage-close:hover { color: #fff; }
.group-manage-close:hover::before { box-shadow: inset 0 0 0 10em #111; }
/* ... (为了保证直接可用，下面放你原版的样式) ... */

.group-manage-close {
  background: transparent; position: relative; padding: 8px 12px; display: flex; align-items: center; font-weight: 700; text-decoration: none; cursor: pointer; border: 1px solid #111; border-radius: 12px; outline: none; overflow: hidden; color: #111; transition: color 0.3s 0.1s ease-out; text-align: center; z-index: 0;
}
.group-manage-close:hover { color: #fff; }
.group-manage-close::before { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto; content: ""; border-radius: 50%; display: block; width: 20em; height: 20em; left: -5em; text-align: center; transition: box-shadow 0.5s ease-out; z-index: -1; }
.group-manage-close:hover::before { box-shadow: inset 0 0 0 10em #111; }

.group-manage-body { display: flex; flex-direction: column; gap: 16px; }
.group-manage-section-title { font-size: 13px; font-weight: 800; color: #666; margin-bottom: 10px; }
.group-manage-error { color: #ff1744; font-size: 12px; margin-bottom: 10px; }
.group-manage-loading { font-size: 12px; color: #666; }
.group-members { display: flex; flex-direction: column; gap: 10px; }
.group-member { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 12px; }
.group-member-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.group-member-avatar { width: 32px; height: 32px; border-radius: 50%; background: #0001f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.group-member-avatar-image { width: 100%; height: 100%; object-fit: cover; }
.group-member-avatar-text { color: #fff; font-weight: 800; font-size: 14px; }
.group-member-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.group-member-name { font-weight: 800; font-size: 14px; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-member-role { font-size: 12px; color: #666; }

.group-member-kick { background: transparent; position: relative; padding: 8px 12px; display: flex; align-items: center; font-weight: 800; text-decoration: none; cursor: pointer; border: 1px solid #ff1744; border-radius: 12px; outline: none; overflow: hidden; color: #ff1744; transition: color 0.3s 0.1s ease-out; text-align: center; z-index: 0; }
.group-member-kick:hover { color: #fff; }
.group-member-kick::before { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto; content: ""; border-radius: 50%; display: block; width: 20em; height: 20em; left: -5em; text-align: center; transition: box-shadow 0.5s ease-out; z-index: -1; }
.group-member-kick:hover::before { box-shadow: inset 0 0 0 10em #ff1744; }

.group-add-list { max-height: 220px; overflow: auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.group-add-item { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
.group-add-checkbox { flex-shrink: 0; }
.group-add-text { font-size: 14px; color: #111; font-weight: 700; }
.group-add-empty { font-size: 12px; color: #999; text-align: center; padding: 10px 0; }

.group-add-confirm { margin-top: 10px; background: transparent; position: relative; color: #0001f0; border: 1px solid #0001f0; padding: 10px 14px; border-radius: 12px; cursor: pointer; font-weight: 800; outline: none; overflow: hidden; transition: color 0.3s 0.1s ease-out; text-align: center; z-index: 0; }
.group-add-confirm:hover { color: #fff; }
.group-add-confirm::before { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto; content: ""; border-radius: 50%; display: block; width: 20em; height: 20em; left: -5em; text-align: center; transition: box-shadow 0.5s ease-out; z-index: -1; }
.group-add-confirm:hover::before { box-shadow: inset 0 0 0 10em #0001f0; }
.group-add-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.group-add-confirm:disabled:hover { color: #0001f0; }
.group-add-confirm:disabled:hover::before { box-shadow: none; }

.group-leave { background: transparent; position: relative; border: 1px solid #ff1744; color: #ff1744; padding: 10px 14px; border-radius: 12px; cursor: pointer; font-weight: 800; outline: none; overflow: hidden; transition: color 0.3s 0.1s ease-out; text-align: center; z-index: 0; }
.group-leave:hover { color: #fff; }
.group-leave::before { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto; content: ""; border-radius: 50%; display: block; width: 20em; height: 20em; left: -5em; text-align: center; transition: box-shadow 0.5s ease-out; z-index: -1; }
.group-leave:hover::before { box-shadow: inset 0 0 0 10em #ff1744; }
.group-leave:disabled { opacity: 0.6; cursor: not-allowed; }
.group-leave:disabled:hover { color: #ff1744; }
.group-leave:disabled:hover::before { box-shadow: none; }

/* Checkbox 样式 */
.ui-checkbox { --primary-color: #0001f0; --secondary-color: #fff; --primary-hover-color: #4096ff; --checkbox-diameter: 20px; --checkbox-border-radius: 5px; --checkbox-border-color: #d9d9d9; --checkbox-border-width: 1px; --checkbox-border-style: solid; --checkmark-size: 1.2; -webkit-appearance: none; -moz-appearance: none; appearance: none; width: var(--checkbox-diameter); height: var(--checkbox-diameter); border-radius: var(--checkbox-border-radius); background: var(--secondary-color); border: var(--checkbox-border-width) var(--checkbox-border-style) var(--checkbox-border-color); -webkit-transition: all 0.3s; -o-transition: all 0.3s; transition: all 0.3s; cursor: pointer; position: relative; box-sizing: border-box; }
.ui-checkbox::after { content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0; box-shadow: 0 0 0 calc(var(--checkbox-diameter) / 2.5) var(--primary-color); border-radius: inherit; opacity: 0; transition: all 0.5s cubic-bezier(0.12, 0.4, 0.29, 1.46); }
.ui-checkbox::before { top: 40%; left: 50%; content: ""; position: absolute; width: 4px; height: 7px; border-right: 2px solid var(--secondary-color); border-bottom: 2px solid var(--secondary-color); transform: translate(-50%, -50%) rotate(45deg) scale(0); opacity: 0; transition: all 0.1s cubic-bezier(0.71, -0.46, 0.88, 0.6), opacity 0.1s; box-sizing: border-box; }
.ui-checkbox:hover { border-color: var(--primary-color); }
.ui-checkbox:checked { background: var(--primary-color); border-color: transparent; }
.ui-checkbox:checked::before { opacity: 1; transform: translate(-50%, -50%) rotate(45deg) scale(var(--checkmark-size)); transition: all 0.2s cubic-bezier(0.12, 0.4, 0.29, 1.46) 0.1s; }
.ui-checkbox:active:not(:checked)::after { transition: none; box-shadow: none; opacity: 1; }
</style>
