/**
 * 处理聊天消息
 * 组合式函数：管理聊天消息的显示、发送、接收等。
 */
import { ref, type ComputedRef, type Ref } from "vue";
import { apiGet, apiPost, apiRequest } from "../../services/api";
import type { Message } from "../../models/Message";
import type { MessageStatusValue } from "../../models/Message";
import type { UiFriend, UiGroup } from "../../types/chat";
import { WebSocketEvent } from "../../models/WebSocket";

function mapHistoryStatus(params: {
  senderId: string;
  meId: string;
  isRead?: boolean;
  isDelivered?: boolean;
}): MessageStatusValue {
  if (params.senderId !== params.meId) {
    return "delivered";
  }
  if (params.isRead) {
    return "read";
  }
  if (params.isDelivered === true) {
    return "delivered";
  }
  if (params.isDelivered === false) {
    return "sent";
  }
  return "delivered";
}

async function applyFavoritesToMessages(params: {
  token: string;
  messages: Message[];
}): Promise<void> {
  const { token } = params;
  const list = params.messages;
  if (!list.length) {
    return;
  }

  const ids = Array.from(
    new Set(
      list
        .map((m) => String(m.id))
        .filter((id) => /^\d+$/.test(id)),
    ),
  );

  if (!ids.length) {
    return;
  }

  const data = await apiRequest<{
    favorites: Record<string, boolean>;
  }>(
    "/api/favorites/status",
    {
      method: "POST",
      body: JSON.stringify({ messageIds: ids.map((v) => Number(v)) }),
    },
    token,
  );

  const favorites = data?.favorites || {};
  list.forEach((m) => {
    const key = String(m.id);
    if (Object.prototype.hasOwnProperty.call(favorites, key)) {
      m.isFavorited = Boolean(favorites[key]);
    }
  });
}

