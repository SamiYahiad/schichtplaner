import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentMember, isAdminOrAbove } from "@/lib/auth-helpers";

const updateDivisionSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// PATCH /api/divisions/[id] - Update a division
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  const { id } = await params;

  // Verify division belongs to the org
  const existing = await db.division.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json(
      { error: t("errors.systemDivisionNotEditable") },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const parsed = updateDivisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const division = await db.division.update({
    where: { id },
    data: parsed.data,
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  return NextResponse.json({
    division: {
      id: division.id,
      title: division.title,
      description: division.description,
      color: division.color,
      isSystem: division.isSystem,
      memberCount: division._count.members,
      createdAt: division.createdAt,
    },
  });
}

// DELETE /api/divisions/[id] - Soft-delete a division
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isAdminOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.division.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json(
      { error: t("errors.systemDivisionNotDeletable") },
      { status: 403 }
    );
  }

  await db.division.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
