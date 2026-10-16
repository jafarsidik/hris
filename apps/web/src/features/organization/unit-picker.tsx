'use client';

import type { OrganizationalUnitSummary } from '@hris/shared-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIamLoad } from '@/features/iam/use-iam-data';

import { getOrganization } from './index';

/** Sentinel for the "no unit" choice, because a Base UI Select value cannot be null. */
const NONE = '__none__';

const labelOf = (unit: OrganizationalUnitSummary): string => `${unit.name} · ${unit.type}`;

interface UnitPickerProps {
  readonly id?: string;
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

/**
 * Chooses the organizational unit a user is placed on.
 *
 * Options come from the caller's scoped `/organization/units` read, so a delegated
 * administrator only ever sees the units they may assign into. A "no unit" choice is
 * always offered because placement is optional.
 */
export function UnitPicker({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'Choose a unit',
}: UnitPickerProps) {
  const repository = getOrganization();
  const units = useIamLoad(() => repository.listUnits({}, { limit: 200 }), []);

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No organizational unit</SelectItem>
        {units.data?.items.map((unit) => (
          <SelectItem key={unit.id} value={unit.id}>
            {labelOf(unit)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
