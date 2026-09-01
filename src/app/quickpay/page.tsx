import React from 'react';
import { QuickPayManagementDashboard } from '../../components/quickpay/QuickPayManagementDashboard';

export const metadata = {
  title: 'Carrier QuickPay Fintech & Double-Entry Ledger | Apex LTL OS',
  description: 'Manage instant carrier disbursements, E-SIGN contracts, double-entry financial ledger, and Form 1099-NEC tax compliance.',
};

export default function QuickPayPage() {
  return <QuickPayManagementDashboard />;
}
