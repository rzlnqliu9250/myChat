import { ref } from "vue";
import { apiGet } from "../../services/api";
import type { ApiFriend, UiFriend } from "../../types/chat";

export function useFriends(
  getToken: () => string | null,
  setStoreFriends: (friends: UiFriend[]) => void,
) {
  const friends = ref<UiFriend[]>([]);

  const fetchFriends = async (): Promise<void> => {
    const token = getToken();
    if (!token) {
      return;
    }

    let data: { friends: ApiFriend[] };
    try {
      data = await apiGet<{ friends: ApiFriend[] }>("/api/friends", token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      throw new Error(msg && msg !== "请求失败" ? msg : "加载好友失败");
    }

    friends.value = (data.friends || []).map((f) => ({
      id: f.id,
      username: f.username,
      nickname: f.nickname,
      avatarUrl: f.avatarUrl,
      status: f.online ? ("online" as const) : ("offline" as const),
    }));

    setStoreFriends(friends.value);
  };

  return {
    friends,
    fetchFriends,
  };
}
