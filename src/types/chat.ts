export type ApiFriend = {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  online: boolean;
};

export type UiFriend = {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  status: "online" | "offline";
};

export type UiGroup = {
  id: string;
  name: string;
  ownerId: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type IncomingRequest = {
  id: string;
  fromUser: {
    id: string;
    username: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  status: string;
};
