/**
 * Tests for order list URL construction.
 *
 * Amazon's order list paginates correctly only when the view carries an
 * explicit timeFilter. On the unfiltered default view, following the "next"
 * link resets the view and returns a page with no orders at all, which the
 * scraper reads as "no more orders" and silently truncates the result.
 */

import { AmazonPlugin } from "../../../src/amazon/adapter";

function timeFilterOf(url: string): string | null {
  return new URL(url).searchParams.get("timeFilter");
}

describe("getOrderListUrl", () => {
  const plugin = new AmazonPlugin();

  it("derives a timeFilter from a date range", () => {
    const url = plugin.getOrderListUrl("es", {
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(timeFilterOf(url)).toBe("months-3");
  });

  it("uses a wider window for a range that spans more than three months", () => {
    const url = plugin.getOrderListUrl("es", {
      startDate: new Date(2026, 2, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(timeFilterOf(url)).toBe("months-6");
  });

  it("uses the calendar year for a range in an earlier year", () => {
    const url = plugin.getOrderListUrl("es", {
      startDate: new Date(2024, 0, 1),
      endDate: new Date(2024, 11, 31),
    });

    expect(timeFilterOf(url)).toBe("year-2024");
  });

  it("always emits a timeFilter, even with no filter requested", () => {
    const url = plugin.getOrderListUrl("es", {});

    expect(timeFilterOf(url)).not.toBeNull();
  });

  it("still honours an explicit year", () => {
    const url = plugin.getOrderListUrl("es", { year: 2025 });

    expect(timeFilterOf(url)).toBe("year-2025");
  });
});
