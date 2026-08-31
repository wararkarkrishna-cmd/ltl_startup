import React from 'react';
import { Phase2QuotingWorkspace } from '../../../components/quoting/Phase2QuotingWorkspace';

interface QuotePageProps {
  params: {
    id: string;
  };
}

export default function QuotePage({ params }: QuotePageProps) {
  return (
    <main>
      <Phase2QuotingWorkspace shipmentId={params.id} />
    </main>
  );
}
