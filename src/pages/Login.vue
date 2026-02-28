<template>
  <div class="login-container">
    <div id="animation" class="large grid centered square-grid">
      <h2 ref="titleRef" class="text-xl">HELLO MYCHAT</h2>
    </div>
    
    <div class="login-form-wrapper">
      <h1 class="login-title">登录</h1>
      <form @submit.prevent="handleLogin" class="login-form">
        
        <div class="form-control" v-for="field in formFields" :key="field.id">
          <input
            :type="field.type"
            :id="field.id"
            v-model="form[field.id]"
            class="form-input"
            required
          />
          <label>
            <span
              v-for="(ch, i) in field.label"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
            >
              {{ ch }}
            </span>
          </label>
        </div>

        <button
          type="submit"
          class="login-button"
          :class="{ loading }"
          :disabled="loading || !turnstileToken"
        >
          <span class="button-text">登录</span>
        </button>

        <div class="footer-turnstile-row">
          <div class="form-footer">
            <p>还没有账号？<br />
              <router-link to="/register" class="register-link">立即注册</router-link>
            </p>
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
import { ref, onMounted, nextTick, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import { apiPost } from "../services/api";
import { animate, stagger, splitText } from "animejs";

const router = useRouter();
const userStore = useUserStore();
const { connect, wsManager } = useWebSocket();

// UI 与动画状态
const titleRef = ref<HTMLElement | null>(null);
let titleAnimation: { pause?: () => void } | null = null;
const loading = ref(false);

// 表单数据与配置
const form = ref<Record<string, string>>({ username: "", password: "" });
const formFields = [
  { id: "username", type: "text", label: "账号".split("") },
  { id: "password", type: "password", label: "密码".split("") },
];

// Turnstile 状态
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const turnstileEl = ref<HTMLElement | null>(null);
const turnstileToken = ref<string | null>(null);
const turnstileError = ref<string | null>(null);
let turnstileWidgetId: string | null = null;

/* 浏览器自动填充兼容逻辑 */
const syncAutofillToModel = (): void => {
  // 直接通过 ID 获取，省去了声明冗余的 ref
  const uInput = document.getElementById("username") as HTMLInputElement | null;
  const pInput = document.getElementById("password") as HTMLInputElement | null;

  if (uInput?.value && !form.value.username) form.value.username = uInput.value;
  if (pInput?.value && !form.value.password) form.value.password = pInput.value;
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

  // 处理浏览器自动填充
  syncAutofillToModel();
  window.setTimeout(syncAutofillToModel, 50);
  window.setTimeout(syncAutofillToModel, 250);

  // 初始化标题动画
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
});

