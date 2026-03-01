"use client";

import { useMemo } from "react";
import { ClassicGrid } from "./classic-grid";

interface ClassicGridWrapperProps {
  weekNumber: number;
  year: number;
  weekDateStrings: string[];
}

export function ClassicGridWrapper({
  weekNumber,
  year,
  weekDateStrings,
}: ClassicGridWrapperProps) {
  const weekDates = useMemo(
    () => weekDateStrings.map((s) => new Date(s)),
    [weekDateStrings]
  );

  return (
    <ClassicGrid
      weekNumber={weekNumber}
      year={year}
      weekDates={weekDates}
    />
  );
}
