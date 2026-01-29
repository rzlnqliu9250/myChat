import { ref } from "vue";

export function useUnreadCounts() {
  const unreadCounts = ref<Record<string, number>>({});

  const incrementUnread = (friendId: string): void => {
    unreadCounts.value = {
      ...unreadCounts.value,
      [friendId]: (unreadCounts.value[friendId] || 0) + 1,
    };
  };

  const clearUnread = (friendId: string): void => {
    if (!unreadCounts.value[friendId]) {
      return;
    }
    const { [friendId]: _removed, ...rest } = unreadCounts.value;
    unreadCounts.value = rest;
  };

  return {
    unreadCounts,
    incrementUnread,
    clearUnread,
  };
}
