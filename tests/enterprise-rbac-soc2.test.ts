import { describe, it, expect } from 'vitest';
import { RbacEngine } from '../src/lib/security/rbac-engine';
import { Soc2ComplianceEngine } from '../src/lib/security/soc2-compliance-engine';

describe('Phase 6.8: Enterprise RBAC Authorization Matrix & SOC2 Type II Continuous Compliance', () => {
  const tenant1 = '01916362-7901-7080-867c-9b8895092a01';
  const tenant2 = '01916362-7901-7080-867c-9b8895092a02';

  it('verifies granular role permissions according to enterprise security matrix', () => {
    // Owner can perform all actions
    expect(RbacEngine.checkPermission('OWNER', 'INITIATE_QUICKPAY').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('OWNER', 'APPROVE_DISPUTE').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('OWNER', 'MANAGE_USERS').isAuthorized).toBe(true);

    // Dispatcher can dispatch but CANNOT initiate financial payouts
    expect(RbacEngine.checkPermission('DISPATCHER', 'DISPATCH_LOAD').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('DISPATCHER', 'INITIATE_QUICKPAY').isAuthorized).toBe(false);
    expect(RbacEngine.checkPermission('DISPATCHER', 'RECONCILE_BANK_STATEMENTS').isAuthorized).toBe(false);

    // Billing Specialist can initiate quickpay and reconcile bank statements, but CANNOT manage users
    expect(RbacEngine.checkPermission('BILLING_SPECIALIST', 'INITIATE_QUICKPAY').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('BILLING_SPECIALIST', 'RECONCILE_BANK_STATEMENTS').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('BILLING_SPECIALIST', 'MANAGE_USERS').isAuthorized).toBe(false);

    // Read-only Auditor can view reports but CANNOT mutate state
    expect(RbacEngine.checkPermission('READ_ONLY_AUDITOR', 'VIEW_FINANCIAL_LEDGER').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('READ_ONLY_AUDITOR', 'VIEW_SOC2_REPORT').isAuthorized).toBe(true);
    expect(RbacEngine.checkPermission('READ_ONLY_AUDITOR', 'DISPATCH_LOAD').isAuthorized).toBe(false);
    expect(RbacEngine.checkPermission('READ_ONLY_AUDITOR', 'GENERATE_INVOICE').isAuthorized).toBe(false);
  });

  it('strictly blocks cross-tenant access attempts', () => {
    expect(() => {
      RbacEngine.enforceTenantIsolation(tenant1, tenant2, 'Carrier Payout Record');
    }).toThrow(/Cross-Tenant Access Prohibited/);

    expect(() => {
      RbacEngine.enforceTenantIsolation(tenant1, tenant1, 'Carrier Payout Record');
    }).not.toThrow();
  });

  it('runs continuous automated SOC2 Type II compliance audit with 100% passing controls', async () => {
    const report = await Soc2ComplianceEngine.runComplianceAudit(tenant1);

    expect(report.tenantId).toBe(tenant1);
    expect(report.overallAuditScorePercent).toBe(100);
    expect(report.complianceStatus).toBe('FULLY_COMPLIANT');
    expect(report.criteriaEvaluations.length).toBe(5);
    expect(report.criteriaEvaluations.every((c) => c.status === 'PASS')).toBe(true);
    expect(report.masterAuditSealSha256).toHaveLength(64);
  });
});
