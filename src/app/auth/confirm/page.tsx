import { Suspense } from 'react';
import ConfirmInner from './ConfirmInner';

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
