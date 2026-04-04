
/**
 * 处理用户头像上传
 * 组合式函数：上传用户选择的文件到服务器，更新用户头像。
 */
import { apiRequest } from "../../services/api";

export function useAvatarUpload(userStore: {
  token: string | null;
  currentUser: any;
  setCurrentUser: (user: any) => void;
}) {
  const handleAvatarSelected = async (file: File): Promise<void> => {
    const token = userStore.token;
    if (!token) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    const form = new FormData();
    form.append("file", file);

    try {
      const resp = await apiRequest<{ url: string }>(
        "/api/upload/avatar",
        {
          method: "POST",
          body: form,
        },
        token,
      );

      if (userStore.currentUser) {
        userStore.setCurrentUser({
          ...userStore.currentUser,
          avatar: resp.url,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    handleAvatarSelected,
  };
}
