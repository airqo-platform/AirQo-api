const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const moment = require("moment-timezone");
const { formatMoney } = require("@utils/billing-money.util");

/**
 * Renders invoices, pro forma invoices and payment receipts as A4 PDFs with
 * pdfkit's built-in Helvetica (no browser binary needed in the container).
 */

const LOGO_PATH = path.join(__dirname, "..", "config", "images", "airqoLogo.png");
const hasLogo = fs.existsSync(LOGO_PATH);

const COLORS = {
  ink: "#101828",
  muted: "#475467",
  line: "#D0D5DD",
  brand: "#145FFF",
  paid: "#12B76A",
  void: "#D92D20",
};
const MARGIN = 50;
const PAGE_BOTTOM = 842 - MARGIN; // A4 height in points

const formatDate = (value) =>
  value ? moment.utc(value).format("MMMM D, YYYY") : "";

const toBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const newDocument = (title) =>
  new PDFDocument({
    size: "A4",
    margin: MARGIN,
    info: { Title: title, Author: "AirQo", Creator: "AirQo Billing" },
  });

const partyLines = (party = {}) =>
  [
    party.contact_name,
    ...(party.address_lines || []),
    [party.city, party.postal_code].filter(Boolean).join(", "),
    party.country,
    party.tax_id ? `Tax/VAT number: ${party.tax_id}` : null,
    party.email || (party.emails || []).join(", "),
    party.phone,
    party.website,
  ].filter(Boolean);

const ensureSpace = (doc, height) => {
  if (doc.y + height > PAGE_BOTTOM) doc.addPage();
};

const drawHeader = (doc, title) => {
  const top = MARGIN;
  if (hasLogo) doc.image(LOGO_PATH, MARGIN, top, { height: 48 });
  doc
    .moveTo(MARGIN, top + 60)
    .lineTo(doc.page.width - MARGIN, top + 60)
    .lineWidth(1.5)
    .strokeColor(COLORS.ink)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(COLORS.ink)
    .text(title, MARGIN, top + 76);
  doc.moveDown(0.8);
};

const drawStamp = (doc, label, color) => {
  doc.save();
  doc.rotate(-15, { origin: [doc.page.width - 150, 130] });
  doc
    .roundedRect(doc.page.width - 215, 110, 130, 40, 6)
    .lineWidth(2.5)
    .strokeColor(color)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(color)
    .text(label, doc.page.width - 215, 121, { width: 130, align: "center" });
  doc.restore();
};

/** Seller block on the left, key/value metadata on the right. */
const drawPartiesAndMeta = (doc, seller, meta) => {
  const startY = doc.y;
  const leftWidth = 280;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink);
  doc.text(seller.name || "AirQo", MARGIN, startY, { width: leftWidth });
  doc.font("Helvetica").fillColor(COLORS.muted);
  partyLines(seller).forEach((line) =>
    doc.text(line, { width: leftWidth }),
  );
  const leftBottom = doc.y;

  const rightX = MARGIN + 310;
  let y = startY;
  meta.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").fillColor(COLORS.ink).text(`${label}:`, rightX, y, {
      width: 90,
    });
    doc.font("Helvetica").text(String(value || "-"), rightX + 92, y, { width: 110 });
    y = Math.max(doc.y, y + 14);
  });
  doc.y = Math.max(leftBottom, y) + 18;
  doc.x = MARGIN;
};

const drawBillTo = (doc, billTo, label = "Bill to") => {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(`${label}:`, MARGIN);
  doc.text(billTo.name || "-");
  doc.font("Helvetica").fillColor(COLORS.muted);
  partyLines(billTo).forEach((line) => doc.text(line));
  doc.moveDown(1);
};

const TABLE_COLUMNS = [
  { key: "item", label: "Item", width: 95, align: "left" },
  { key: "description", label: "Description", width: 205, align: "left" },
  { key: "quantity", label: "Qty", width: 45, align: "right" },
  { key: "unit_price", label: "Unit Price", width: 75, align: "right" },
  { key: "amount", label: "Amount", width: 75, align: "right" },
];

