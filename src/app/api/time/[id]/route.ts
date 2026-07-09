import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

const updateSchema = z.object({
  date: z.string().optional(),
  timeFrom: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  timeTo: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  durationHours: z.number().int().min(0).optional().nullable(),
  durationMinutes: z.number().int().min(0).max(59).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
});

// PATCH /api/time/:id — edit time record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  const { id } = await params;

  const record = await db.timeRecord.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
  }

  // Check ownership or manager+
  if (!isManagerOrAbove(member.role) && record.userId !== member.user.id) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  // Check same org
  const targetMember = await db.organizationMember.findFirst({
    where: {
      organizationId: member.organizationId,
      userId: record.userId,
      isActive: true,
    },
  });
  if (!targetMember) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.date !== undefined) {
    updateData.date = new Date(data.date + "T00:00:00.000Z");
  }
  if (data.timeFrom !== undefined) updateData.timeFrom = data.timeFrom;
  if (data.timeTo !== undefined) updateData.timeTo = data.timeTo;
  if (data.durationHours !== undefined)
    updateData.durationHours = data.durationHours;
  if (data.durationMinutes !== undefined)
    updateData.durationMinutes = data.durationMinutes;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.comment !== undefined) updateData.comment = data.comment;

  const updated = await db.timeRecord.update({
    where: { id },
    data: updateData,
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ record: updated });
}

// DELETE /api/time/:id — delete time record
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  const { id } = await params;

  const record = await db.timeRecord.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
  }

  // Check ownership or manager+
  if (!isManagerOrAbove(member.role) && record.userId !== member.user.id) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  // Check same org
  const targetMember = await db.organizationMember.findFirst({
    where: {
      organizationId: member.organizationId,
      userId: record.userId,
      isActive: true,
    },
  });
  if (!targetMember) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  await db.timeRecord.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
