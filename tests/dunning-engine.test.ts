import { describe, it, expect, beforeEach } from 'vitest';
import { DunningEngine } from '../src/lib/accounting/dunning-engine';
import { dbClient } from '../src/db/client';

describe('Phase 4.7: Automated Multi-Stage Dunning Dispatcher (DunningEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const customerAccountId = '01916362-7901-7080-867c-acc000000001';

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // Clear state
    dbClient.customerInvoices.clear();
    dbClient.dunningRecords.clear();
    dbClient.accounts.clear();

    // Seed account
    await dbClient.insertAccount({
      tenantId,
      name: 'Midwest Manufacturing LLC',
      accountType: 'SHIPPER',
      contactName: 'Robert Sterling',
      contactEmail: 'ap@midwestmfg.com',
      contactPhone: '555-0812',
      billingAddressLine1: '500 Factory Way',
      billingCity: 'Cleveland',
      billingState: 'OH',
      billingZip: '44101',
      creditLimitCents: 2000000,
      paymentTermsDays: 30,
    });
    const acc = Array.from(dbClient.accounts.values())[0];
    dbClient.accounts.delete(acc.id);
    acc.id = customerAccountId;
    dbClient.accounts.set(customerAccountId, acc);
  });

  describe('Dunning Stage Determination', () => {
    it('accurately resolves dunning stages based on days past due', () => {
      expect(DunningEngine.determineDunningStage(-5)).toBe('REMINDER_T_MINUS_5');
      expect(DunningEngine.determineDunningStage(0)).toBe('DUE_TODAY_T_0');
      expect(DunningEngine.determineDunningStage(7)).toBe('PAST_DUE_T_PLUS_7');
      expect(DunningEngine.determineDunningStage(14)).toBe('URGENT_T_PLUS_14');
      expect(DunningEngine.determineDunningStage(30)).toBe('FINAL_DEMAND_T_PLUS_30');
      expect(DunningEngine.determineDunningStage(45)).toBe('FINAL_DEMAND_T_PLUS_30');

      // Non-milestone days return null or appropriate stage
      expect(DunningEngine.determineDunningStage(-10)).toBeNull();
      expect(DunningEngine.determineDunningStage(3)).toBeNull();
    });
  });

  describe('Email Template & Late Fee Generation', () => {
    it('generates courteous reminder for Day -5 with payment link', () => {
      const invoice = {
        id: '01916362-7901-7080-867c-inv000000001',
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000001',
        customerAccountId,
        invoiceNumber: 'INV-2026-88001',
        customerPoNumber: 'PO-MWM-4401',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 100000,
        fuelSurchargeCents: 20000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 120000, // $1,200.00
        currency: 'USD' as const,
        paymentTermsDays: 30,
        invoiceDate: '2026-08-05',
        dueDate: '2026-09-05',
        remitInstructions: {
          bankName: 'JPMorgan Chase',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'billing@apexfreightos.com',
          remitAddress: '1000 Logistics Blvd, Chicago IL',
        },
        status: 'ISSUED' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const template = DunningEngine.generateDunningTemplate(invoice, 'REMINDER_T_MINUS_5', -5);

      expect(template.stage).toBe('REMINDER_T_MINUS_5');
      expect(template.subject).toContain('[COURTESY REMINDER]');
      expect(template.subject).toContain('INV-2026-88001');
      expect(template.subject).toContain('$1200.00');
      expect(template.lateFeeCents).toBe(0);
      expect(template.paymentUrl).toContain('INV-2026-88001');
      expect(template.creditHoldTriggered).toBe(false);
    });

    it('calculates 1.5% late fee on Day +14 urgent dunning stage', () => {
      const invoice = {
        id: '01916362-7901-7080-867c-inv000000002',
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000002',
        customerAccountId,
        invoiceNumber: 'INV-2026-88002',
        customerPoNumber: 'PO-MWM-4402',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 200000,
        fuelSurchargeCents: 0,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 200000, // $2,000.00
        currency: 'USD' as const,
        paymentTermsDays: 30,
        invoiceDate: '2026-07-15',
        dueDate: '2026-08-15',
        remitInstructions: {
          bankName: 'JPMorgan Chase',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'billing@apexfreightos.com',
          remitAddress: '1000 Logistics Blvd, Chicago IL',
        },
        status: 'ISSUED' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const template = DunningEngine.generateDunningTemplate(invoice, 'URGENT_T_PLUS_14', 14);

      expect(template.stage).toBe('URGENT_T_PLUS_14');
      expect(template.subject).toContain('[URGENT: 14 DAYS OVERDUE]');
      // 1.5% of $2,000.00 is $30.00 (3000 cents)
      expect(template.lateFeeCents).toBe(3000);
      expect(template.emailHtml).toContain('+$30.00');
      expect(template.creditHoldTriggered).toBe(false);
    });

    it('triggers credit hold on Day +30 final demand stage', () => {
      const invoice = {
        id: '01916362-7901-7080-867c-inv000000003',
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp000000003',
        customerAccountId,
        invoiceNumber: 'INV-2026-88003',
        customerPoNumber: 'PO-MWM-4403',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 150000,
        fuelSurchargeCents: 0,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 150000,
        currency: 'USD' as const,
        paymentTermsDays: 30,
        invoiceDate: '2026-07-01',
        dueDate: '2026-08-01',
        remitInstructions: {
          bankName: 'JPMorgan Chase',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'billing@apexfreightos.com',
          remitAddress: '1000 Logistics Blvd, Chicago IL',
        },
        status: 'ISSUED' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const template = DunningEngine.generateDunningTemplate(invoice, 'FINAL_DEMAND_T_PLUS_30', 31);

      expect(template.creditHoldTriggered).toBe(true);
      expect(template.subject).toContain('[FINAL DEMAND & CREDIT HOLD]');
      expect(template.bodySnippet).toContain('Account has been placed on CREDIT HOLD');
    });
  });

  describe('Multi-Stage Automated Dispatch & Deduplication', () => {
    it('evaluates multiple invoices, dispatches appropriate stages, and enforces deduplication', async () => {
      const asOfDate = '2026-09-01';

      // Invoice 1: Due in 5 days (2026-09-06) -> REMINDER_T_MINUS_5
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-d1',
        customerAccountId,
        invoiceNumber: 'INV-STAGE-T-MINUS-5',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 80000,
        fuelSurchargeCents: 10000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 90000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-08-07',
        dueDate: '2026-09-06', // 5 days in future
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

      // Invoice 2: Due Today (2026-09-01) -> DUE_TODAY_T_0
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-d2',
        customerAccountId,
        invoiceNumber: 'INV-STAGE-T-0',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 120000,
        fuelSurchargeCents: 15000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 135000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-08-02',
        dueDate: '2026-09-01', // Due today
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

      // Invoice 3: 7 Days Past Due (Due 2026-08-25) -> PAST_DUE_T_PLUS_7
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-d3',
        customerAccountId,
        invoiceNumber: 'INV-STAGE-T-PLUS-7',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 100000,
        fuelSurchargeCents: 10000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 110000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-07-26',
        dueDate: '2026-08-25', // 7 days past due
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

      // Invoice 4: 14 Days Past Due (Due 2026-08-18) -> URGENT_T_PLUS_14
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-d4',
        customerAccountId,
        invoiceNumber: 'INV-STAGE-T-PLUS-14',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 150000,
        fuelSurchargeCents: 20000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 170000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-07-19',
        dueDate: '2026-08-18', // 14 days past due
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

      // Invoice 5: 35 Days Past Due (Due 2026-07-28) -> FINAL_DEMAND_T_PLUS_30 (Credit Hold)
      await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: '01916362-7901-7080-867c-shp-d5',
        customerAccountId,
        invoiceNumber: 'INV-STAGE-T-PLUS-30',
        shipperName: 'Midwest Manufacturing LLC',
        shipperEmail: 'ap@midwestmfg.com',
        shipperAddress: '500 Factory Way, Cleveland OH',
        linehaulAmountCents: 250000,
        fuelSurchargeCents: 30000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 280000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-06-28',
        dueDate: '2026-07-28', // 35 days past due
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

      // 1. First Run: Dispatches all 5 dunning stages
      const firstRun = await DunningEngine.evaluateAndDispatchDunning(tenantId, asOfDate);

      expect(firstRun.totalInvoicesEvaluated).toBe(5);
      expect(firstRun.eligibleDunningCount).toBe(5);
      expect(firstRun.alreadyDispatchedCount).toBe(0);
      expect(firstRun.dispatchedActions.length).toBe(5);

      // Verify Stage Breakdown
      expect(firstRun.summaryByStage.REMINDER_T_MINUS_5).toBe(1);
      expect(firstRun.summaryByStage.DUE_TODAY_T_0).toBe(1);
      expect(firstRun.summaryByStage.PAST_DUE_T_PLUS_7).toBe(1);
      expect(firstRun.summaryByStage.URGENT_T_PLUS_14).toBe(1);
      expect(firstRun.summaryByStage.FINAL_DEMAND_T_PLUS_30).toBe(1);

      // Verify Credit Hold Triggered for 30+ day invoice
      expect(firstRun.creditHoldsTriggered.length).toBe(1);
      expect(firstRun.creditHoldsTriggered[0].invoiceNumber).toBe('INV-STAGE-T-PLUS-30');
      expect(firstRun.creditHoldsTriggered[0].accountId).toBe(customerAccountId);

      // 2. Second Run immediately afterwards: Deduplication Guard skips already dispatched
      const secondRun = await DunningEngine.evaluateAndDispatchDunning(tenantId, asOfDate);

      expect(secondRun.totalInvoicesEvaluated).toBe(5);
      expect(secondRun.eligibleDunningCount).toBe(5);
      expect(secondRun.alreadyDispatchedCount).toBe(5);
      expect(secondRun.dispatchedActions.length).toBe(0); // Zero duplicates dispatched
      expect(secondRun.creditHoldsTriggered.length).toBe(0);
    });
  });
});
