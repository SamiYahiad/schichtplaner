import { redirect } from "next/navigation";

export default function ScheduleMonthPage() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  redirect(`/schedule/month/${month}-${year}`);
}
