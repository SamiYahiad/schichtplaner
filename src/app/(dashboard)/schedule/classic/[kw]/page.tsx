import { redirect } from "next/navigation";
import {
  parseKW,
  getCurrentKW,
  formatKW,
  getWeekDates,
} from "@/lib/utils/calendar";
import { WeekNav } from "@/components/schedule/week-nav";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { ClassicGridWrapper } from "@/components/schedule/classic-grid-wrapper";

interface ClassicKWPageProps {
  params: Promise<{ kw: string }>;
}

export default async function ClassicKWPage({ params }: ClassicKWPageProps) {
  const { kw } = await params;
  const parsed = parseKW(kw);

  if (!parsed) {
    const current = getCurrentKW();
    redirect(`/schedule/classic/${formatKW(current.weekNumber, current.year)}`);
  }

  const { weekNumber, year } = parsed;
  const weekDates = getWeekDates(weekNumber, year);
  const weekDateStrings = weekDates.map((d) => d.toISOString());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <ViewSwitcher kw={kw} />
      </div>
      <WeekNav weekNumber={weekNumber} year={year} baseUrl="/schedule/classic" />
      <ClassicGridWrapper
        weekNumber={weekNumber}
        year={year}
        weekDateStrings={weekDateStrings}
      />
    </div>
  );
}