const drawTableRow = (doc, cells, { bold = false, color = COLORS.ink } = {}) => {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(color);
  const heights = TABLE_COLUMNS.map((col, i) =>
    doc.heightOfString(String(cells[i] ?? ""), { width: col.width - 6 }),
  );
  const rowHeight = Math.max(...heights) + 10;
  ensureSpace(doc, rowHeight + 4);
  const y = doc.y;
  let x = MARGIN;
  TABLE_COLUMNS.forEach((col, i) => {
    doc.text(String(cells[i] ?? ""), x + 3, y + 5, {
      width: col.width - 6,
      align: col.align,
    });
    x += col.width;
  });
  doc.y = y + rowHeight;
  return y;
};

const drawRule = (doc, weight = 0.5, color = COLORS.line) => {
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .lineWidth(weight)
    .strokeColor(color)
    .stroke();
};

const drawLineItems = (doc, invoice) => {
  const header = TABLE_COLUMNS.map((c) =>
    c.key === "amount" ? `Amount ${invoice.currency}` : c.label,
  );
  drawTableRow(doc, header, { bold: true });
  drawRule(doc, 1.2, COLORS.ink);
  (invoice.line_items || []).forEach((line) => {
    drawTableRow(doc, [
      line.item || "",
      line.description,
      String(line.quantity),
      formatMoney(line.unit_price, invoice.currency),
      formatMoney(line.amount, invoice.currency),
    ]);
    drawRule(doc);
  });
};

const drawTotals = (doc, rows) => {
  doc.moveDown(0.5);
  const labelX = MARGIN + 300;
  rows.forEach(([label, value, emphasis]) => {
    ensureSpace(doc, 20);
    const y = doc.y;
    doc
      .font(emphasis ? "Helvetica-Bold" : "Helvetica")
      .fontSize(emphasis ? 11 : 10)
      .fillColor(COLORS.ink)
      .text(label, labelX, y, { width: 110 });
    doc.text(value, labelX + 110, y, { width: 85, align: "right" });
    doc.y = y + (emphasis ? 18 : 15);
  });
  doc.x = MARGIN;
  doc.moveDown(1);
};

const drawSection = (doc, title, render) => {
  ensureSpace(doc, 60);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.ink).text(title, MARGIN);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted);
  render();
  doc.moveDown(1);
};

const drawFooter = (doc, footer) => {
  if (!footer) return;
  ensureSpace(doc, 40);
  doc.moveDown(1);
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(footer, MARGIN, doc.y, { align: "center" });
};

const titleFor = (invoice) =>
  invoice.kind === "proforma" ? "PRO FORMA INVOICE" : "INVOICE";