export function useChatMessages(options: {
  // getToken/currentUser/selectedFriend/selectedGroup/friends 等依赖由 Chat.vue 传入。
  // 这样这个 composable 不依赖全局 store：更容易复用/测试。
  getToken: () => string | null;
  currentUser: ComputedRef<{ id: string } | null>;
  selectedFriend: Ref<UiFriend | null>;
  selectedGroup: Ref<UiGroup | null>;
  friends: Ref<UiFriend[]>;
  scrollMessagesToBottom: (behavior?: ScrollBehavior) => Promise<void>;
  conversationKey: (type: "friend" | "group", id: string) => string;
  incrementUnread: (key: string) => void;
  maybeNotifyDesktop: (friendId: string, preview: string) => void;
  // send: 底层是 WebSocketManager.send(type, data)
  // 这里仅关心协议层（type/data），不关心 ws 如何重连/心跳。
  send: <T>(type: any, data: T) => void;
}) {
  // messages 是当前“会话窗口”的消息列表：
  // - 单聊：selectedFriend 的会话消息
  // - 群聊：selectedGroup 的会话消息
  // Chat.vue 会在切换会话时调用 fetchMessages/fetchGroupMessages 来刷新它。
  const messages = ref<Message[]>([]);

  const markFriendMessagesAsRead = async (friendId: string): Promise<void> => {
    const token = options.getToken();
    if (!token || !friendId) {
      return;
    }

    try {
      await apiPost<{ messageIds: string[] }>(
        "/api/messages/read",
        { friendId },
        token,
      );
    } catch {
      // ignore
    }
  };

  const fetchMessages = async (friendId: string): Promise<void> => {
    const token = options.getToken();
    if (!token) {
      return;
    }

    // 约定后端返回的字段：这里显式声明 data 的 shape，方便 TS 推导。
    let data: {
      messages: {
        id: string;
        senderId: string;
        senderNickname?: string | null;
        senderAvatarUrl?: string | null;
        receiverId: string | null;
        groupId?: string | null;
        content: string;
        type?: string;
        mediaUrl?: string | null;
        mediaMime?: string | null;
        mediaSize?: number | null;
        isRead: boolean;
        isDelivered?: boolean;
        createdAt: string;
      }[];
    };

    try {
      data = await apiGet<typeof data>(`/api/messages/${friendId}`, token);
    } catch (e) {
      // 这里把网络层/解析层的错误统一转换成对用户友好的文案。
      const msg = e instanceof Error ? e.message : "";
      throw new Error(msg && msg !== "请求失败" ? msg : "加载聊天记录失败");
    }

    // 把后端的 message DTO 映射为前端 UI Message：
    // - createdAt 字符串转成时间戳
    // - isRead / isDelivered 映射到发送方可见的 status
    // 注意：历史消息是“权威数据源”，这里会直接覆盖 messages。
    const meId = options.currentUser.value?.id || "";
    messages.value = (data.messages || []).map((m) => {
      const ts = new Date(m.createdAt).getTime();
      return {
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId ?? null,
        groupId: (m as any).groupId ?? null,
        content: m.content,
        type: ((m.type as any) || "text") as any,
        mediaUrl: m.mediaUrl ?? null,
        mediaMime: m.mediaMime ?? null,
        mediaSize: m.mediaSize ?? null,
        status: mapHistoryStatus({
          senderId: m.senderId,
          meId,
          isRead: m.isRead,
          isDelivered: m.isDelivered,
        }),
        createTime: ts,
        updateTime: ts,
      } satisfies Message;
    });

    try {
      await applyFavoritesToMessages({ token, messages: messages.value });
    } catch {
      // ignore
    }

    void options.scrollMessagesToBottom();
    void markFriendMessagesAsRead(friendId);
  };

  const searchMessages = async (params: {
    q: string;
    friendId?: string;
    groupId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<Message[]> => {
    const token = options.getToken();
    if (!token) {
      return [];
    }

    const q = typeof params.q === "string" ? params.q.trim() : "";
    if (!q) {
      return [];
    }

    const friendId =
      typeof params.friendId === "string" && params.friendId
        ? params.friendId
        : undefined;
    const groupId =
      typeof params.groupId === "string" && params.groupId
        ? params.groupId
        : undefined;

    if ((!friendId && !groupId) || (friendId && groupId)) {
      return [];
    }

    const limit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.min(200, Math.max(1, params.limit))
        : 50;
    const offset =
      typeof params.offset === "number" && Number.isFinite(params.offset)
        ? Math.max(0, params.offset)
        : 0;

    const query = new URLSearchParams();
    query.set("q", q);
    if (friendId) query.set("friendId", friendId);
    if (groupId) query.set("groupId", groupId);
    query.set("limit", String(limit));
    query.set("offset", String(offset));
    if (typeof params.from === "string" && params.from.trim()) {
      query.set("from", params.from.trim());
    }
    if (typeof params.to === "string" && params.to.trim()) {
      query.set("to", params.to.trim());
    }

    let data: {
      messages: {
        id: string;
        senderId: string;
        senderNickname?: string | null;
        senderAvatarUrl?: string | null;
        receiverId: string | null;
        groupId?: string | null;
        content: string;
        type?: string;
        mediaUrl?: string | null;
        mediaMime?: string | null;
        mediaSize?: number | null;
        isRead: boolean;
        isDelivered?: boolean;
        createdAt: string;
      }[];
    };

    try {
      data = await apiGet<typeof data>(`/api/messages/search?${query.toString()}`, token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      throw new Error(msg && msg !== "请求失败" ? msg : "搜索聊天记录失败");
    }

    const meId = options.currentUser.value?.id || "";
    return (data.messages || []).map((m) => {
      const ts = new Date(m.createdAt).getTime();
      return {
        id: m.id,
        senderId: m.senderId,
        senderNickname:
          m.senderNickname !== undefined ? m.senderNickname : null,
        senderAvatarUrl:
          m.senderAvatarUrl !== undefined ? m.senderAvatarUrl : null,
        receiverId: m.receiverId ?? null,
        groupId: (m as any).groupId ?? null,
        content: m.content,
        type: ((m.type as any) || "text") as any,
        mediaUrl: m.mediaUrl ?? null,
        mediaMime: m.mediaMime ?? null,
        mediaSize: m.mediaSize ?? null,
        status: mapHistoryStatus({
          senderId: m.senderId,
          meId,
          isRead: m.isRead,
          isDelivered: m.isDelivered,
        }),
        createTime: ts,
        updateTime: ts,
      } satisfies Message;
    });
  };

  const fetchGroupMessages = async (groupId: string): Promise<void> => {
    const token = options.getToken();
    if (!token) {
      return;
    }

    // 群消息与单聊类似，只是多了 senderNickname/avatar 等展示字段。
    let data: {
      messages: {
        id: string;
        senderId: string;
        receiverId: string | null;
        groupId?: string | null;
        content: string;
        type?: string;
        mediaUrl?: string | null;
        mediaMime?: string | null;
        mediaSize?: number | null;
        isRead: boolean;
        isDelivered?: boolean;
        createdAt: string;
      }[];
    };

    try {
      data = await apiGet<typeof data>(
        `/api/groups/${groupId}/messages`,
        token,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      throw new Error(msg && msg !== "请求失败" ? msg : "加载群消息失败");
    }

    // 同样将后端 DTO 映射为 UI Message。
    messages.value = (data.messages || []).map((m) => {
      const ts = new Date(m.createdAt).getTime();
      return {
        id: m.id,
        senderId: m.senderId,
        senderNickname:
          (m as any).senderNickname !== undefined
            ? (m as any).senderNickname
            : null,
        senderAvatarUrl:
          (m as any).senderAvatarUrl !== undefined
            ? (m as any).senderAvatarUrl
            : null,
        receiverId: null,
        groupId: (m as any).groupId ?? groupId,
        content: m.content,
        type: ((m.type as any) || "text") as any,
        mediaUrl: m.mediaUrl ?? null,
        mediaMime: m.mediaMime ?? null,
        mediaSize: m.mediaSize ?? null,
        status: m.isRead ? ("read" as const) : ("delivered" as const),
        createTime: ts,
        updateTime: ts,
      } satisfies Message;
    });

    try {
      await applyFavoritesToMessages({ token, messages: messages.value });
    } catch {
      // ignore
    }

    void options.scrollMessagesToBottom();
  };

  const handleSendMessage = (content: string): void => {
    const me = options.currentUser.value;
    if (!me) {
      return;
    }

    const group = options.selectedGroup.value;
    const friend = options.selectedFriend.value;
    if (!group && !friend) {
      return;
    }

    // clientMessageId：客户端生成的“临时消息 id”。
    // 目的：
    // 1) 本地先乐观插入一条 sending 消息时，用它作为主键
    // 2) 服务端回执会原样带回 clientMessageId，前端据此把本地消息更新为正式消息
    // 这能避免：服务端回执到达时无法匹配本地消息，从而产生重复 push。
    const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // 构造本地消息（乐观 UI）：
    // - id 暂时用 clientMessageId
    // - status 先置为 sending
    // - createTime/updateTime 使用本地时间（后续会被服务端回执覆盖/校正）
    const message: Message = group
      ? {
          id: clientMessageId,
          senderId: me.id,
          receiverId: null,
          groupId: group.id,
          content: content,
          type: "text" as const,
          status: "sending" as const,
          createTime: Date.now(),
          updateTime: Date.now(),
        }
      : {
          id: clientMessageId,
          senderId: me.id,
          receiverId: friend!.id,
          groupId: null,
          content: content,
          type: "text" as const,
          status: "sending" as const,
          createTime: Date.now(),
          updateTime: Date.now(),
        };

    // 立刻插入列表，让用户立刻看到“我发出去了”
    messages.value.push(message);
    void options.scrollMessagesToBottom("smooth");

    // 通过 WebSocket 发送到后端。
    // 这里的事件名虽然叫 MESSAGE_RECEIVE，但语义是“发消息”（服务端也用这个事件做回执/转发）。
    if (group) {
      options.send(WebSocketEvent.MESSAGE_RECEIVE as any, {
        clientMessageId,
        content: content,
        groupId: group.id,
        type: "text",
      });
    } else {
      options.send(WebSocketEvent.MESSAGE_RECEIVE as any, {
        clientMessageId,
        content: content,
        receiverId: friend!.id,
        type: "text",
      });
    }
  };

  const handleSendMedia = async (file: File): Promise<void> => {
    const me = options.currentUser.value;
    const friend = options.selectedFriend.value;
    const group = options.selectedGroup.value;
    if ((!friend && !group) || !me) {
      return;
    }

    const token = options.getToken();
    if (!token) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return;
    }

    // 媒体消息分两阶段：
    // 1) 本地先插入一个带预览图的 sending 消息（使用 blob URL）
    // 2) 先走 HTTP 上传拿到真实 URL，再通过 WS 发“媒体消息”给服务端落库与转发
    const msgType = isImage ? ("image" as const) : ("video" as const);
    const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const previewUrl = URL.createObjectURL(file);

    // localMsg 是“占位消息”：
    // - mediaUrl 先用预览 url（blob:...）
    // - 上传成功后会把 mediaUrl 替换为服务端返回的 cdn/存储 url
    const localMsg: Message = group
      ? {
          id: clientMessageId,
          senderId: me.id,
          receiverId: null,
          groupId: group.id,
          content: "",
          type: msgType,
          mediaUrl: previewUrl,
          mediaMime: file.type,
          mediaSize: file.size,
          status: "sending" as const,
          createTime: Date.now(),
          updateTime: Date.now(),
        }
      : {
          id: clientMessageId,
          senderId: me.id,
          receiverId: friend!.id,
          groupId: null,
          content: "",
          type: msgType,
          mediaUrl: previewUrl,
          mediaMime: file.type,
          mediaSize: file.size,
          status: "sending" as const,
          createTime: Date.now(),
          updateTime: Date.now(),
        };

    messages.value.push(localMsg);
    void options.scrollMessagesToBottom("smooth");

    const form = new FormData();
    form.append("file", file);

    try {
      // 上传媒体走 HTTP（比 WS 传 binary 更简单稳定，也便于接入对象存储）。
      const uploadResp = await apiRequest<{
        url: string;
        mime: string;
        size: number;
      }>(
        "/api/upload/chat-media",
        {
          method: "POST",
          body: form,
        },
        token,
      );

      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // ignore
      }

      // 用 clientMessageId 找到本地消息，把预览信息更新为真实 URL。
      // 注意：此时仍保持 status=sending，等待 WS 回执更新为 sent/delivered。
      const idx = messages.value.findIndex((m) => m.id === clientMessageId);
      if (idx >= 0) {
        const existing = messages.value[idx];
        if (existing) {
          messages.value[idx] = {
            ...existing,
            mediaUrl: uploadResp.url,
            mediaMime: uploadResp.mime,
            mediaSize: uploadResp.size,
          };
        }
      }

      // 上传成功后，通过 WS 把媒体消息发送给后端：
      // - mediaUrl/mime/size 用上传返回
      // - content 对于媒体消息为空字符串
      if (group) {
        options.send(WebSocketEvent.MESSAGE_RECEIVE as any, {
          clientMessageId,
          groupId: group.id,
          content: "",
          type: msgType,
          mediaUrl: uploadResp.url,
          mediaMime: uploadResp.mime,
          mediaSize: uploadResp.size,
        });
      } else {
        options.send(WebSocketEvent.MESSAGE_RECEIVE as any, {
          clientMessageId,
          receiverId: friend!.id,
          content: "",
          type: msgType,
          mediaUrl: uploadResp.url,
          mediaMime: uploadResp.mime,
          mediaSize: uploadResp.size,
        });
      }
    } catch (err) {
      // 上传失败：本地消息标记 failed。
      // 这是纯前端失败，不会有后端回执。
      const idx = messages.value.findIndex((m) => m.id === clientMessageId);
      if (idx >= 0) {
        const existing = messages.value[idx];
        if (existing) {
          messages.value[idx] = {
            ...existing,
            status: "failed" as const,
            updateTime: Date.now(),
          };
        }
      }
      console.error(err);
    }
  };

  const handleMessageReceive = (message: any): void => {
    if (!message) {
      return;
    }

    // 这里处理服务端推送的 MESSAGE_RECEIVE。
    // 注意：服务端对“发消息”和“回执/转发”都复用了同一个事件名。
    // 因此前端要根据 message.senderId / receiverId / clientMessageId 来区分场景：
    // - 我自己发出的消息回执：带 clientMessageId 且 senderId==me
    // - 对方发来的新消息：senderId!=me 并且属于当前会话
    // - 非当前会话：不追加，只累计未读并做桌面通知
    if (message.groupId) {
      const me = options.currentUser.value?.id;
      const groupId = options.selectedGroup.value?.id;
      const incomingGroupId = String(message.groupId);

      // 群聊：如果是我发出的消息回执（senderId==me），则用 clientMessageId 更新本地 sending。
      if (message.clientMessageId && me && message.senderId === me) {
        const idx = messages.value.findIndex(
          (m) => m.id === message.clientMessageId,
        );
        if (idx >= 0) {
          const existing = messages.value[idx];
          if (!existing) {
            return;
          }

          messages.value[idx] = {
            ...existing,
            // 把临时 id 替换成服务端生成的正式 id（用于后续唯一标识/渲染 key）
            id: String(message.id),
            status: message.status || existing.status,
            updateTime: message.updateTime || Date.now(),
          };
        }
      }

      // 群聊：只有“当前正在看的群”才追加消息。
      // 如果是我自己发的，前面已经走回执更新，所以这里要避免重复 push。
      if (groupId && incomingGroupId === String(groupId)) {
        if (!me || message.senderId !== me) {
          messages.value.push({
            id: String(message.id),
            senderId: message.senderId,
            senderNickname:
              message.senderNickname !== undefined
                ? message.senderNickname
                : null,
            senderAvatarUrl:
              message.senderAvatarUrl !== undefined
                ? message.senderAvatarUrl
                : null,
            receiverId: null,
            groupId: String(message.groupId),
            content: message.content,
            type: (message.type || "text") as any,
            mediaUrl: message.mediaUrl ?? null,
            mediaMime: message.mediaMime ?? null,
            mediaSize: message.mediaSize ?? null,
            status: (message.status || "delivered") as any,
            createTime: message.createTime || Date.now(),
            updateTime: message.updateTime || Date.now(),
          });
          void options.scrollMessagesToBottom("smooth");
        }
      } else {
        if (me && message.senderId && String(message.senderId) !== String(me)) {
          options.incrementUnread(options.conversationKey("group", incomingGroupId));
        }
      }
      return;
    }

    const me = options.currentUser.value?.id;
    const friendId = options.selectedFriend.value?.id;

    // 如果是我发出的消息回执：用 clientMessageId 找到本地 sending 消息并更新
    if (message.clientMessageId && me && message.senderId === me) {
      const idx = messages.value.findIndex(
        (m) => m.id === message.clientMessageId,
      );
      if (idx >= 0) {
        const existing = messages.value[idx];
        if (!existing) {
          return;
        }

        messages.value[idx] = {
          ...existing,
          // 把临时 id 替换成服务端正式 id
          id: String(message.id),
          // 回执里可能带回 content/type/media*（媒体消息场景），这里做兼容合并
          content:
            typeof message.content === "string"
              ? message.content
              : existing.content,
          type: (message.type || existing.type) as any,
          mediaUrl:
            message.mediaUrl !== undefined
              ? message.mediaUrl
              : existing.mediaUrl,
          mediaMime:
            message.mediaMime !== undefined
              ? message.mediaMime
              : existing.mediaMime,
          mediaSize:
            message.mediaSize !== undefined
              ? message.mediaSize
              : existing.mediaSize,
          status: message.status || existing.status,
          updateTime: message.updateTime || Date.now(),
        };
        void options.scrollMessagesToBottom("smooth");
        return;
      }

      return;
    }

    // 其他情况：服务端推送来的“真实消息”。
    // 只有属于当前会话才追加到 messages，否则只做未读累计/通知。
    const isCurrentConversation =
      me &&
      friendId &&
      ((message.senderId === friendId && message.receiverId === me) ||
        (message.senderId === me && message.receiverId === friendId));

    if (isCurrentConversation) {
      messages.value.push({
        id: String(message.id),
        senderId: message.senderId,
        receiverId: message.receiverId ?? null,
        groupId: null,
        content: message.content,
        type: (message.type || "text") as any,
        mediaUrl: message.mediaUrl ?? null,
        mediaMime: message.mediaMime ?? null,
        mediaSize: message.mediaSize ?? null,
        status: (message.status || "delivered") as any,
        createTime: message.createTime || Date.now(),
        updateTime: message.updateTime || Date.now(),
      });
      void options.scrollMessagesToBottom("smooth");

      if (message.senderId === friendId) {
        void markFriendMessagesAsRead(String(friendId));
      }
    }

    if (
      me &&
      message.receiverId === me &&
      message.senderId &&
      message.senderId !== me
    ) {
      // 非当前会话的消息：更新未读 + 桌面通知
      const incomingFriendId = String(message.senderId);
      if (!isCurrentConversation) {
        options.incrementUnread(options.conversationKey("friend", incomingFriendId));
      }
      const preview =
        message.type === "image"
          ? "[图片]"
          : message.type === "video"
            ? "[视频]"
            : String(message.content || "");
      options.maybeNotifyDesktop(incomingFriendId, preview);
    }
  };

  const handleMessageRead = (payload: {
    messageIds?: string[];
    readerId?: string;
  }): void => {
    const me = options.currentUser.value?.id;
    if (!me || !Array.isArray(payload.messageIds)) {
      return;
    }

    payload.messageIds.forEach((rawId) => {
      const id = String(rawId);
      const idx = messages.value.findIndex(
        (m) =>
          String(m.id) === id &&
          String(m.senderId) === String(me) &&
          !m.groupId,
      );
      if (idx < 0) {
        return;
      }

      const existing = messages.value[idx];
      if (!existing) {
        return;
      }

      messages.value[idx] = {
        ...existing,
        status: "read",
        updateTime: Date.now(),
      };
    });
  };

  return {
    messages,
    fetchMessages,
    fetchGroupMessages,
    searchMessages,
    handleSendMessage,
    handleSendMedia,
    handleMessageReceive,
    handleMessageRead,
  };
}
