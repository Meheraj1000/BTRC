import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { emitToUser } from "../lib/socket.js";
import { cityFromPayload, isPlaceScopedPolice } from "../utils/policeArea.js";

export async function notifyUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
}) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
    },
  });
  try {
    emitToUser(input.userId, "notification:new", row);
  } catch {
    // socket may not be up during tests
  }
  return row;
}

export async function notifyRoles(
  roles: Array<"SUPER_ADMIN" | "GOVERNMENT" | "POLICE" | "BRTA" | "TRANSPORT_OWNER">,
  input: Omit<Parameters<typeof notifyUser>[0], "userId">,
) {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, userRoles: { some: { role: { code: { in: roles } } } } },
    select: {
      id: true,
      policeAreas: { select: { city: true } },
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });
  const place = roles.includes("POLICE") ? await cityFromPayload(input.payload) : null;
  await Promise.all(users.map((user) => {
    const codes = user.userRoles.map((row) => row.role.code);
    if (isPlaceScopedPolice(codes)) {
      const allowed = user.policeAreas.some((area) => place && area.city.toLowerCase() === place.toLowerCase());
      if (!allowed) return undefined;
    }
    return notifyUser({ ...input, userId: user.id });
  }));
}

export async function notifyCompanyOwner(
  companyId: string | null | undefined,
  input: Omit<Parameters<typeof notifyUser>[0], "userId">,
) {
  if (!companyId) return;
  const company = await prisma.transportCompany.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { ownerUserId: true },
  });
  if (company?.ownerUserId) {
    await notifyUser({ ...input, userId: company.ownerUserId });
  }
}
