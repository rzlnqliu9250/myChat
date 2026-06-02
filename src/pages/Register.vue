<template>
  <div class="register-container">
    <div id="animation" class="large grid centered square-grid">
      <h2 ref="titleRef" class="text-xl">HELLO MYCHAT</h2>
    </div>
    <div class="register-form-wrapper">
      <h1 class="register-title">注册</h1>
      <form @submit.prevent="handleRegister" class="register-form">
        
        <div class="form-group">
          <label class="form-label">头像（可选）</label>
          <input ref="avatarInput" type="file" accept="image/*" style="display: none" @change="handleAvatarChange" />
          <div class="avatar-row">
            <div class="avatar-preview">
              <img v-if="avatarPreview" class="avatar-image" :src="avatarPreview" alt="avatar" />
              <span v-else class="avatar-fallback">{{ form.nickname.charAt(0) || "U" }}</span>
            </div>
            <button type="button" class="avatar-pick-button" @click="triggerAvatarPick">选择头像</button>
          </div>
        </div>

        <div class="form-control" v-for="field in formFields" :key="field.id">
          <input
            :type="field.type"
            :id="field.id"
            v-model="form[field.id]"
            class="form-input"
            :class="{ filled: !!form[field.id] }"
            :maxlength="field.maxlength"
            :minlength="field.minlength"
            required
          />
          <label>
            <span v-for="(ch, i) in field.label" :key="`${ch}-${i}`" :style="{ transitionDelay: `${i * 50}ms` }">
              {{ ch }}
            </span>
          </label>
          <p v-if="field.id === 'confirmPassword' && form.password !== form.confirmPassword" class="error-message">
            两次输入的密码不一致
          </p>
        </div>

        <button
          type="submit"
          class="register-button"
          :class="{ loading }"
          :disabled="isSubmitDisabled"
        >
          <span class="button-text">注册</span>
        </button>

        <p v-if="isLengthError" class="error-message">账号和昵称最多 10 个字符</p>

        <div class="footer-turnstile-row">
          <div class="form-footer">
            <p>已有账号？<br /><router-link to="/login" class="login-link">立即登录</router-link></p>
          </div>
          <div class="turnstile-row">
            <div ref="turnstileEl" class="turnstile-widget"></div>
            <p v-if="turnstileError" class="turnstile-error">{{ turnstileError }}</p>
          </div>
        </div>

      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import { apiPost, apiRequest } from "../services/api";
import { animate, stagger, splitText } from "animejs";

const router = useRouter();
const userStore = useUserStore();
const { connect, wsManager } = useWebSocket();

// 表单数据与配置 (精简了原先重复的 label 拆分逻辑)
const form = ref<Record<string, string>>({ username: "", nickname: "", password: "", confirmPassword: "" });
const formFields = [
  { id: "username", type: "text", label: "账号".split(""), maxlength: 10 },
  { id: "nickname", type: "text", label: "昵称".split(""), maxlength: 10 },
  { id: "password", type: "password", label: "密码".split(""), minlength: 6 },
  { id: "confirmPassword", type: "password", label: "确认密码".split("") },
];

// 计算属性：校验状态
const isLengthError = computed(() => form.value.username.length > 10 || form.value.nickname.length > 10);
const isSubmitDisabled = computed(() => 
  loading.value || 
  form.value.password !== form.value.confirmPassword || 
  !turnstileToken.value || 
  isLengthError.value
);

// UI 状态
const loading = ref(false);
const titleRef = ref<HTMLElement | null>(null);
let titleAnimation: { pause?: () => void } | null = null;

// 头像状态
const avatarInput = ref<HTMLInputElement | null>(null);
const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);

// Turnstile 状态
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const turnstileEl = ref<HTMLElement | null>(null);
const turnstileToken = ref<string | null>(null);
const turnstileError = ref<string | null>(null);
let turnstileWidgetId: string | null = null;

/* 头像处理逻辑 */
const triggerAvatarPick = () => avatarInput.value?.click();
const handleAvatarChange = (e: Event) => {
  const file = (e.target as HTMLInputElement)?.files?.[0];
  if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
  
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value); // 移除了多余的 try-catch
  avatarFile.value = file;
  avatarPreview.value = URL.createObjectURL(file);
};

