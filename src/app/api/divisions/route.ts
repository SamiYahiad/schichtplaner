import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentMember, isAdminOrAbove } from "@/lib/auth-helpers";

// GET /api/divisions - List all divisions for the current org
export async function GET() {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  const divisions = await db.division.findMany({
    where: {
      organizationId: member.organizationId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: { members: true },
      },
    },
    orderBy: [
      { isSystem: "desc" }, // System division "Alle" always first
      { createdAt: "asc" },
    ],
  });

  const result = divisions.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    color: d.color,
    isSystem: d.isSystem,
    memberCount: d._count.members,
    createdAt: d.createdAt,
  }));

  return NextResponse.json({ divisions: result });
}

// POST /api/divisions - Create a new division
function buildCreateDivisionSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t("errors.titleRequired")).max(100, t("errors.titleTooLong")),
    description: z.string().max(500).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t("errors.invalidColor")),
  });
}

export async function POST(request: NextRequest) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const createDivisionSchema = buildCreateDivisionSchema(t);
  const parsed = createDivisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const division = await db.division.create({
    data: {
      organizationId: member.organizationId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      color: parsed.data.color,
    },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  return NextResponse.json(
    {
      division: {
        id: division.id,
        title: division.title,
        description: division.description,
        color: division.color,
        isSystem: division.isSystem,
        memberCount: division._count.members,
        createdAt: division.createdAt,
      },
    },
    { status: 201 }
  );
}
