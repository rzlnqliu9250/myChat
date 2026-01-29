import type { Ref } from "vue";
import type { UiFriend } from "../../types/chat";

export function useDesktopNotify(
  friends: Ref<UiFriend[]>,
  selectFriend: (friend: UiFriend) => Promise<void>,
) {
  const maybeNotifyDesktop = (friendId: string, content: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof Notification === "undefined") {
      return;
    }
    if (!document.hidden) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const friend = friends.value.find((f) => f.id === friendId);
    const title = friend?.nickname || friend?.username || "新消息";
    const body = typeof content === "string" ? content : "";

    try {
      const n = new Notification(title, {
        body,
      });
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          // ignore
        }
        const target = friends.value.find((f) => f.id === friendId);
        if (target) {
          void selectFriend(target);
        }
        try {
          n.close();
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  };

  return {
    maybeNotifyDesktop,
  };
}
