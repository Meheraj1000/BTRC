export type SocketIdentity = {
  sub?: string;
  roles?: string[];
  companyId?: string | null;
};

export function canJoinSocketRoom(room: string, user?: SocketIdentity | null) {
  if (room === "public:buses") return true;
  if (!user?.sub) return false;
  if (room.startsWith("role:")) return Boolean(user.roles?.includes(room.slice(5)));
  if (room.startsWith("user:")) return room === `user:${user.sub}`;
  if (room.startsWith("company:")) {
    if (user.roles?.includes("SUPER_ADMIN")) return true;
    return Boolean(user.companyId && room === `company:${user.companyId}`);
  }
  return false;
}