/* 登录提交逻辑 */
const handleLogin = async () => {
  if (!turnstileToken.value) {
    turnstileError.value = "请先完成真人验证";
    return;
  }
  loading.value = true;
  try {
    const loginData = await apiPost<any>("/api/login", {
      username: form.value.username,
      password: form.value.password,
      turnstileToken: turnstileToken.value,
    });

    userStore.setCurrentUser({
      id: loginData.user.id,
      username: loginData.user.username,
      nickname: loginData.user.nickname || loginData.user.username,
      avatar: loginData.user.avatarUrl || undefined,
      status: "online",
      lastOnline: Date.now(),
    });
    userStore.setToken(loginData.token);
    wsManager.setToken(loginData.token);
    
    await connect();
    router.push("/chat");
    
  } catch (error) {
    console.error("登录失败:", error);
    turnstileError.value = "登录失败，请重新完成验证";
    turnstileToken.value = null;
    if (turnstileWidgetId && window.turnstile) window.turnstile.reset(turnstileWidgetId);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* 核心响应式修复：min-height 替代 height，加入 padding 允许上下滚动 */
.login-container {
  min-height: 100vh;
  width: 100vw;
  padding: 40px 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  color: #111;
  background:
    radial-gradient(900px circle at 20% 15%, rgba(0, 1, 240, 0.1), transparent 60%),
    radial-gradient(700px circle at 85% 30%, rgba(66, 184, 131, 0.1), transparent 55%),
    radial-gradient(800px circle at 50% 95%, rgba(17, 17, 17, 0.06), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, #f6f7fb 100%);
}

.login-container::before, .login-container::after {
  content: "";
  position: absolute;
  inset: -40% -30%;
  background: radial-gradient(closest-side, rgba(0, 1, 240, 0.12), transparent 70%);
  filter: blur(28px);
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
}

.login-container::after {
  inset: -30% -40%;
  background: radial-gradient(closest-side, rgba(66, 184, 131, 0.12), transparent 70%);
  opacity: 0.45;
}

#animation, .login-form-wrapper {
  position: relative;
  z-index: 1;
}

/* 动态计算标题大小：自适应小屏幕 */
#animation .text-xl {
  font-size: clamp(1.8rem, 5vw, 3rem);
  color: currentColor;
  letter-spacing: 0.06em;
}
#animation { margin-bottom: 20px; }

/* 调整了圆角，与注册页统一视觉风格 */
.login-form-wrapper {
  width: 100%;
  max-width: 400px;
  background-color: rgba(255, 255, 255, 0.85);
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
}

.login-title { text-align: center; margin-bottom: 25px; color: #333; font-size: 24px; font-weight: 600; }
.login-form { display: flex; flex-direction: column; gap: 18px; }

/* 表单特效区 */
.form-control { position: relative; width: 100%; margin: 0; }
.form-control .form-input {
  background-color: transparent; border: 0; border-bottom: 2px #f5f5f5 solid;
  display: block; width: 100%; padding: 25px 0 10px; font-size: 16px; color: #222;
  transition: border-color 0.3s;
}
.form-control .form-input:focus, .form-control .form-input:valid { outline: 0; border-bottom-color: #111; }
.form-control label { position: absolute; top: 21px; left: 0; pointer-events: none; }
.form-control label span {
  display: inline-block; font-size: 16px; min-width: 5px; color: #666;
  transition: 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
.form-control .form-input:focus + label span, 
.form-control .form-input:valid + label span,
.form-control .form-input:-webkit-autofill + label span {
  color: #111; transform: translateY(-32px); font-size: 14px;
}

/* 登录按钮 */
.login-button {
  background-color: rgba(0, 1, 240, 0.08); color: #0001f0; border: none; cursor: pointer;
  border-radius: 8px; width: 100%; height: 45px; transition: 0.3s; font-size: 16px; font-weight: 500;
  display: flex; align-items: center; justify-content: center; position: relative;
  margin-top: 10px;
}
.login-button.loading { background-color: #0001f0; color: #fff; }
.login-button.loading .button-text { opacity: 0; }
.login-button.loading::after {
  content: ""; position: absolute; width: 18px; height: 18px;
  border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.45); border-top-color: #fff;
  animation: loginButtonSpin 0.8s linear infinite;
}
@keyframes loginButtonSpin { to { transform: rotate(360deg); } }
.login-button:hover:not(:disabled) { background-color: #0001f0; box-shadow: 0 4px 12px rgba(0, 1, 240, 0.3); color: #fff; }
.login-button:disabled { background-color: #a5a9ff; cursor: not-allowed; color: #fff; }

/* 底部区域响应式修复：使用 flex-wrap 允许小屏幕折行 */
.footer-turnstile-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap; /* 核心修改：允许折叠 */
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}
.form-footer { font-size: 14px; color: #666; line-height: 1.5; }
.register-link { color: #0001f0; text-decoration: none; font-weight: 600; }
.register-link:hover { text-decoration: underline; }
.turnstile-row { display: flex; flex-direction: column; align-items: flex-end; }
.turnstile-error { margin-top: 5px; font-size: 12px; color: #ff5252; text-align: right; }
</style>
