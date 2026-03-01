import { redirect } from "next/navigation";
import { getCurrentKW, formatKW } from "@/lib/utils/calendar";

export default function ScheduleEmployeePage() {
  const { weekNumber, year } = getCurrentKW();
  redirect(`/schedule/employee/${formatKW(weekNumber, year)}`);
}
