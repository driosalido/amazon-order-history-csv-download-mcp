/**
 * Tests for order list pagination.
 *
 * Regression guard: goToNextPage kept its own hardcoded list of order card
 * selectors, which drifted from the list findOrderCards actually searches.
 * It therefore waited for elements that no longer exist in Amazon's current
 * layout, timed out silently, and handed extraction a page that had not
 * rendered yet - dropping a whole page of orders with no error.
 */

import { Page } from "playwright";
import {
  goToNextPage,
  ORDER_CARD_SELECTORS,
} from "../../../src/amazon/extractors/order-list";

function fakePageRecordingWaits(waited: string[]): Page {
  return {
    locator: () => ({
      count: async () => 1,
      click: async () => undefined,
    }),
    waitForLoadState: async () => undefined,
    waitForSelector: async (selector: string) => {
      waited.push(selector);
      return null;
    },
  } as unknown as Page;
}

describe("goToNextPage", () => {
  it("waits for every selector that order extraction will search for", async () => {
    const waited: string[] = [];

    await goToNextPage(fakePageRecordingWaits(waited));

    const waitedFor = waited.join(" ");
    for (const selector of ORDER_CARD_SELECTORS) {
      expect(waitedFor).toContain(selector);
    }
  });
});
