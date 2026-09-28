require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const money = require("@utils/billing-money.util");
const billing = require("@utils/billing.util");
const { mailer } = require("@utils/common");
const InvoiceModel = require("@models/Invoice");
const PaymentModel = require("@models/Payment");
const BillingCustomerModel = require("@models/BillingCustomer");
const BillingSettingsModel = require("@models/BillingSettings");
const BillingSequenceModel = require("@models/BillingSequence");

const TENANT = "airqo";
const admin = { _id: new mongoose.Types.ObjectId(), email: "billing@example.com" };
const req = ({ params = {}, body = {}, query = {} } = {}) => ({
  params,
  body,
  query: { tenant: TENANT, ...query },
  user: admin,
});
const day = (offset) => moment.utc().add(offset, "days").format("YYYY-MM-DD");

describe("billing-money.util", () => {
  it("computes line amounts and totals in minor units", () => {
    const totals = money.computeTotals({
      currency: "USD",
      line_items: [
        { description: "Outdoor air quality monitor", quantity: 50, unit_price: 540 },
        { description: "Shipping", quantity: 1, unit_price: 2000 },
        { description: "Float trap", quantity: 3, unit_price: 0.1 },
      ],
      discount_amount: 0.3,
      tax_rate: 18,
    });
    expect(totals.subtotal).to.equal(29000.3);
    expect(totals.discount_amount).to.equal(0.3);
    expect(totals.tax_amount).to.equal(5220);
    expect(totals.total).to.equal(34220);
    expect(totals.amount_due).to.equal(34220);
    expect(totals.line_items[2].amount).to.equal(0.3);
  });

  it("respects zero-decimal currencies and caps discounts", () => {
    expect(money.currencyDecimals("UGX")).to.equal(0);
    const totals = money.computeTotals({
      currency: "UGX",
      line_items: [{ description: "x", quantity: 1, unit_price: 1000.6 }],
      discount_amount: 5000,
    });
    expect(totals.subtotal).to.equal(1001);
    expect(totals.discount_amount).to.equal(1001);
    expect(totals.total).to.equal(0);
  });

  it("derives payment status and keeps terminal statuses", () => {
    const base = { total: 100, currency: "USD" };
    expect(money.deriveStatus({ ...base, status: "open", amount_paid: 0 })).to.equal("open");
    expect(money.deriveStatus({ ...base, status: "open", amount_paid: 40 })).to.equal("partially_paid");
    expect(money.deriveStatus({ ...base, status: "partially_paid", amount_paid: 100 })).to.equal("paid");
    expect(money.deriveStatus({ ...base, status: "void", amount_paid: 0 })).to.equal("void");
  });

  it("validates currency codes", () => {
    expect(money.isValidCurrency("KES")).to.equal(true);
    expect(money.isValidCurrency("usd")).to.equal(false);
    expect(money.isValidCurrency("XX")).to.equal(false);
  });
});

