import React from 'react';
import { DriverPodUploadPortal } from '../../../components/pod/DriverPodUploadPortal';

interface PodPageProps {
  params: {
    token: string;
  };
}

export default function PodTokenPage({ params }: PodPageProps) {
  return <DriverPodUploadPortal token={params.token} />;
}
