import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shifts/:id/places
 *
 * Add one empty place (increase maxEmployees by 1). Manager+ only.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  const { id } = await context.params;

  // Verify shift exists and belongs to member's org
  const existing = await db.shift.findFirst({
    where: { id, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!existing || existing.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: t("errors.shiftNotFound") },
      { status: 404 }
    );
  }

  const shift = await db.shift.update({
    where: { id },
    data: { maxEmployees: existing.maxEmployees + 1 },
    select: { id: true, maxEmployees: true },
  });

  return NextResponse.json({ shift });
}

/**
 * DELETE /api/shifts/:id/places
 *
 * Remove one empty place (decrease maxEmployees by 1). Manager+ only.
 * Only allowed if current bookings < new max.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json({ error: t("errors.forbidden") }, { status: 403 });
  }

  const { id } = await context.params;

  // Verify shift exists and belongs to member's org
  const existing = await db.shift.findFirst({
    where: { id, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
      bookings: { select: { id: true } },
    },
  });

  if (!existing || existing.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: t("errors.shiftNotFound") },
      { status: 404 }
    );
  }

  if (existing.maxEmployees <= 1) {
    return NextResponse.json(
      { error: t("errors.minOnePlaceRequired") },
      { status: 400 }
    );
  }

  const newMax = existing.maxEmployees - 1;
  if (existing.bookings.length > newMax) {
    return NextResponse.json(
      { error: t("errors.cannotRemovePlaceTooManyBookings") },
      { status: 409 }
    );
  }

  const shift = await db.shift.update({
    where: { id },
    data: { maxEmployees: newMax },
    select: { id: true, maxEmployees: true },
  });

  return NextResponse.json({ shift });
}
