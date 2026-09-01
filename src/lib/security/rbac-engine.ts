import { UserRole, RbacAction } from '../../db/schema';

export interface RbacEvaluationResult {
  isAuthorized: boolean;
  role: UserRole;
  action: RbacAction;
  reason: string;
}

export class RbacEngine {
  /**
   * Enterprise Role-to-Permission Matrix
   */
  private static readonly PERMISSION_MATRIX: Record<UserRole, Set<RbacAction>> = {
    OWNER: new Set<RbacAction>([
      'INGEST_RFQ',
      'CREATE_QUOTE',
      'ACCEPT_QUOTE',
      'DISPATCH_LOAD',
      'GENERATE_INVOICE',
      'INITIATE_QUICKPAY',
      'APPROVE_DISPUTE',
      'VIEW_FINANCIAL_LEDGER',
      'RECONCILE_BANK_STATEMENTS',
      'MANAGE_FACTORING_NOA',
      'VIEW_EXECUTIVE_ROI',
      'EXPORT_BOARD_REPORT',
      'MANAGE_USERS',
      'VIEW_SOC2_REPORT',
    ]),
    BROKER_AGENT: new Set<RbacAction>([
      'INGEST_RFQ',
      'CREATE_QUOTE',
      'ACCEPT_QUOTE',
      'DISPATCH_LOAD',
      'VIEW_EXECUTIVE_ROI',
      'EXPORT_BOARD_REPORT',
    ]),
    DISPATCHER: new Set<RbacAction>([
      'DISPATCH_LOAD',
      'INGEST_RFQ',
      'CREATE_QUOTE',
      'ACCEPT_QUOTE',
    ]),
    BILLING_SPECIALIST: new Set<RbacAction>([
      'GENERATE_INVOICE',
      'INITIATE_QUICKPAY',
      'APPROVE_DISPUTE',
      'VIEW_FINANCIAL_LEDGER',
      'RECONCILE_BANK_STATEMENTS',
      'MANAGE_FACTORING_NOA',
      'VIEW_EXECUTIVE_ROI',
    ]),
    READ_ONLY_AUDITOR: new Set<RbacAction>([
      'VIEW_FINANCIAL_LEDGER',
      'VIEW_EXECUTIVE_ROI',
      'EXPORT_BOARD_REPORT',
      'VIEW_SOC2_REPORT',
    ]),
  };

  /**
   * Evaluates if a given role has authorization to perform an action
   */
  public static checkPermission(role: UserRole, action: RbacAction): RbacEvaluationResult {
    const allowedActions = this.PERMISSION_MATRIX[role] || new Set<RbacAction>();
    const isAuthorized = allowedActions.has(action);

    return {
      isAuthorized,
      role,
      action,
      reason: isAuthorized
        ? `Role '${role}' is granted permission for '${action}'.`
        : `Access Denied: Role '${role}' lacks permission for '${action}'.`,
    };
  }

  /**
   * Enforces strict multi-tenant boundary check
   */
  public static enforceTenantIsolation(
    callerTenantId: string,
    resourceTenantId: string,
    resourceType: string = 'Resource'
  ): void {
    if (!callerTenantId || !resourceTenantId) {
      throw new Error(`Security Violation: Missing tenant context during ${resourceType} access check.`);
    }
    if (callerTenantId !== resourceTenantId) {
      throw new Error(
        `Cross-Tenant Access Prohibited: Caller tenant '${callerTenantId}' cannot access '${resourceTenantId}' ${resourceType}.`
      );
    }
  }
}
