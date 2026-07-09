import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth-helpers";

// GET /api/messages/unread-count
export async function GET() {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  const count = await db.messageRecipient.count({
    where: {
      userId: member.user.id,
      isRead: false,
      isDeleted: false,
      message: { organizationId: member.organizationId },
    },
  });

  return NextResponse.json({ count });
}
