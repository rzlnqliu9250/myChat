
/**
 * 处理滚动消息到最底部
 * 组合式函数：滚动到聊天消息的最底部，保持消息顺序。
 */
import { nextTick, type Ref } from "vue";

export function useScrollMessagesToBottom(container: Ref<HTMLElement | null>) {
  const scrollMessagesToBottom = async (
    behavior: ScrollBehavior = "auto",
  ): Promise<void> => {
    await nextTick();
    const el = container.value;
    if (!el) {
      return;
    }

    try {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  return {
    scrollMessagesToBottom,
  };
}
