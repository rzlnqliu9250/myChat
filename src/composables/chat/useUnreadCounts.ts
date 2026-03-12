import { ref } from "vue";

export function useUnreadCounts() {
  const unreadCounts = ref<Record<string, number>>({});

  const conversationKey = (type: "friend" | "group", id: string): string => {
    return `${type}:${id}`;
  };

  const incrementUnread = (key: string): void => {
    unreadCounts.value = {
      ...unreadCounts.value,
      [key]: (unreadCounts.value[key] || 0) + 1,
    };
  };

  const clearUnread = (key: string): void => {
    if (!unreadCounts.value[key]) {
      return;
    }
    const { [key]: _removed, ...rest } = unreadCounts.value;
    unreadCounts.value = rest;
  };

  return {
    unreadCounts,
    conversationKey,
    incrementUnread,
    clearUnread,
  };
}
