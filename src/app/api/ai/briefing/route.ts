/**
 * POST /api/ai/briefing
 *
 * Generate a smart AI briefing for a given schedule.
 * Requires Manager+ role and the smartBriefing feature enabled.
 *
 * Body: { scheduleId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";
import { isAIFeatureEnabled } from "@/lib/ai/client";
import { generateSmartBriefing } from "@/lib/ai/briefing-generator";

export async function POST(request: NextRequest) {
  const t = await getTranslations();
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  if (!isManagerOrAbove(member.role)) {
    return NextResponse.json(
      { error: t("errors.managersOnlyBriefing") },
      { status: 403 }
    );
  }

  // Check feature flag
  const enabled = await isAIFeatureEnabled(
    member.organizationId,
    "smartBriefing"
  );
  if (!enabled) {
    return NextResponse.json(
      { error: t("errors.smartBriefingDisabled") },
      { status: 403 }
    );
  }

  let body: { scheduleId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("errors.invalidJson") }, { status: 400 });
  }

  if (!body.scheduleId || typeof body.scheduleId !== "string") {
    return NextResponse.json(
      { error: t("errors.scheduleIdRequired") },
      { status: 400 }
    );
  }

  try {
    const briefing = await generateSmartBriefing(
      body.scheduleId,
      member.organizationId
    );

    return NextResponse.json({
      text: briefing.text,
      model: briefing.model,
      usage: {
        inputTokens: briefing.inputTokens,
        outputTokens: briefing.outputTokens,
      },
    });
  } catch (error) {
    console.error("[AI Briefing] Error:", error);
    const message =
      error instanceof Error ? error.message : t("errors.unknownError");
    return NextResponse.json(
      { error: t("errors.briefingGenerationFailed", { message }) },
      { status: 500 }
    );
  }
}
