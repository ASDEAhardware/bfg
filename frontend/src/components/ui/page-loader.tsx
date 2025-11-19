'use client';

import { Loader2 } from 'lucide-react';
import { usePageLoaderStore } from '@/store/loaderStore';

export function PageLoader() {
  const isLoading = usePageLoaderStore((state) => state.isLoading);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    </div>
  );
}
