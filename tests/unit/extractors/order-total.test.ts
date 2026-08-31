/**
 * Tests for order total extraction across Amazon locales.
 */

import { extractOrderTotal } from "../../../src/amazon/extractors/order-list";

describe("extractOrderTotal", () => {
  it("extracts a Spanish total with the symbol after the amount", () => {
    const cardText = ["PEDIDO REALIZADO", "21 de junio de 2026", "TOTAL", "13,99 €"].join("\n");

    expect(extractOrderTotal(cardText, "EUR").amount).toBe(13.99);
  });

  it("extracts a Spanish total above one thousand", () => {
    const cardText = ["TOTAL", "1.234,56 €"].join("\n");

    expect(extractOrderTotal(cardText, "EUR").amount).toBe(1234.56);
  });

  it("still extracts an English total with the symbol before the amount", () => {
    const cardText = ["TOTAL", "£15.85"].join("\n");

    expect(extractOrderTotal(cardText, "GBP").amount).toBe(15.85);
  });
});
