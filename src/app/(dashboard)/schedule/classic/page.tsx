import { redirect } from "next/navigation";
import { getCurrentKW, formatKW } from "@/lib/utils/calendar";

export default function ScheduleClassicPage() {
  const { weekNumber, year } = getCurrentKW();
  redirect(`/schedule/classic/${formatKW(weekNumber, year)}`);
}
