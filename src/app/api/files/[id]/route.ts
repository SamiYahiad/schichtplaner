import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

const renameSchema = z.object({
  name: z.string().min(1).max(100),
});

// PATCH /api/files/[id] — rename folder or file
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Try folder first, then file
  const folder = await db.portalFolder.findFirst({
    where: { id, organizationId: member.organizationId },
  });

  if (folder) {
    const updated = await db.portalFolder.update({
      where: { id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ folder: updated });
  }

  const file = await db.portalFile.findFirst({
    where: { id, organizationId: member.organizationId },
  });

  if (file) {
    const updated = await db.portalFile.update({
      where: { id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ file: updated });
  }

  return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
}

// DELETE /api/files/[id] — delete folder or file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  const { id } = await params;

  // Try folder first, then file
  const folder = await db.portalFolder.findFirst({
    where: { id, organizationId: member.organizationId },
  });

  if (folder) {
    await db.portalFolder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  const file = await db.portalFile.findFirst({
    where: { id, organizationId: member.organizationId },
  });

  if (file) {
    await db.portalFile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
}
