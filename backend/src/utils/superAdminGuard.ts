import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";

export async function assertNotLastActiveSuperAdmin(userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });
  if (!target?.userRoles.some((r) => r.role.code === "SUPER_ADMIN")) return;
  const others = await prisma.user.count({
    where: {
      id: { not: userId },
      deletedAt: null,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "SUPER_ADMIN" } } },
    },
  });
  if (others === 0) {
    throw new ApiError("Cannot remove or deactivate the last active Super Admin", 409);
  }
}

export async function revokeRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
