'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2Icon, InfoIcon, XCircleIcon, XIcon } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. `Infinity` keeps the toast until dismissed. */
  duration?: number;
}

interface ToastRecord extends ToastInput {
  id: number;
  variant: ToastVariant;
}

type ToastContextValue = { toast: (toast: ToastInput) => void };

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Imperative, dependency-free toasts.
 *
 * Base UI ships a toast primitive, but this surface needs only a transient
 * success/error note with no interactive content, so a small context is less machinery.
 * The viewport is `aria-live="polite"` so additions are announced without stealing
 * focus, and each toast carries a dismiss button as well as the timed path.
 */
function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<readonly ToastRecord[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      const { variant = 'success', duration = 4000 } = input;
      setToasts((prev) => [...prev, { ...input, id, variant }]);
      if (duration !== Infinity) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        data-slot="toast-viewport"
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((record) => (
          <ToastCard key={record.id} record={record} onDismiss={() => dismiss(record.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_ICON: Record<ToastVariant, typeof InfoIcon> = {
  success: CheckCircle2Icon,
  error: XCircleIcon,
  info: InfoIcon,
};

const VARIANT_COLOR: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-foreground',
};

function ToastCard({ record, onDismiss }: { record: ToastRecord; onDismiss: () => void }) {
  const Icon = VARIANT_ICON[record.variant];
  return (
    <div
      data-slot="toast"
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card p-3 pr-2 text-sm shadow-lg ring-1 ring-foreground/10',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-4 shrink-0', VARIANT_COLOR[record.variant])}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{record.title}</p>
        {record.description !== undefined && (
          <p className="mt-0.5 text-xs text-muted-foreground">{record.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <XIcon aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used inside a <ToastProvider>.');
  }
  return context;
}

export { ToastProvider, useToast };
