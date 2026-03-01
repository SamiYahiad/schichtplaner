import { redirect } from "next/navigation";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { MonthGridWrapper } from "@/components/schedule/month-grid-wrapper";
import { getCurrentKW, formatKW } from "@/lib/utils/calendar";

interface MonthPageProps {
  params: Promise<{ month: string }>;
}

function parseMonth(str: string): { month: number; year: number } | null {
  const match = str.match(/^(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export default async function MonthViewPage({ params }: MonthPageProps) {
  const { month: monthParam } = await params;
  const parsed = parseMonth(monthParam);

  if (!parsed) {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    redirect(`/schedule/month/${m}-${now.getFullYear()}`);
  }

  const { month, year } = parsed;

  // Derive a KW for the view switcher from this month (use first day of month)
  const currentKW = getCurrentKW();
  const kw = formatKW(currentKW.weekNumber, currentKW.year);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <ViewSwitcher kw={kw} month={monthParam} />
      </div>
      <MonthGridWrapper month={month} year={year} />
    </div>
  );
}
