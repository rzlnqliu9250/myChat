import { ref, type ComputedRef, type Ref } from "vue";
import { apiGet, apiRequest } from "../../services/api";
import type { Message } from "../../models/Message";
import type { UiFriend, UiGroup } from "../../types/chat";
import { WebSocketEvent } from "../../models/WebSocket";

export function useChatMessages(options: {
  getToken: () => string | null;
  currentUser: ComputedRef<{ id: string } | null>;
  selectedFriend: Ref<UiFriend | null>;
  selectedGroup: Ref<UiGroup | null>;
  friends: Ref<UiFriend[]>;
  scrollMessagesToBottom: (behavior?: ScrollBehavior) => Promise<void>;
  incrementUnread: (friendId: string) => void;
  maybeNotifyDesktop: (friendId: string, preview: string) => void;
  send: <T>(type: any, data: T) => void;
}) {
  const messages = ref<Message[]>([]);

  const fetchMessages = async (friendId: string): Promise<void> => {
    const token = options.getToken();
    if (!token) {
      return;
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
        createdAt: string;
      }[];
    };

    try {
      data = await apiGet<typeof data>(`/api/messages/${friendId}`, token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      throw new Error(msg && msg !== "请求失败" ? msg : "加载聊天记录失败");
    }

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
        status: m.isRead ? ("read" as const) : ("delivered" as const),
        createTime: ts,
        updateTime: ts,
      } satisfies Message;
    });

    void options.scrollMessagesToBottom();
  };

  const fetchGroupMessages = async (groupId: string): Promise<void> => {
    const token = options.getToken();
    if (!token) {
      return;
    }

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

    const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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

    messages.value.push(message);
    void options.scrollMessagesToBottom("smooth");

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

    const msgType = isImage ? ("image" as const) : ("video" as const);
    const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const previewUrl = URL.createObjectURL(file);

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

    if (message.groupId) {
      const me = options.currentUser.value?.id;
      const groupId = options.selectedGroup.value?.id;
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
            id: String(message.id),
            status: message.status || existing.status,
            updateTime: message.updateTime || Date.now(),
          };
        }
      }

      if (groupId && String(message.groupId) === String(groupId)) {
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
          id: String(message.id),
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
        return;
      }
    }

    // 其他情况：如果当前正在跟该好友聊天，则追加
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
    }

    if (
      me &&
      message.receiverId === me &&
      message.senderId &&
      message.senderId !== me
    ) {
      const incomingFriendId = String(message.senderId);
      if (!isCurrentConversation) {
        options.incrementUnread(incomingFriendId);
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

  return {
    messages,
    fetchMessages,
    fetchGroupMessages,
    handleSendMessage,
    handleSendMedia,
    handleMessageReceive,
  };
}