/* Turnstile 验证逻辑 */
const waitForTurnstile = async () => {
  const start = Date.now();
  while (!window.turnstile) {
    if (Date.now() - start > 8000) throw new Error("Turnstile 脚本加载超时");
    await new Promise((r) => setTimeout(r, 100));
  }
  return window.turnstile;
};

const renderTurnstile = async () => {
  if (!turnstileSiteKey || !turnstileEl.value) return (turnstileError.value = "缺少验证配置");
  if (turnstileWidgetId && window.turnstile) return window.turnstile.reset(turnstileWidgetId);

  try {
    const turnstile = await waitForTurnstile();
    turnstileEl.value.innerHTML = "";
    turnstileWidgetId = turnstile.render(turnstileEl.value, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => { turnstileToken.value = token; turnstileError.value = null; },
      "expired-callback": () => (turnstileToken.value = null),
      "error-callback": () => { turnstileToken.value = null; turnstileError.value = "验证失败，请重试"; },
    });
  } catch (err) {
    turnstileError.value = err instanceof Error ? err.message : "验证组件初始化失败";
  }
};

/* 生命周期 */
onMounted(async () => {
  await nextTick();
  if (titleRef.value) {
    const { chars } = splitText(titleRef.value, { words: false, chars: true });
    titleAnimation = animate(chars, {
      y: [{ to: "-2rem", ease: "outExpo", duration: 600 }, { to: 0, ease: "outBounce", duration: 800, delay: 100 }],
      rotate: { from: "-1turn", delay: 0 },
      delay: stagger(50),
      ease: "inOutCirc",
      loopDelay: 1000,
      loop: true,
    });
  }
  await renderTurnstile();
});

onUnmounted(() => {
  titleAnimation?.pause?.();
  if (turnstileWidgetId && window.turnstile) window.turnstile.remove(turnstileWidgetId);
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
});

