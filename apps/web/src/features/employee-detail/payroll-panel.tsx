'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

import type { PayrollSample } from './profile-extras';

const MASK = 'Rp •••••••';

const formatRupiah = (value: number): string => `Rp ${value.toLocaleString('id-ID')}`;

const formatSigned = (value: number): string => {
  const magnitude = formatRupiah(Math.abs(value));
  return value < 0 ? `– ${magnitude}` : magnitude;
};

/**
 * The payroll panel body. The amounts are sample data until the payroll
 * module ships, and the eye toggle keeps them masked by default — the shape
 * the reference screen guards with, so both states are draggable from the
 * same client component.
 */
export function PayrollPanel({ payroll }: { payroll: PayrollSample }) {
  const { toast } = useToast();
  const [revealed, setRevealed] = React.useState<boolean>(false);

  const slips: { period: string; net: number }[] = [...payroll.slips];

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-4 flex items-center justify-between gap-12">
          <h2 className="text-base font-semibold">Salary details — {payroll.periodLabel}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRevealed((current) => !current)}
            aria-pressed={revealed}
          >
            {revealed ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
            {revealed ? 'Hide amounts' : 'Show amounts'}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Component</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...payroll.components, ...payroll.deductions].map((component) => (
                <tr key={component.name} className="border-b border-border/60 last:border-b-0">
                  <td className="py-2.5 pr-4 font-medium">{component.name}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={component.kind === 'Earning' ? 'success' : 'destructive'}>
                      {component.kind}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {revealed ? formatSigned(component.amount) : MASK}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3.5">
          <span className="text-sm font-medium text-primary">Net take-home pay</span>
          <b className="text-xl font-semibold tabular-nums text-primary">
            {revealed ? formatRupiah(payroll.netPay) : MASK}
          </b>
        </div>
      </section>

      <section className="border-t border-border pt-5">
        <h2 className="mb-4 text-base font-semibold">Payslip history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Period</th>
                <th className="py-2 pr-4 text-right font-medium">Net pay</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {slips.map((slip) => (
                <tr key={slip.period} className="border-b border-border/60 last:border-b-0">
                  <td className="py-2.5 pr-4 font-medium">{slip.period}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {revealed ? formatRupiah(slip.net) : MASK}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge variant="success">Paid</Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast({
                          title: 'Payslip downloaded',
                          description: `The ${slip.period} payslip was downloaded as PDF.`,
                        })
                      }
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-border pt-5">
        <h2 className="mb-4 text-base font-semibold">Payment account</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <KvItem label="Bank">{payroll.bank.bank}</KvItem>
          <KvItem label="Account number">
            <span className="tabular-nums">{payroll.bank.account}</span>
          </KvItem>
          <KvItem label="Account holder">{payroll.bank.holder}</KvItem>
        </dl>
      </section>
    </div>
  );
}

export function KvItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}
