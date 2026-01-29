import { ref } from "vue";
import { apiGet, apiPost } from "../../services/api";
import type { IncomingRequest } from "../../types/chat";

export function useFriendRequests(
  getToken: () => string | null,
  fetchFriends: () => Promise<void>,
) {
  const friendRequestUsername = ref("");
  const friendRequestLoading = ref(false);
  const friendRequestError = ref<string | null>(null);
  const friendRequestSuccess = ref<string | null>(null);

  const incomingRequests = ref<IncomingRequest[]>([]);
  const requestActionLoadingIds = ref(new Set<string>());

  const fetchIncomingRequests = async (): Promise<void> => {
    const token = getToken();
    if (!token) {
      return;
    }

    let data: { requests: IncomingRequest[] };
    try {
      data = await apiGet<{ requests: IncomingRequest[] }>(
        "/api/friends/requests",
        token,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      throw new Error(msg && msg !== "请求失败" ? msg : "加载好友申请失败");
    }

    incomingRequests.value = data.requests || [];
  };

  const sendFriendRequest = async (): Promise<void> => {
    const token = getToken();
    if (!token) {
      return;
    }

    friendRequestLoading.value = true;
    friendRequestError.value = null;
    friendRequestSuccess.value = null;

    try {
      await apiPost<unknown>(
        "/api/friends/request",
        { username: friendRequestUsername.value },
        token,
      );

      friendRequestSuccess.value = "已发送好友申请";
      friendRequestUsername.value = "";
      await fetchIncomingRequests();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      friendRequestError.value =
        msg && msg !== "请求失败" ? msg : "发送好友申请失败";
    } finally {
      friendRequestLoading.value = false;
    }
  };

  const acceptRequest = async (requestId: string): Promise<void> => {
    const token = getToken();
    if (!token) {
      return;
    }

    requestActionLoadingIds.value.add(requestId);
    try {
      await apiPost<unknown>(
        `/api/friends/requests/${requestId}/accept`,
        undefined,
        token,
      );

      await Promise.all([fetchIncomingRequests(), fetchFriends()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      friendRequestError.value = msg && msg !== "请求失败" ? msg : "同意失败";
    } finally {
      requestActionLoadingIds.value.delete(requestId);
    }
  };

  const rejectRequest = async (requestId: string): Promise<void> => {
    const token = getToken();
    if (!token) {
      return;
    }

    requestActionLoadingIds.value.add(requestId);
    try {
      await apiPost<unknown>(
        `/api/friends/requests/${requestId}/reject`,
        undefined,
        token,
      );

      await fetchIncomingRequests();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      friendRequestError.value = msg && msg !== "请求失败" ? msg : "拒绝失败";
    } finally {
      requestActionLoadingIds.value.delete(requestId);
    }
  };

  return {
    friendRequestUsername,
    friendRequestLoading,
    friendRequestError,
    friendRequestSuccess,
    incomingRequests,
    requestActionLoadingIds,
    fetchIncomingRequests,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
  };
}
