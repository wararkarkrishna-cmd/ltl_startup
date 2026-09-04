'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FleetPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dispatch?drawer=fleet');
  }, [router]);

  return (
    <div className="p-8 text-center text-neutral-400 font-mono text-xs">
      Forwarding to Dispatch Board (Fleet Equipment)...
    </div>
  );
}
