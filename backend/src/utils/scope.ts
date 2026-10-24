import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../lib/apiResponse.js";
import { policeCityScope } from "./policeArea.js";

export async function ownerCompanyId(req: Request): Promise<string | undefined> {
  if (!req.user?.roles.includes("TRANSPORT_OWNER")) return undefined;
  const company = await prisma.transportCompany.findFirst({
    where: { ownerUserId: req.user.id, deletedAt: null },
  });
  if (!company) throw new ApiError("No transport company is linked to this owner account", 403);
  return company.id;
}

export async function assertOwnerScope(req: Request, companyId: string | null | undefined) {
  const ownerCompany = await ownerCompanyId(req);
  if (ownerCompany && companyId !== ownerCompany) {
    throw new ApiError("You cannot access another operator's resources", 403);
  }
}

export async function requestScope(req: Request) {
  const companyId = await ownerCompanyId(req);
  const cities = await policeCityScope(req);
  return {
    companyId,
    roles: req.user?.roles ?? [],
    cities: cities ?? undefined,
  };
}

export function pagination(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
