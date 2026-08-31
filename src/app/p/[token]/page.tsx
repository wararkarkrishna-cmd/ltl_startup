import React from 'react';
import { DriverPodUploadPortal } from '../../../components/pod/DriverPodUploadPortal';

interface ShortPodPageProps {
  params: {
    token: string;
  };
}

export default function ShortPodTokenPage({ params }: ShortPodPageProps) {
  return <DriverPodUploadPortal token={params.token} />;
}
