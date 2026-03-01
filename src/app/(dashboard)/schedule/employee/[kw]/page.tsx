import { redirect } from "next/navigation";
import {
  parseKW,
  getCurrentKW,
  formatKW,
  getWeekDates,
} from "@/lib/utils/calendar";
import { WeekNav } from "@/components/schedule/week-nav";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { EmployeeGridWrapper } from "@/components/schedule/employee-grid-wrapper";

interface EmployeeKWPageProps {
  params: Promise<{ kw: string }>;
}

export default async function EmployeeKWPage({ params }: EmployeeKWPageProps) {
  const { kw } = await params;
  const parsed = parseKW(kw);

  if (!parsed) {
    const current = getCurrentKW();
    redirect(`/schedule/employee/${formatKW(current.weekNumber, current.year)}`);
  }

  const { weekNumber, year } = parsed;
  const weekDates = getWeekDates(weekNumber, year);
  const weekDateStrings = weekDates.map((d) => d.toISOString());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <ViewSwitcher kw={kw} />
      </div>
      <WeekNav weekNumber={weekNumber} year={year} baseUrl="/schedule/employee" />
      <EmployeeGridWrapper
        weekNumber={weekNumber}
        year={year}
        weekDateStrings={weekDateStrings}
      />
    </div>
  );
}
