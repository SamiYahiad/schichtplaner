/**
 * Chat Tool Definitions for Claude Tool-Use
 *
 * Defines the tools the AI chat assistant can use to interact
 * with the Schichtplaner system: querying schedules, employees,
 * absences, and performing destructive actions with confirmation.
 */

import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";

// ─── Tool Definitions ──────────────────────────────────────────────

export interface ChatTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** If true, the frontend must confirm before executing. */
  requiresConfirmation?: boolean;
}

export const chatTools: ChatTool[] = [
  {
    name: "getSchedule",
    description:
      "Liefert den Schichtplan fuer eine bestimmte Kalenderwoche. Gibt alle Schichten mit Buchungen zurueck.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekNumber: {
          type: "number",
          description: "Die Kalenderwoche (1-52)",
        },
        year: {
          type: "number",
          description: "Das Jahr (z.B. 2026)",
        },
      },
      required: ["weekNumber", "year"],
    },
  },
  {
    name: "getEmployeeHours",
    description:
      "Liefert die gebuchten Stunden eines Mitarbeiters fuer einen bestimmten Zeitraum (Woche oder Monat).",
    input_schema: {
      type: "object" as const,
      properties: {
        employeeId: {
          type: "string",
          description: "Die Mitarbeiter-ID",
        },
        weekNumber: {
          type: "number",
          description: "Kalenderwoche (optional, wenn nicht angegeben wird der aktuelle Monat genommen)",
        },
        year: {
          type: "number",
          description: "Das Jahr",
        },
      },
      required: ["employeeId", "year"],
    },
  },
  {
    name: "searchEmployees",
    description:
      "Sucht Mitarbeiter nach Name (Vorname oder Nachname). Gibt eine Liste mit ID, Name, Rolle und Bereich zurueck.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Suchbegriff (Name oder Teil davon)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "createShift",
    description:
      "Erstellt eine neue Schicht in einem Schichtplan. ACHTUNG: Aendert Daten! Der Nutzer muss bestaetigen.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekNumber: {
          type: "number",
          description: "Kalenderwoche",
        },
        year: {
          type: "number",
          description: "Jahr",
        },
        dayOfWeek: {
          type: "number",
          description: "Wochentag (1=Montag, 7=Sonntag)",
        },
        shiftFrom: {
          type: "string",
          description: "Beginn der Schicht im Format HH:mm (z.B. 08:00)",
        },
        shiftTo: {
          type: "string",
          description: "Ende der Schicht im Format HH:mm (z.B. 16:00)",
        },
        maxEmployees: {
          type: "number",
          description: "Maximale Anzahl Mitarbeiter (Standard: 1)",
        },
      },
      required: ["weekNumber", "year", "dayOfWeek", "shiftFrom", "shiftTo"],
    },
    requiresConfirmation: true,
  },
  {
    name: "bookEmployee",
    description:
      "Bucht einen Mitarbeiter in eine bestimmte Schicht ein. ACHTUNG: Aendert Daten! Der Nutzer muss bestaetigen.",
    input_schema: {
      type: "object" as const,
      properties: {
        shiftId: {
          type: "string",
          description: "Die Schicht-ID",
        },
        employeeId: {
          type: "string",
          description: "Die Mitarbeiter-ID",
        },
      },
      required: ["shiftId", "employeeId"],
    },
    requiresConfirmation: true,
  },
  {
    name: "getAbsences",
    description:
      "Liefert alle Abwesenheiten (Urlaub, Krankheit etc.) fuer einen bestimmten Zeitraum.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Startdatum im Format yyyy-MM-dd",
        },
        to: {
          type: "string",
          description: "Enddatum im Format yyyy-MM-dd",
        },
        employeeId: {
          type: "string",
          description: "Optional: nur Abwesenheiten eines bestimmten Mitarbeiters",
        },
      },
      required: ["from", "to"],
    },
  },
];

