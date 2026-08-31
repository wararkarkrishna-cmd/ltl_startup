import { describe, it, expect, beforeEach } from 'vitest';
import { ArAgingEngine } from '../src/lib/accounting/ar-aging-engine';
import { dbClient } from '../src/db/client';

describe('Phase 4.7: Accounts Receivable (AR) Aging Engine (ArAgingEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const accountId1 = '01916362-7901-7080-867c-acc000000001';
  const accountId2 = '01916362-7901-7080-867c-acc000000002';

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // Clear previous invoice records for clean state
    dbClient.customerInvoices.clear();
    dbClient.accounts.clear();

    // Seed customer accounts
    await dbClient.insertAccount({
      tenantId,
      name: 'Acme Distribution Logistics',
      accountType: 'SHIPPER',
      contactName: 'Sarah Jenkins',
      contactEmail: 'ap@acmedist.com',
      contactPhone: '555-0199',
      billingAddressLine1: '100 Industrial Parkway',
      billingCity: 'Dallas',
      billingState: 'TX',
      billingZip: '75201',
      creditLimitCents: 5000000, // $50,000 credit limit
      paymentTermsDays: 30,
    });
    const acc1 = Array.from(dbClient.accounts.values())[0];
    dbClient.accounts.delete(acc1.id);
    acc1.id = accountId1;
    dbClient.accounts.set(accountId1, acc1);

    await dbClient.insertAccount({
      tenantId,
      name: 'Delinquent Freight Inc',
      accountType: 'SHIPPER',
      contactName: 'Bob Vance',
      contactEmail: 'ap@delinquentfreight.com',
      contactPhone: '555-0288',
      billingAddressLine1: '900 Slow Pay Rd',
      billingCity: 'Chicago',
      billingState: 'IL',
      billingZip: '60607',
      creditLimitCents: 1000000, // $10,000 credit limit
      paymentTermsDays: 30,
    });
    const acc2 = Array.from(dbClient.accounts.values())[1];
    dbClient.accounts.delete(acc2.id);
    acc2.id = accountId2;
    dbClient.accounts.set(accountId2, acc2);
  });

  describe('Bucket Classification Logic', () => {
    it('accurately categorizes days past due into standard AR aging buckets', () => {
      expect(ArAgingEngine.getBucketForDaysPastDue(-10)).toBe('CURRENT');
      expect(ArAgingEngine.getBucketForDaysPastDue(0)).toBe('CURRENT');

      expect(ArAgingEngine.getBucketForDaysPastDue(1)).toBe('PAST_DUE_1_30');
      expect(ArAgingEngine.getBucketForDaysPastDue(15)).toBe('PAST_DUE_1_30');
      expect(ArAgingEngine.getBucketForDaysPastDue(30)).toBe('PAST_DUE_1_30');

      expect(ArAgingEngine.getBucketForDaysPastDue(31)).toBe('PAST_DUE_31_60');
      expect(ArAgingEngine.getBucketForDaysPastDue(45)).toBe('PAST_DUE_31_60');
      expect(ArAgingEngine.getBucketForDaysPastDue(60)).toBe('PAST_DUE_31_60');

      expect(ArAgingEngine.getBucketForDaysPastDue(61)).toBe('PAST_DUE_61_90');
      expect(ArAgingEngine.getBucketForDaysPastDue(75)).toBe('PAST_DUE_61_90');
      expect(ArAgingEngine.getBucketForDaysPastDue(90)).toBe('PAST_DUE_61_90');

      expect(ArAgingEngine.getBucketForDaysPastDue(91)).toBe('PAST_DUE_90_PLUS');
      expect(ArAgingEngine.getBucketForDaysPastDue(120)).toBe('PAST_DUE_90_PLUS');
    });
  });

  describe('Portfolio-Wide AR Aging Analysis', () => {
    it('analyzes portfolio AR aging, buckets invoices, and computes weighted DSO & Bad Debt Risk Score', async () => {
      const asOfDate = '2026-09-01';

      // Seed 5 Invoices spanning all 5 aging buckets:
      // 1. Current (Due 2026-09-15, issued 2026-08-15) -> daysPastDue: -14 -> CURRENT ($1,000.00)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000001',
        customerAccountId: accountId1,
        invoiceNumber: 'INV-2026-00001',
        shipperName: 'Acme Distribution Logistics',
        shipperEmail: 'ap@acmedist.com',
        shipperAddress: '100 Industrial Parkway, Dallas, TX 75201',
        linehaulAmountCents: 85000,
        fuelSurchargeCents: 15000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 100000, // $1,000.00
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-08-15',
        dueDate: '2026-09-15',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
        paidAt: null,
      });

      // 2. 1-30 Days Overdue (Due 2026-08-15, issued 2026-07-15) -> daysPastDue: +17 -> PAST_DUE_1_30 ($2,000.00)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000002',
        customerAccountId: accountId1,
        invoiceNumber: 'INV-2026-00002',
        shipperName: 'Acme Distribution Logistics',
        shipperEmail: 'ap@acmedist.com',
        shipperAddress: '100 Industrial Parkway, Dallas, TX 75201',
        linehaulAmountCents: 170000,
        fuelSurchargeCents: 30000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 200000, // $2,000.00
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-07-15',
        dueDate: '2026-08-15',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
        paidAt: null,
      });

      // 3. 31-60 Days Overdue (Due 2026-07-15, issued 2026-06-15) -> daysPastDue: +48 -> PAST_DUE_31_60 ($1,500.00)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000003',
        customerAccountId: accountId1,
        invoiceNumber: 'INV-2026-00003',
        shipperName: 'Acme Distribution Logistics',
        shipperEmail: 'ap@acmedist.com',
        shipperAddress: '100 Industrial Parkway, Dallas, TX 75201',
        linehaulAmountCents: 130000,
        fuelSurchargeCents: 20000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 150000, // $1,500.00
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-06-15',
        dueDate: '2026-07-15',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
        paidAt: null,
      });

      // 4. 61-90 Days Overdue (Due 2026-06-15, issued 2026-05-15) -> daysPastDue: +78 -> PAST_DUE_61_90 ($500.00)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000004',
        customerAccountId: accountId2,
        invoiceNumber: 'INV-2026-00004',
        shipperName: 'Delinquent Freight Inc',
        shipperEmail: 'ap@delinquentfreight.com',
        shipperAddress: '900 Slow Pay Rd, Chicago, IL 60607',
        linehaulAmountCents: 45000,
        fuelSurchargeCents: 5000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 50000, // $500.00
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-05-15',
        dueDate: '2026-06-15',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
        paidAt: null,
      });

      // 5. 90+ Days Overdue (Due 2026-05-01, issued 2026-04-01) -> daysPastDue: +123 -> PAST_DUE_90_PLUS ($1,000.00)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000005',
        customerAccountId: accountId2,
        invoiceNumber: 'INV-2026-00005',
        shipperName: 'Delinquent Freight Inc',
        shipperEmail: 'ap@delinquentfreight.com',
        shipperAddress: '900 Slow Pay Rd, Chicago, IL 60607',
        linehaulAmountCents: 90000,
        fuelSurchargeCents: 10000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 100000, // $1,000.00
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-04-01',
        dueDate: '2026-05-01',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
        paidAt: null,
      });

      // 6. Seed a PAID invoice (should be excluded from aging)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-paid',
        customerAccountId: accountId1,
        invoiceNumber: 'INV-2026-PAID',
        shipperName: 'Acme Distribution Logistics',
        shipperEmail: 'ap@acmedist.com',
        shipperAddress: '100 Industrial Parkway, Dallas, TX 75201',
        linehaulAmountCents: 50000,
        fuelSurchargeCents: 10000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 60000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-03-01',
        dueDate: '2026-04-01',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'PAID',
        paidAt: new Date(),
      });

      const summary = await ArAgingEngine.analyzeArAging(tenantId, asOfDate);

      // Verify Open Invoices count
      expect(summary.totalOpenInvoices).toBe(5);

      // Total AR: $1,000 + $2,000 + $1,500 + $500 + $1,000 = $6,000.00 (600,000 cents)
      expect(summary.totalArOutstandingCents).toBe(600000);
      expect(summary.currentTotalCents).toBe(100000); // $1,000.00
      expect(summary.overdueTotalCents).toBe(500000); // $5,000.00
      expect(summary.overduePercentage).toBe(83.33);

      // Buckets Breakdown
      expect(summary.buckets.CURRENT.invoiceCount).toBe(1);
      expect(summary.buckets.CURRENT.totalAmountCents).toBe(100000);

      expect(summary.buckets.PAST_DUE_1_30.invoiceCount).toBe(1);
      expect(summary.buckets.PAST_DUE_1_30.totalAmountCents).toBe(200000);

      expect(summary.buckets.PAST_DUE_31_60.invoiceCount).toBe(1);
      expect(summary.buckets.PAST_DUE_31_60.totalAmountCents).toBe(150000);

      expect(summary.buckets.PAST_DUE_61_90.invoiceCount).toBe(1);
      expect(summary.buckets.PAST_DUE_61_90.totalAmountCents).toBe(50000);

      expect(summary.buckets.PAST_DUE_90_PLUS.invoiceCount).toBe(1);
      expect(summary.buckets.PAST_DUE_90_PLUS.totalAmountCents).toBe(100000);

      // DSO & Risk Metrics
      expect(summary.weightedAverageDsoDays).toBeGreaterThan(45);
      expect(summary.badDebtRiskScore).toBeGreaterThan(25);
      expect(['MODERATE', 'ELEVATED']).toContain(summary.badDebtRiskCategory);

      // Customer Accounts Breakdown
      expect(summary.customerAccounts.length).toBe(2);
      const delinquentAcc = summary.customerAccounts.find((a) => a.accountId === accountId2);
      expect(delinquentAcc).toBeDefined();
      expect(delinquentAcc?.maxDaysPastDue).toBe(123);
      expect(delinquentAcc?.isCreditHoldRecommended).toBe(true);
    });
  });

  describe('Account Specific AR Aging', () => {
    it('retrieves aging for an individual customer account', async () => {
      // Seed an invoice for Account 1
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-single',
        customerAccountId: accountId1,
        invoiceNumber: 'INV-2026-ACME-01',
        shipperName: 'Acme Distribution Logistics',
        shipperEmail: 'ap@acmedist.com',
        shipperAddress: '100 Industrial Parkway, Dallas, TX 75201',
        linehaulAmountCents: 100000,
        fuelSurchargeCents: 20000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 120000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-31',
        remitInstructions: {
          bankName: 'Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@freightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
        paidAt: null,
      });

      const accAging = await ArAgingEngine.analyzeAccountArAging(tenantId, accountId1, '2026-09-01');
      expect(accAging).toBeDefined();
      expect(accAging?.accountName).toBe('Acme Distribution Logistics');
      expect(accAging?.totalOutstandingCents).toBe(120000);
      expect(accAging?.openInvoiceCount).toBe(1);
      expect(accAging?.maxDaysPastDue).toBe(1); // 2026-09-01 minus 2026-08-31
    });
  });
});
