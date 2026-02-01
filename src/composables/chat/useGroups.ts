import { ref } from "vue";
import { apiGet, apiPost } from "../../services/api";
import type { UiGroup } from "../../types/chat";

export function useGroups(getToken: () => string | null) {
  const groups = ref<UiGroup[]>([]);

  const fetchGroups = async (): Promise<void> => {
    const token = getToken();
    if (!token) {
      groups.value = [];
      return;
    }

    const data = await apiGet<{ groups: UiGroup[] }>("/api/groups", token);
    groups.value = (data.groups || []).map((g) => ({
      id: String(g.id),
      name: g.name,
      ownerId: g.ownerId,
      avatarUrl: g.avatarUrl ?? null,
      createdAt: g.createdAt,
    }));
  };

  const createGroup = async (payload: {
    name: string;
    memberIds: string[];
  }): Promise<UiGroup> => {
    const token = getToken();
    if (!token) {
      throw new Error("未登录");
    }

    const data = await apiPost<{ group: UiGroup }>(
      "/api/groups",
      {
        name: payload.name,
        memberIds: payload.memberIds,
      },
      token,
    );

    const g = data.group;
    const ui: UiGroup = {
      id: String(g.id),
      name: g.name,
      ownerId: g.ownerId,
      avatarUrl: g.avatarUrl ?? null,
      createdAt: g.createdAt,
    };

    groups.value = [ui, ...groups.value.filter((x) => x.id !== ui.id)];
    return ui;
  };

  return {
    groups,
    fetchGroups,
    createGroup,
  };
}
