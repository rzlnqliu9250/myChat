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
