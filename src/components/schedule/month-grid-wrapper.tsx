"use client";

import { MonthGrid } from "./month-grid";

interface MonthGridWrapperProps {
  month: number;
  year: number;
}

export function MonthGridWrapper({ month, year }: MonthGridWrapperProps) {
  return <MonthGrid month={month} year={year} />;
}