describe("billing.util", function () {
  this.timeout(20000);
  let customer;

  beforeEach(async () => {
    await Promise.all(
      [InvoiceModel, PaymentModel, BillingCustomerModel, BillingSettingsModel, BillingSequenceModel].map(
        (Model) => Model(TENANT).deleteMany({}),
      ),
    );
    sinon.stub(mailer, "invoiceIssued").resolves({ success: true });
    sinon.stub(mailer, "paymentReceipt").resolves({ success: true });
    sinon.stub(mailer, "invoiceReminder").resolves({ success: true });
    const created = await billing.createCustomer(
      req({
        body: {
          name: "Example Research Institute Ltd",
          billing_emails: ["Accounts@Example.com", "accounts@example.com"],
          address_lines: ["P.O. Box 1234, Example City, 0000"],
          tax_id: "000 000 0000",
        },
      }),
    );
    customer = created.data;
  });

  afterEach(() => sinon.restore());

  const draft = async (overrides = {}) =>
    (
      await billing.createInvoice(
        req({
          body: {
            customer_id: String(customer._id),
            subject: "Supply of Air Quality Monitoring Services",
            line_items: [
              { item: "Equipment", description: "Outdoor air quality monitor", quantity: 50, unit_price: 540 },
              { item: "Shipping", description: "Shipping", quantity: 1, unit_price: 2000 },
            ],
            ...overrides,
          },
        }),
      )
    ).data;

  it("dedupes billing emails and applies settings defaults to drafts", async () => {
    expect(customer.billing_emails).to.deep.equal(["accounts@example.com"]);
    const invoice = await draft();
    expect(invoice.status).to.equal("draft");
    expect(invoice.invoice_number).to.equal(undefined);
    expect(invoice.total).to.equal(29000);
    expect(invoice.payment_terms_days).to.equal(30);
    expect(invoice.terms).to.have.length(2);
  });

  it("runs the full invoice -> partial payment -> paid -> void payment lifecycle", async () => {
    const invoice = await draft();
    const finalized = await billing.finalizeInvoice(
      req({ params: { invoiceId: invoice._id }, body: { send: true } }),
    );
    expect(finalized.success).to.equal(true);
    const issued = finalized.data.invoice;
    const year = moment.utc().format("YYYY");
    expect(issued.invoice_number).to.equal(`AQ-INV-${year}-0001`);
    expect(issued.status).to.equal("open");
    expect(moment.utc(issued.due_date).diff(moment.utc(issued.issue_date), "days")).to.equal(30);
    expect(finalized.data.email.sent).to.equal(true);
    const mailed = mailer.invoiceIssued.firstCall.args[0];
    expect(mailed.recipients).to.deep.equal(["accounts@example.com"]);
    expect(mailed.pdf.content).to.be.a("string");
    expect(JSON.stringify(mailed.pdf)).to.not.include(mailed.pdf.content.slice(0, 20));

    const edit = await billing.updateInvoice(
      req({ params: { invoiceId: invoice._id }, body: { subject: "changed" } }),
    );
    expect(edit.status).to.equal(409);

    const tooMuch = await billing.recordPayment(
      req({ params: { invoiceId: invoice._id }, body: { amount: 30000 } }),
    );
    expect(tooMuch.status).to.equal(400);

    const first = await billing.recordPayment(
      req({
        params: { invoiceId: invoice._id },
        body: { amount: 9000, method: "bank_transfer", reference: "BANK-REF-001" },
      }),
    );
    expect(first.success).to.equal(true);
    expect(first.data.payment.receipt_number).to.equal(`AQ-RCT-${year}-0001`);
    expect(first.data.invoice.status).to.equal("partially_paid");
    expect(first.data.invoice.amount_due).to.equal(20000);
    expect(mailer.paymentReceipt.calledOnce).to.equal(true);

    const second = await billing.recordPayment(
      req({ params: { invoiceId: invoice._id }, body: { amount: 20000, send_receipt: false } }),
    );
    expect(second.data.invoice.status).to.equal("paid");
    expect(second.data.invoice.paid_at).to.be.an.instanceOf(Date);
    expect(mailer.paymentReceipt.calledOnce).to.equal(true);

    const cannotVoid = await billing.voidInvoice(req({ params: { invoiceId: invoice._id } }));
    expect(cannotVoid.status).to.equal(409);

    const voided = await billing.voidPayment(
      req({ params: { paymentId: second.data.payment._id }, body: { reason: "bounced" } }),
    );
    expect(voided.data.payment.status).to.equal("void");
    expect(voided.data.invoice.status).to.equal("partially_paid");
    expect(voided.data.invoice.amount_paid).to.equal(9000);
    expect(voided.data.invoice.paid_at).to.equal(undefined);

    const pdf = await billing.getInvoicePdf(req({ params: { invoiceId: invoice._id } }));
    expect(pdf.pdf.slice(0, 5).toString()).to.equal("%PDF-");
    const receipt = await billing.getReceiptPdf(
      req({ params: { paymentId: first.data.payment._id } }),
    );
    expect(receipt.pdf.slice(0, 5).toString()).to.equal("%PDF-");

    const detail = await billing.getInvoice(req({ params: { invoiceId: invoice._id } }));
    expect(detail.data.payments).to.have.length(2);
    expect(detail.data.history.map((h) => h.event)).to.include.members([
      "created",
      "finalized",
      "sent",
      "payment_recorded",
      "payment_voided",
    ]);
  });

  it("backfills historical documents with their original numbers and dates", async () => {
    const invoice = await draft({ kind: "proforma" });
    const finalized = await billing.finalizeInvoice(
      req({
        params: { invoiceId: invoice._id },
        body: { invoice_number: "DOC-1001/26", issue_date: "2026-09-24" },
      }),
    );
    expect(finalized.data.invoice.invoice_number).to.equal("DOC-1001/26");
    expect(finalized.data.email.sent).to.equal(false);
    expect(mailer.invoiceIssued.called).to.equal(false);

    const other = await draft();
    const clash = await billing.finalizeInvoice(
      req({ params: { invoiceId: other._id }, body: { invoice_number: "DOC-1001/26" } }),
    );
    expect(clash.status).to.equal(409);

    const noPayOnProforma = await billing.recordPayment(
      req({ params: { invoiceId: invoice._id }, body: { amount: 10 } }),
    );
    expect(noPayOnProforma.status).to.equal(400);

    const converted = await billing.convertProforma(req({ params: { invoiceId: invoice._id } }));
    expect(converted.data.kind).to.equal("invoice");
    expect(converted.data.status).to.equal("draft");
    expect(converted.data.reference).to.equal("DOC-1001/26");
    const proforma = await InvoiceModel(TENANT).findById(invoice._id).lean();
    expect(proforma.status).to.equal("converted");

    const issued = await billing.finalizeInvoice(
      req({ params: { invoiceId: converted.data._id }, body: { issue_date: "2026-09-25" } }),
    );
    const paid = await billing.recordPayment(
      req({
        params: { invoiceId: converted.data._id },
        body: {
          amount: 29000,
          paid_at: "2026-09-30T10:00:00Z",
          receipt_number: "RCPT-OLD-7",
          send_receipt: false,
        },
      }),
    );
    expect(issued.success).to.equal(true);
    expect(paid.data.payment.receipt_number).to.equal("RCPT-OLD-7");
    expect(paid.data.invoice.paid_at.toISOString()).to.equal("2026-09-30T10:00:00.000Z");
  });

  it("follows the configured number format, start and shared series", async () => {
    await billing.updateSettings(
      req({
        body: {
          number_prefix: "DOC",
          number_format: "{prefix}-{seq}/{yy}",
          sequence_starts: { invoice: 1002 },
        },
      }),
    );
    const settings = await billing.getSettings(TENANT);
    const date = new Date("2026-10-01T00:00:00Z");
    expect(await billing.nextNumber(TENANT, "proforma", settings, date)).to.equal("DOC-1002/26");
    expect(await billing.nextNumber(TENANT, "invoice", settings, date)).to.equal("DOC-1003/26");
    expect(await billing.nextNumber(TENANT, "receipt", settings, date)).to.equal("DOC-1/26");
    expect(settings.seller.name).to.equal("AirQo");
  });

  it("only drafts can be deleted and org views hide drafts and internals", async () => {
    const groupId = new mongoose.Types.ObjectId();
    // Linking through updateCustomer needs a real organisation; link directly.
    await BillingCustomerModel(TENANT).updateOne({ _id: customer._id }, { group_id: groupId });
    const kept = await draft();
    const removable = await draft();
    await billing.finalizeInvoice(req({ params: { invoiceId: kept._id } }));

    const removed = await billing.deleteInvoice(req({ params: { invoiceId: removable._id } }));
    expect(removed.success).to.equal(true);
    const refused = await billing.deleteInvoice(req({ params: { invoiceId: kept._id } }));
    expect(refused.status).to.equal(409);

    await draft(); // another draft, invisible to members
    const list = await billing.groupInvoices(
      req({ params: { grp_id: String(groupId) }, query: { limit: 10 } }),
    );
    expect(list.data.items).to.have.length(1);
    expect(list.data.items[0]).to.not.have.property("history");
    expect(list.data.items[0]).to.not.have.property("created_by");
  });

  it("does not report a deduplicated email as sent", async () => {
    const invoice = await draft();
    await billing.finalizeInvoice(req({ params: { invoiceId: invoice._id } }));
    mailer.invoiceIssued.resolves({ success: true, data: { duplicate: true } });
    const result = await billing.sendInvoice(req({ params: { invoiceId: invoice._id } }));
    expect(result.status).to.equal(422);
    const stored = await InvoiceModel(TENANT).findById(invoice._id).lean();
    expect(stored.sent_count).to.equal(0);
    expect(stored.history.map((h) => h.event)).to.not.include("sent");
  });

  describe("reminders", () => {
    const settings = { reminder_days_before_due: [3], reminder_days_after_due: [1, 7, 14, 30] };
    const today = moment.utc().startOf("day");

    it("sends only the most relevant pending reminder and marks skipped ones", () => {
      const invoice = { due_date: today.clone().subtract(10, "days").toDate(), reminders_sent: [] };
      expect(billing.pendingReminder(invoice, settings, today)).to.deep.equal({
        key: "after_7",
        markAsSent: ["after_7", "after_1"],
      });
      invoice.reminders_sent = [{ key: "after_7" }, { key: "after_1" }];
      expect(billing.pendingReminder(invoice, settings, today)).to.equal(null);
    });

    it("skips due-soon reminders for invoices sent in the last two days", () => {
      const invoice = {
        due_date: today.clone().add(2, "days").toDate(),
        sent_at: today.clone().subtract(1, "day").toDate(),
      };
      expect(billing.pendingReminder(invoice, settings, today)).to.equal(null);
      invoice.sent_at = today.clone().subtract(5, "days").toDate();
      expect(billing.pendingReminder(invoice, settings, today).key).to.equal("before_3");
    });

    it("never reminds backfilled invoices that were not sent", async () => {
      const unsent = await draft();
      await billing.finalizeInvoice(
        req({ params: { invoiceId: unsent._id }, body: { issue_date: day(-60), due_date: day(-30) } }),
      );
      const sent = await draft();
      await billing.finalizeInvoice(
        req({ params: { invoiceId: sent._id }, body: { issue_date: day(-60), due_date: day(-8) } }),
      );
      await billing.markInvoiceSent(
        req({ params: { invoiceId: sent._id }, body: { sent_at: moment.utc().subtract(60, "days").toISOString() } }),
      );

      const result = await billing.runInvoiceReminders(TENANT);
      expect(result).to.deep.include({ checked: 1, sent: 1, failed: 0 });
      expect(mailer.invoiceReminder.firstCall.args[0]).to.include({ overdue: true, key: "after_7" });

      const again = await billing.runInvoiceReminders(TENANT);
      expect(again.sent).to.equal(0);
    });
  });
});
