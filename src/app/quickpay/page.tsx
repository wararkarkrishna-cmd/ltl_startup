'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickPayPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/invoices?tab=quickpay');
  }, [router]);

  return (
    <div className="p-8 text-center text-neutral-400 font-mono text-xs">
      Forwarding to Financial Center (QuickPay)...
    </div>
  );
}
