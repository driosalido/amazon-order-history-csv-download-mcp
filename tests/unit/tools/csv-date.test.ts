/**
 * Tests for date rendering in CSV output.
 *
 * Order dates are calendar days, not instants: parseDate builds them at local
 * midnight. Rendering them through UTC shifts the day backwards for every
 * timezone east of Greenwich, which silently misdates every row.
 */

import { ORDER_CSV_COLUMNS } from "../../../src/tools/csv-columns";

describe("Order Date CSV column", () => {
  it("renders the calendar day the date was built from", () => {
    const dateColumn = ORDER_CSV_COLUMNS.find((c) => c.key === "date");
    const order = { date: new Date(2026, 5, 21) } as never;

    expect(dateColumn?.getValue(order)).toBe("2026-06-21");
  });

  it("renders an empty string when there is no date", () => {
    const dateColumn = ORDER_CSV_COLUMNS.find((c) => c.key === "date");
    const order = { date: null } as never;

    expect(dateColumn?.getValue(order)).toBe("");
  });
});