const renderInvoicePdf = async (invoice) => {
  const doc = newDocument(`${titleFor(invoice)} ${invoice.invoice_number || "DRAFT"}`);
  const { currency } = invoice;
  drawHeader(doc, titleFor(invoice));

  if (invoice.status === "paid") drawStamp(doc, "PAID", COLORS.paid);
  else if (invoice.status === "void") drawStamp(doc, "VOID", COLORS.void);
  else if (invoice.status === "draft") drawStamp(doc, "DRAFT", COLORS.muted);

  const numberLabel = invoice.kind === "proforma" ? "Pro forma No" : "Invoice No";
  drawPartiesAndMeta(doc, invoice.seller || {}, [
    [numberLabel, invoice.invoice_number || "DRAFT"],
    ["Date", formatDate(invoice.issue_date || invoice.createdAt)],
    [invoice.kind === "proforma" ? "Valid until" : "Due date", formatDate(invoice.due_date)],
    ...(invoice.reference ? [["Reference", invoice.reference]] : []),
  ]);
  drawBillTo(doc, invoice.bill_to || {}, "To");

  if (invoice.subject) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("Subject: ", {
      continued: true,
    });
    doc.font("Helvetica").text(invoice.subject);
    doc.moveDown(1);
  }

  drawLineItems(doc, invoice);

  const totals = [["Subtotal", formatMoney(invoice.subtotal, currency)]];
  if (invoice.discount_amount > 0) {
    totals.push(["Discount", `-${formatMoney(invoice.discount_amount, currency)}`]);
  }
  if (invoice.tax_rate > 0) {
    totals.push([
      `${invoice.tax_label || "Tax"} (${invoice.tax_rate}%)`,
      formatMoney(invoice.tax_amount, currency),
    ]);
  }
  totals.push(["TOTAL", formatMoney(invoice.total, currency), true]);
  if (invoice.amount_paid > 0) {
    totals.push(["Amount paid", `-${formatMoney(invoice.amount_paid, currency)}`]);
    totals.push(["BALANCE DUE", formatMoney(invoice.amount_due, currency), true]);
  }
  drawTotals(doc, totals);

  if (invoice.notes) {
    drawSection(doc, "Notes", () => doc.text(invoice.notes));
  }
  if (invoice.terms && invoice.terms.length) {
    drawSection(doc, "Terms", () =>
      invoice.terms.forEach((term, i) => doc.text(`${i + 1}.  ${term}`)),
    );
  }
  if (invoice.payment_instructions && invoice.payment_instructions.length) {
    drawSection(doc, "Payment Details", () =>
      invoice.payment_instructions.forEach(({ label, value }) =>
        doc.text(label ? `${label}: ${value || ""}` : value || ""),
      ),
    );
  }
  drawFooter(doc, invoice.footer);
  return toBuffer(doc);
};

const METHOD_LABELS = {
  bank_transfer: "Bank transfer",
  card: "Card",
  mobile_money: "Mobile money",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

const renderReceiptPdf = async ({ payment, invoice }) => {
  const doc = newDocument(`Receipt ${payment.receipt_number}`);
  const { currency } = payment;
  drawHeader(doc, "RECEIPT");
  if (payment.status === "void") drawStamp(doc, "VOID", COLORS.void);

  drawPartiesAndMeta(doc, invoice.seller || {}, [
    ["Receipt No", payment.receipt_number],
    ["Date paid", formatDate(payment.paid_at)],
    ["Invoice No", invoice.invoice_number],
  ]);
  drawBillTo(doc, invoice.bill_to || {}, "Received from");

  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(COLORS.ink)
    .text("We received your payment. Thank you for your business!");
  doc.moveDown(1);

  const rows = [
    ["Amount paid", formatMoney(payment.amount, currency)],
    ["Payment method", METHOD_LABELS[payment.method] || payment.method],
    ...(payment.reference ? [["Transaction reference", payment.reference]] : []),
    ["Invoice", `${invoice.invoice_number}${invoice.subject ? ` - ${invoice.subject}` : ""}`],
    ["Invoice total", formatMoney(invoice.total, currency)],
    ["Total paid to date", formatMoney(invoice.amount_paid, currency)],
    ["Balance remaining", formatMoney(invoice.amount_due, currency)],
  ];
  rows.forEach(([label, value]) => {
    ensureSpace(doc, 26);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text(label, MARGIN, y, {
      width: 170,
    });
    doc.font("Helvetica").text(value, MARGIN + 180, y, { width: 315 });
    doc.y = Math.max(doc.y, y + 14) + 6;
    drawRule(doc);
    doc.y += 6;
  });

  if (payment.notes) {
    doc.moveDown(1);
    drawSection(doc, "Notes", () => doc.text(payment.notes));
  }
  drawFooter(doc, invoice.footer);
  return toBuffer(doc);
};

module.exports = { renderInvoicePdf, renderReceiptPdf, METHOD_LABELS };
