import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentMember, isAdminOrAbove } from "@/lib/auth-helpers";

const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
});

// PATCH /api/employees/[id]/role - Change role
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

  const target = await db.organizationMember.findFirst({
    where: {
      id,
      organizationId: member.organizationId,
    },
  });

  if (!target) {
    return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
  }

  // Cannot change the owner's role
  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: t("errors.cannotChangeOwnerRole") },
      { status: 400 }
    );
  }

  // Cannot change your own role
  if (target.userId === member.userId) {
    return NextResponse.json(
      { error: t("errors.cannotChangeOwnRole") },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const parsed = changeRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.organizationMember.update({
    where: { id },
    data: { role: parsed.data.role },
  });

  return NextResponse.json(updated);
}
