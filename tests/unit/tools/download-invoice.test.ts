/**
 * Tests for the invoice PDF download helpers.
 *
 * The invoice popover (/gp/shared-cs/ajax/invoice/invoice.html) lists one
 * `/documents/download/<uuid>/invoice.pdf` link per legal document, plus a
 * "Request Invoice" link when a third-party seller has not uploaded one. The
 * files land in a folder synced to other devices, so writing must never
 * overwrite anything.
 */

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  parseInvoicePopover,
  writeExclusive,
} from "../../../src/tools/download-invoice";

const PDF = Buffer.from("%PDF-1.4 factura");

const POPOVER_AMAZON = `
<ul>
  <li><a class="a-link-normal" href="/-/en/gp/css/summary/print.html?orderID=403-1&amp;ref=ppx_yo2ov_dt_b_invoice">Printable Order Summary</a></li>
  <li><a class="a-link-normal" href="/-/en/documents/download/780214da-53e4/invoice.pdf">Invoice</a></li>
</ul>`;

const POPOVER_TWO_DOCS = `
<a href="/documents/download/aaa/invoice.pdf">Factura 1</a>
<a href="/documents/download/bbb/invoice.pdf?x=1&amp;y=2">Factura rectificativa</a>`;

const POPOVER_NO_INVOICE = `
<a href="/-/en/gp/css/summary/print.html?orderID=404-2">Printable Order Summary</a>
<a href="/-/en/gp/help/contact/contact.html?orderID=404-2&amp;ref=ppx_yo2ov_dt_b_invoice">Request Invoice</a>`;

describe("parseInvoicePopover", () => {
  it("returns the absolute download URL of the invoice", () => {
    expect(parseInvoicePopover(POPOVER_AMAZON, "amazon.es")).toEqual({
      downloads: [
        "https://www.amazon.es/-/en/documents/download/780214da-53e4/invoice.pdf",
      ],
      requestInvoice: false,
    });
  });

  it("returns every document, in order, with HTML entities decoded", () => {
    expect(parseInvoicePopover(POPOVER_TWO_DOCS, "amazon.es").downloads).toEqual([
      "https://www.amazon.es/documents/download/aaa/invoice.pdf",
      "https://www.amazon.es/documents/download/bbb/invoice.pdf?x=1&y=2",
    ]);
  });

  it("flags a seller that has not uploaded an invoice", () => {
    expect(parseInvoicePopover(POPOVER_NO_INVOICE, "amazon.es")).toEqual({
      downloads: [],
      requestInvoice: true,
    });
  });

  it("does not repeat the same link twice", () => {
    const html = POPOVER_AMAZON + POPOVER_AMAZON;
    expect(parseInvoicePopover(html, "amazon.es").downloads).toHaveLength(1);
  });
});

describe("writeExclusive", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "invoice-"));

  it("writes one PDF as <prefix>.pdf", () => {
    const d = dir();
    expect(writeExclusive(d, "Amazon-Agosto-406-1", [PDF])).toEqual([
      join(d, "Amazon-Agosto-406-1.pdf"),
    ]);
    expect(readFileSync(join(d, "Amazon-Agosto-406-1.pdf"))).toEqual(PDF);
  });

  it("numbers the extra documents of the same order", () => {
    const d = dir();
    const files = writeExclusive(d, "Amazon-Agosto-406-1", [PDF, PDF]);
    expect(files.map((f) => f.slice(d.length + 1))).toEqual([
      "Amazon-Agosto-406-1.pdf",
      "Amazon-Agosto-406-1-2.pdf",
    ]);
  });

  it("never overwrites an existing file and writes nothing in that case", () => {
    const d = dir();
    writeFileSync(join(d, "Amazon-Agosto-406-1-2.pdf"), "%PDF-previo");
    expect(() => writeExclusive(d, "Amazon-Agosto-406-1", [PDF, PDF])).toThrow(
      /ya existe/,
    );
    expect(readFileSync(join(d, "Amazon-Agosto-406-1-2.pdf"), "utf8")).toBe(
      "%PDF-previo",
    );
    expect(readdirSync(d)).toEqual(["Amazon-Agosto-406-1-2.pdf"]);
  });

  it("refuses content that is not a PDF and writes nothing", () => {
    const d = dir();
    expect(() =>
      writeExclusive(d, "Amazon-Agosto-406-1", [PDF, Buffer.from("<html>")]),
    ).toThrow(/no es un PDF/);
    expect(readdirSync(d)).toEqual([]);
  });

  it("refuses a prefix that could escape the destination folder", () => {
    expect(() => writeExclusive(dir(), "../fuera", [PDF])).toThrow(/prefijo/);
  });

  it("refuses a destination folder that does not exist", () => {
    expect(() =>
      writeExclusive(join(tmpdir(), "no-existe-xyz-123"), "A", [PDF]),
    ).toThrow(/no existe/);
  });
});
