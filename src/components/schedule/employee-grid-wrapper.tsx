"use client";

import { useMemo } from "react";
import { EmployeeGrid } from "./employee-grid";

interface EmployeeGridWrapperProps {
  weekNumber: number;
  year: number;
  weekDateStrings: string[];
}

export function EmployeeGridWrapper({
  weekNumber,
  year,
  weekDateStrings,
}: EmployeeGridWrapperProps) {
  const weekDates = useMemo(
    () => weekDateStrings.map((s) => new Date(s)),
    [weekDateStrings]
  );

  return (
    <EmployeeGrid
      weekNumber={weekNumber}
      year={year}
      weekDates={weekDates}
    />
  );
}
