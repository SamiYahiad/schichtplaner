import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { emitToOrg, emitToSchedule } from "@/lib/emit";

const bookingSchema = z.object({
  shiftId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * POST /api/bookings
 *
 * Book an employee into a shift.
 * Manager+ can book anyone, employees can only book themselves.
 */
export async function POST(request: NextRequest) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId, userId } = parsed.data;

  // Employees can only book themselves
  if (!isManagerOrAbove(member.role) && userId !== member.user.id) {
    return NextResponse.json(
      { error: t("errors.employeesCanOnlyBookSelf") },
      { status: 403 }
    );
  }

  // Verify shift exists and belongs to the user's org
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
      bookings: true,
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: t("errors.shiftNotFound") },
      { status: 404 }
    );
  }

  // Verify the target user is a member of the same org
  const targetMember = await db.organizationMember.findFirst({
    where: {
      organizationId: member.organizationId,
      userId,
      isActive: true,
    },
  });

  if (!targetMember) {
    return NextResponse.json(
      { error: t("errors.employeeNotFound") },
      { status: 404 }
    );
  }

  // Check shift isn't full
  if (shift.bookings.length >= shift.maxEmployees) {
    return NextResponse.json(
      { error: t("errors.shiftFull") },
      { status: 409 }
    );
  }

  // Check employee not already booked in this shift
  const existingBooking = shift.bookings.find((b) => b.userId === userId);
  if (existingBooking) {
    return NextResponse.json(
      { error: t("errors.employeeAlreadyBookedInShift") },
      { status: 409 }
    );
  }

  // Create the booking
  const booking = await db.booking.create({
    data: {
      shiftId,
      userId,
      bookedBy: member.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
          profileImage: true,
        },
      },
    },
  });

  // Broadcast real-time update
  emitToOrg(member.organizationId, "booking:changed", {
    scheduleId: shift.scheduleId,
    shiftId,
    userId,
    action: "booked",
  });
  emitToSchedule(shift.scheduleId, "booking:changed", {
    scheduleId: shift.scheduleId,
    shiftId,
    userId,
    action: "booked",
  });

  return NextResponse.json({ booking }, { status: 201 });
}

/**
 * DELETE /api/bookings
 *
 * Unbook an employee from a shift.
 * Manager+ can unbook anyone, employees can only unbook themselves.
 */
export async function DELETE(request: NextRequest) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("errors.validationFailed"), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shiftId, userId } = parsed.data;

  // Employees can only unbook themselves
  if (!isManagerOrAbove(member.role) && userId !== member.user.id) {
    return NextResponse.json(
      { error: t("errors.employeesCanOnlyUnbookSelf") },
      { status: 403 }
    );
  }

  // Verify shift belongs to the user's org
  const shift = await db.shift.findFirst({
    where: { id: shiftId, deletedAt: null },
    include: {
      schedule: { select: { organizationId: true } },
    },
  });

  if (!shift || shift.schedule.organizationId !== member.organizationId) {
    return NextResponse.json(
      { error: t("errors.shiftNotFound") },
      { status: 404 }
    );
  }

  // Find and delete the booking
  const booking = await db.booking.findUnique({
    where: { shiftId_userId: { shiftId, userId } },
  });

  if (!booking) {
    return NextResponse.json(
      { error: t("errors.bookingNotFound") },
      { status: 404 }
    );
  }

  await db.booking.delete({
    where: { id: booking.id },
  });

  // Broadcast real-time update
  emitToOrg(member.organizationId, "booking:changed", {
    scheduleId: shift.scheduleId,
    shiftId,
    userId,
    action: "unbooked",
  });
  emitToSchedule(shift.scheduleId, "booking:changed", {
    scheduleId: shift.scheduleId,
    shiftId,
    userId,
    action: "unbooked",
  });

  return NextResponse.json({ success: true });
}
