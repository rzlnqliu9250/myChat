import { createRouter, createWebHistory } from "vue-router";
import Login from "../pages/Login.vue";
import Register from "../pages/Register.vue";
import Chat from "../pages/Chat.vue";
import { useUserStore } from "../stores/userStore";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/login",
    },
    {
      path: "/login",
      name: "Login",
      component: Login,
      meta: { requiresAuth: false },
    },
    {
      path: "/register",
      name: "Register",
      component: Register,
      meta: { requiresAuth: false },
    },
    {
      path: "/chat",
      name: "Chat",
      component: Chat,
      meta: { requiresAuth: true },
    },
  ],
});

// 路由守卫：检查用户是否已登录
router.beforeEach((to, _, next) => {
  const userStore = useUserStore();
  const requiresAuth = to.meta.requiresAuth;
  const isLoggedIn = userStore.isLoggedIn;

  if (requiresAuth && !isLoggedIn) {
    next("/login");
  } else {
    next();
  }
});

export default router;
