/**
 * Tests for order date extraction across Amazon locales.
 *
 * Amazon serves order cards in the account's display language, and the same
 * account can be served different languages between requests. Extraction must
 * not depend on English month names.
 */

import { extractOrderDate } from "../../../src/amazon/extractors/order-list";

describe("extractOrderDate", () => {
  it("extracts the date from a Spanish order card", async () => {
    const cardText = [
      "PEDIDO REALIZADO",
      "21 de junio de 2026",
      "TOTAL",
      "13,99 €",
      "ENVIAR A",
      "David Riosalido del Pozo",
      "Entregado el 24 de junio",
    ].join("\n");

    const date = await extractOrderDate(cardText);

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(5); // junio, 0-indexed
    expect(date?.getDate()).toBe(21);
  });

  it("ignores a delivery date that carries no year", async () => {
    const cardText = ["Entregado el 20 de agosto"].join("\n");

    expect(await extractOrderDate(cardText)).toBe(null);
  });

  it("still extracts the date from an English order card", async () => {
    const cardText = ["Order placed", "14 October 2024", "TOTAL", "£15.85"].join(
      "\n",
    );

    const date = await extractOrderDate(cardText);

    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(14);
  });

  it("extracts the date from a German order card", async () => {
    const cardText = ["BESTELLUNG AUFGEGEBEN", "3. Januar 2025"].join("\n");

    const date = await extractOrderDate(cardText);

    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(3);
  });
});
