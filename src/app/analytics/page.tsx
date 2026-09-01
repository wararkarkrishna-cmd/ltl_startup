import React from 'react';
import { ExecutiveRoiDashboard } from '@/components/analytics/ExecutiveRoiDashboard';

export const metadata = {
  title: 'Executive ROI & Financial Analytics | Apex LTL OS',
  description: 'Real-time provable software and financial ROI analytics dashboard for brokerage owners and executive boards.',
};

export default function AnalyticsPage() {
  return <ExecutiveRoiDashboard />;
}