// ─── Tool Execution ────────────────────────────────────────────────

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/** Get the Monday of an ISO week. */
function getWeekStartDate(weekNumber: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1);
  monday.setDate(monday.getDate() + (weekNumber - 1) * 7);
  return monday;
}

/** Estimate hours between two HH:mm strings. */
function estimateHours(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let diff = th * 60 + tm - (fh * 60 + fm);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

/** Localized weekday name (1=Monday..7=Sunday), with a numeric fallback. */
function dayName(t: Translator, dayOfWeek: number): string {
  const names = t.raw("ai.toolResult.dayNames") as string[];
  return names[dayOfWeek - 1] ?? t("ai.toolResult.dayFallback", { day: dayOfWeek });
}

export type ToolResult = {
  content: string;
  requiresConfirmation?: boolean;
  data?: unknown;
};

/**
 * Execute a chat tool by name with given input parameters.
 * Returns a string result for the AI to incorporate into its response.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  orgId: string,
  userId: string
): Promise<ToolResult> {
  const t = await getTranslations();
  switch (toolName) {
    case "getSchedule":
      return executeGetSchedule(input, orgId, t);
    case "getEmployeeHours":
      return executeGetEmployeeHours(input, orgId, t);
    case "searchEmployees":
      return executeSearchEmployees(input, orgId, t);
    case "createShift":
      return executeCreateShift(input, orgId, t);
    case "bookEmployee":
      return executeBookEmployee(input, orgId, userId, t);
    case "getAbsences":
      return executeGetAbsences(input, orgId, t);
    default:
      return { content: t("ai.toolResult.unknownTool", { toolName }) };
  }
}

// ─── Tool Implementations ──────────────────────────────────────────

async function executeGetSchedule(
  input: Record<string, unknown>,
  orgId: string,
  t: Translator
): Promise<ToolResult> {
  const weekNumber = input.weekNumber as number;
  const year = input.year as number;

  const schedule = await db.schedule.findFirst({
    where: {
      organizationId: orgId,
      weekNumber,
      year,
      branchId: null,
      deletedAt: null,
    },
    include: {
      shifts: {
        where: { deletedAt: null },
        include: {
          division: { select: { title: true, color: true } },
          bookings: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: [{ dayOfWeek: "asc" }, { shiftFrom: "asc" }],
      },
    },
  });

  if (!schedule) {
    return {
      content: t("ai.toolResult.noSchedule", { weekNumber, year }),
    };
  }

  const lines: string[] = [
    t("ai.toolResult.scheduleHeader", {
      weekNumber,
      year,
      status: schedule.isPublic
        ? t("ai.toolResult.published")
        : t("ai.toolResult.notPublished"),
    }),
    "",
  ];

  for (const shift of schedule.shifts) {
    const day = dayName(t, shift.dayOfWeek);
    const bookedNames = shift.bookings
      .map((b) => `${b.user.firstName} ${b.user.lastName}`)
      .join(", ");
    const division = shift.division ? ` [${shift.division.title}]` : "";
    const spots = `${shift.bookings.length}/${shift.maxEmployees}`;

    lines.push(
      `- ${day} ${shift.shiftFrom}-${shift.shiftTo}${division} (${spots} ${t("ai.toolResult.occupiedLabel")})${bookedNames ? `: ${bookedNames}` : ""} [ID: ${shift.id}]`
    );
  }

  return { content: lines.join("\n"), data: schedule };
}

async function executeGetEmployeeHours(
  input: Record<string, unknown>,
  orgId: string,
  t: Translator
): Promise<ToolResult> {
  const employeeId = input.employeeId as string;
  const year = input.year as number;
  const weekNumber = input.weekNumber as number | undefined;

  // Verify employee belongs to org
  const member = await db.organizationMember.findFirst({
    where: { organizationId: orgId, userId: employeeId, isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  if (!member) {
    return { content: t("ai.toolResult.employeeNotFoundInOrg") };
  }

  const name = `${member.user.firstName} ${member.user.lastName}`;

  // Get bookings for the period
  const whereClause: Record<string, unknown> = {
    userId: employeeId,
    shift: {
      deletedAt: null,
      schedule: {
        organizationId: orgId,
        year,
        deletedAt: null,
        ...(weekNumber ? { weekNumber } : {}),
      },
    },
  };

  const bookings = await db.booking.findMany({
    where: whereClause,
    include: {
      shift: {
        select: {
          dayOfWeek: true,
          shiftFrom: true,
          shiftTo: true,
          schedule: { select: { weekNumber: true } },
        },
      },
    },
  });

  let totalHours = 0;
  const weeklyHours = new Map<number, number>();

  for (const b of bookings) {
    const hours = estimateHours(b.shift.shiftFrom, b.shift.shiftTo);
    totalHours += hours;
    const wk = b.shift.schedule.weekNumber;
    weeklyHours.set(wk, (weeklyHours.get(wk) ?? 0) + hours);
  }

  if (weekNumber) {
    return {
      content: t("ai.toolResult.hoursWeekSummary", {
        name,
        weekNumber,
        year,
        hours: totalHours.toFixed(1),
        count: bookings.length,
      }),
    };
  }

  const weekEntries = [...weeklyHours.entries()]
    .sort(([a], [b]) => a - b)
    .map(([wk, h]) =>
      t("ai.toolResult.weekEntryLine", { week: wk, hours: h.toFixed(1) })
    )
    .join("\n");

  const header = t("ai.toolResult.hoursYearHeader", { name, year });
  const summary = t("ai.toolResult.hoursYearSummary", {
    hours: totalHours.toFixed(1),
    count: bookings.length,
  });

  return {
    content: `${header}\n${summary}\n${weekEntries}`,
  };
}

async function executeSearchEmployees(
  input: Record<string, unknown>,
  orgId: string,
  t: Translator
): Promise<ToolResult> {
  const query = (input.query as string).toLowerCase();

  const members = await db.organizationMember.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      user: {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { nickname: { contains: query, mode: "insensitive" } },
        ],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
          email: true,
        },
      },
    },
    take: 10,
  });

  if (members.length === 0) {
    return { content: t("ai.toolResult.noEmployeesMatching", { query }) };
  }

  // Get division memberships
  const userIds = members.map((m) => m.user.id);
  const divMembers = await db.divisionMember.findMany({
    where: {
      userId: { in: userIds },
      division: { organizationId: orgId, deletedAt: null },
    },
    include: { division: { select: { title: true } } },
  });

  const userDivisions = new Map<string, string[]>();
  for (const dm of divMembers) {
    const existing = userDivisions.get(dm.userId) ?? [];
    existing.push(dm.division.title);
    userDivisions.set(dm.userId, existing);
  }

  const lines = members.map((m) => {
    const divs = userDivisions.get(m.user.id) ?? [];
    const divText =
      divs.length > 0
        ? ` | ${t("ai.toolResult.divisionsLabel")}: ${divs.join(", ")}`
        : "";
    return `- ${m.user.firstName} ${m.user.lastName} (${m.role})${divText} [ID: ${m.user.id}]`;
  });

  const header = t("ai.toolResult.employeesFoundHeader", {
    count: members.length,
  });

  return {
    content: `${header}\n${lines.join("\n")}`,
  };
}

async function executeCreateShift(
  input: Record<string, unknown>,
  orgId: string,
  t: Translator
): Promise<ToolResult> {
  const weekNumber = input.weekNumber as number;
  const year = input.year as number;
  const dayOfWeek = input.dayOfWeek as number;
  const shiftFrom = input.shiftFrom as string;
  const shiftTo = input.shiftTo as string;
  const maxEmployees = (input.maxEmployees as number) ?? 1;

  // Find or create schedule
  let schedule = await db.schedule.findFirst({
    where: {
      organizationId: orgId,
      weekNumber,
      year,
      branchId: null,
      deletedAt: null,
    },
  });

  if (!schedule) {
    schedule = await db.schedule.create({
      data: {
        organizationId: orgId,
        weekNumber,
        year,
      },
    });
  }

  // Create the shift
  const shift = await db.shift.create({
    data: {
      scheduleId: schedule.id,
      dayOfWeek,
      shiftFrom,
      shiftTo,
      maxEmployees,
    },
  });

  const day = dayName(t, dayOfWeek);

  return {
    content: `${t("ai.toolResult.shiftCreated", { day, shiftFrom, shiftTo, maxEmployees, weekNumber, year })} [ID: ${shift.id}]`,
    requiresConfirmation: true,
    data: shift,
  };
}

async function executeBookEmployee(
  input: Record<string, unknown>,
  orgId: string,
  userId: string,
  t: Translator
): Promise<ToolResult> {
  const shiftId = input.shiftId as string;
  const employeeId = input.employeeId as string;

  // Validate shift
  const shift = await db.shift.findFirst({
    where: {
      id: shiftId,
      deletedAt: null,
      schedule: { organizationId: orgId, deletedAt: null },
    },
    include: {
      bookings: true,
      schedule: { select: { weekNumber: true, year: true } },
    },
  });

  if (!shift) {
    return { content: t("ai.toolResult.shiftNotFound") };
  }

  if (shift.bookings.length >= shift.maxEmployees) {
    return { content: t("ai.toolResult.shiftFullyBooked") };
  }

  // Check if already booked
  const existing = shift.bookings.find((b) => b.userId === employeeId);
  if (existing) {
    return { content: t("ai.toolResult.alreadyBookedInShift") };
  }

  // Verify employee
  const member = await db.organizationMember.findFirst({
    where: { organizationId: orgId, userId: employeeId, isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  if (!member) {
    return { content: t("ai.toolResult.employeeNotFound") };
  }

  // Create booking
  await db.booking.create({
    data: {
      shiftId,
      userId: employeeId,
      bookedBy: userId,
    },
  });

  const day = dayName(t, shift.dayOfWeek);
  const name = `${member.user.firstName} ${member.user.lastName}`;

  return {
    content: t("ai.toolResult.employeeBooked", {
      name,
      day,
      shiftFrom: shift.shiftFrom,
      shiftTo: shift.shiftTo,
      weekNumber: shift.schedule.weekNumber,
    }),
    requiresConfirmation: true,
    data: { shiftId, employeeId },
  };
}

async function executeGetAbsences(
  input: Record<string, unknown>,
  orgId: string,
  t: Translator
): Promise<ToolResult> {
  const from = new Date(input.from as string);
  const to = new Date(input.to as string);
  const employeeId = input.employeeId as string | undefined;

  const whereClause: Record<string, unknown> = {
    user: {
      memberships: {
        some: { organizationId: orgId, isActive: true },
      },
    },
    dateFrom: { lte: to },
    dateTo: { gte: from },
    ...(employeeId ? { userId: employeeId } : {}),
  };

  const absences = await db.absence.findMany({
    where: whereClause,
    include: {
      user: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
    },
    orderBy: { dateFrom: "asc" },
    take: 50,
  });

  if (absences.length === 0) {
    return { content: t("ai.toolResult.noAbsencesFound") };
  }

  const lines = absences.map((a) => {
    const fromStr = a.dateFrom.toISOString().split("T")[0];
    const toStr = a.dateTo.toISOString().split("T")[0];
    const status =
      a.status === "APPROVED"
        ? t("employees.statusApproved")
        : a.status === "PENDING"
          ? t("employees.statusPending")
          : t("employees.statusDeclined");
    const range = t("ai.toolResult.dateRange", { from: fromStr, to: toStr });
    return `- ${a.user.firstName} ${a.user.lastName}: ${a.category.name} (${range}) - ${status}`;
  });

  const header = t("ai.toolResult.absencesFoundHeader", {
    count: absences.length,
  });

  return {
    content: `${header}\n${lines.join("\n")}`,
  };
}