/* 注册提交逻辑 */
const handleRegister = async () => {
  if (isSubmitDisabled.value) return;
  
  loading.value = true;
  try {
    let avatarUrl: string | undefined;
    if (avatarFile.value) {
      const body = new FormData();
      body.append("file", avatarFile.value);
      const uploaded = await apiRequest<{ url: string }>("/api/upload/avatar/temp", { method: "POST", body });
      avatarUrl = uploaded.url;
    }

    const registerData = await apiPost<any>("/api/register", {
      ...form.value,
      avatarUrl,
      turnstileToken: turnstileToken.value,
    });

    userStore.setCurrentUser({
      id: registerData.user.id,
      username: registerData.user.username,
      nickname: registerData.user.nickname || registerData.user.username,
      avatar: registerData.user.avatarUrl || undefined,
      status: "online",
      lastOnline: Date.now(),
    });
    userStore.setToken(registerData.token);
    wsManager.setToken(registerData.token);
    await connect();
    router.push("/chat");

  } catch (error) {
    const raw = error instanceof Error ? error.message : "注册失败";
    const msg =
      raw === "用户名已经存在" ? "用户名已存在" : raw;
    alert(msg);
    console.error("注册失败:", error);
    turnstileToken.value = null;
    if (turnstileWidgetId && window.turnstile) window.turnstile.reset(turnstileWidgetId);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* 核心响应式修复：使用 min-height 替代固定 height，防止小屏截断 */
.register-container {
  min-height: 100vh; 
  width: 100vw;
  padding: 40px 20px; /* 上下留白，防止贴边 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow-y: auto; /* 允许滚动 */
  overflow-x: hidden;
  color: #111;
  background:
    radial-gradient(900px circle at 18% 18%, rgba(66, 184, 131, 0.16), transparent 60%),
    radial-gradient(720px circle at 85% 28%, rgba(1, 166, 73, 0.12), transparent 58%),
    radial-gradient(800px circle at 50% 95%, rgba(17, 17, 17, 0.05), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, #f3fbf7 100%);
}

.register-container::before, .register-container::after {
  content: "";
  position: absolute;
  inset: -40% -30%;
  background: radial-gradient(closest-side, rgba(66, 184, 131, 0.18), transparent 70%);
  filter: blur(28px);
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
}
.register-container::after {
  inset: -30% -40%;
  background: radial-gradient(closest-side, rgba(1, 166, 73, 0.16), transparent 70%);
  opacity: 0.5;
}

#animation, .register-form-wrapper {
  position: relative;
  z-index: 1;
}

/* 动态计算标题大小：小屏幕缩小，大屏幕放大 */
#animation .text-xl {
  font-size: clamp(1.8rem, 5vw, 3rem); 
  color: currentColor;
  letter-spacing: 0.06em;
  margin-bottom: 20px;
}

.register-form-wrapper {
  width: 100%;
  max-width: 420px;
  background-color: rgba(255, 255, 255, 0.85);
  padding: 30px;
  border-radius: 12px; /* 稍微圆润一点更契合 Mac 风格 */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
}

.register-title { text-align: center; margin-bottom: 25px; color: #333; font-size: 24px; font-weight: 600; }
.register-form { display: flex; flex-direction: column; gap: 18px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-label { font-size: 14px; font-weight: 500; color: #555; }

/* 表单特效区 */
.form-control { position: relative; width: 100%; margin: 0; }
.form-control .form-input {
  background-color: transparent; border: 0; border-bottom: 2px #f5f5f5 solid;
  display: block; width: 100%; padding: 20px 0 10px; font-size: 16px; color: #222;
  transition: border-color 0.3s;
}
.form-control .form-input:focus, .form-control .form-input.filled {
  outline: 0; border-bottom-color: #111;
}
.form-control label { position: absolute; top: 20px; left: 0; pointer-events: none; }
.form-control label span {
  display: inline-block; font-size: 16px; min-width: 5px; color: #666;
  transition: 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
.form-control .form-input:focus + label span, .form-control .form-input.filled + label span {
  color: #111; transform: translateY(-30px); font-size: 14px;
}

/* 头像区 */
.avatar-row { display: flex; align-items: center; gap: 12px; }
.avatar-preview { width: 48px; height: 48px; border-radius: 50%; background: #42b883; color: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 auto; }
.avatar-image { width: 100%; height: 100%; object-fit: cover; }
.avatar-fallback { font-weight: 700; font-size: 20px; }
.avatar-pick-button { font-size: 15px; background: #f0fdf6; border: 1px dashed #42b883; padding: 0.6em 1em; color: #42b883; cursor: pointer; border-radius: 8px; transition: 0.3s; }
.avatar-pick-button:hover { background: #42b883; color: #fff; }

/* 按钮与错误信息 */
.register-button {
  background-color: #42b883; color: #fff; border: none; cursor: pointer;
  border-radius: 8px; width: 100%; height: 45px; transition: 0.3s; font-size: 16px; font-weight: 500;
  display: flex; align-items: center; justify-content: center; position: relative;
  margin-top: 10px;
}
.register-button.loading .button-text { opacity: 0; }
.register-button.loading::after {
  content: ""; position: absolute; width: 18px; height: 18px;
  border-radius: 50%; border: 3px solid rgba(255,255,255,0.45); border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.register-button:hover:not(:disabled) { background-color: #01a649; box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3); }
.register-button:disabled { background-color: #a5dbb8; cursor: not-allowed; }

.error-message { margin: 4px 0 0 0; font-size: 12px; color: #ff5252; }

/* 底部区域响应式修复：使用 flex-wrap 让其在小屏幕自动折行 */
.footer-turnstile-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap; /* 核心：允许折行 */
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}
.form-footer { font-size: 14px; color: #666; line-height: 1.5; }
.login-link { color: #42b883; text-decoration: none; font-weight: 600; }
.login-link:hover { text-decoration: underline; }
.turnstile-row { display: flex; flex-direction: column; align-items: flex-end; }
.turnstile-error { margin-top: 5px; font-size: 12px; color: #ff5252; text-align: right; }
</style>
