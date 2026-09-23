/**
 * Download the legal invoice PDF(s) of one order.
 *
 * The order-details "Invoice" button loads a popover
 * (`/gp/shared-cs/ajax/invoice/invoice.html?orderId=…`) that lists one
 * `/documents/download/<uuid>/invoice.pdf` link per document (an invoice, and
 * sometimes a credit note). A third-party seller that has not uploaded one
 * shows only "Request Invoice". The "Printable Order Summary" is NOT an
 * invoice and is never downloaded.
 *
 * Verified against amazon.es on 2026-09-23 with an Amazon EU order and a
 * third-party one: both return application/pdf with the buyer's NIF.
 *
 * The destination is usually a folder synced to other devices (Resilio), so
 * writing is all-or-nothing and never overwrites: every target is checked
 * first and each file is opened with the exclusive `wx` flag.
 */

import { existsSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { Page } from "playwright";

export interface InvoicePopover {
  downloads: string[];
  requestInvoice: boolean;
}

export type DownloadResult =
  | { status: "ok"; files: string[] }
  | { status: "sin_factura" }
  | { status: "login" }
  | { status: "error"; message: string };

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Pure: the download links of a popover, absolute and de-duplicated. */
export function parseInvoicePopover(html: string, domain: string): InvoicePopover {
  const downloads: string[] = [];
  let requestInvoice = false;
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(m[1]);
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (/\/documents\/download\//.test(href)) {
      const url = new URL(href, `https://www.${domain}`).href;
      if (!downloads.includes(url)) downloads.push(url);
    } else if (/contact\.html/.test(href) && /request invoice|solicitar factura/i.test(text)) {
      requestInvoice = true;
    }
  }
  return { downloads, requestInvoice };
}

/**
 * Write `docs` as `<prefix>.pdf`, `<prefix>-2.pdf`… in `dir`. Validates
 * everything before writing anything, so a failure leaves the folder as it was.
 */
export function writeExclusive(dir: string, prefix: string, docs: Buffer[]): string[] {
  if (!prefix || /[\\/]|^\.\.?$/.test(prefix)) {
    throw new Error(`prefijo de fichero no válido: ${JSON.stringify(prefix)}`);
  }
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`la carpeta de destino no existe: ${dir}`);
  }
  docs.forEach((doc, i) => {
    if (doc.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error(`el documento ${i + 1} no es un PDF`);
    }
  });
  const targets = docs.map((_, i) => join(dir, i === 0 ? `${prefix}.pdf` : `${prefix}-${i + 1}.pdf`));
  const taken = targets.filter((t) => existsSync(t));
  if (taken.length) {
    throw new Error(`ya existe, no se sobrescribe: ${taken.join(", ")}`);
  }
  targets.forEach((t, i) => writeFileSync(t, docs[i], { flag: "wx" }));
  return targets;
}

/** Fetch the popover and every invoice of `orderId` with the logged-in page. */
export async function downloadInvoice(
  page: Page,
  domain: string,
  orderId: string,
  destDir: string,
  filePrefix: string,
): Promise<DownloadResult> {
  const popoverUrl =
    `https://www.${domain}/gp/shared-cs/ajax/invoice/invoice.html` +
    `?orderId=${encodeURIComponent(orderId)}&relatedRequestId=&isADriveSubscription=&isHFC=`;
  const popover = await page.request.get(popoverUrl);
  if (/\/ap\/signin/.test(popover.url())) return { status: "login" };
  if (!popover.ok()) {
    return { status: "error", message: `la ventana de factura respondió ${popover.status()}` };
  }
  const { downloads } = parseInvoicePopover(await popover.text(), domain);
  if (!downloads.length) return { status: "sin_factura" };

  const docs: Buffer[] = [];
  for (const url of downloads) {
    const res = await page.request.get(url);
    if (/\/ap\/signin/.test(res.url())) return { status: "login" };
    if (!res.ok()) {
      return { status: "error", message: `la descarga respondió ${res.status()}` };
    }
    docs.push(Buffer.from(await res.body()));
  }
  try {
    return { status: "ok", files: writeExclusive(destDir, filePrefix, docs) };
  } catch (err) {
    return { status: "error", message: (err as Error).message };
  }
}
