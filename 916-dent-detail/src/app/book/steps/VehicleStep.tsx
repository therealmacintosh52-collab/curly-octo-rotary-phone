'use client';
import { useState } from 'react';
import { sizeClasses } from '@/config/booking';
import { Check, Field, NavButtons, StepFrame } from '../ui';
import { stepValid, yearOk } from '../state';
import type { StepProps } from './types';

export function VehicleStep({ flow, dispatch, go, focusKey }: StepProps) {
  const [touched, setTouched] = useState(false);
  const set = (patch: Partial<typeof flow>) => dispatch({ type: 'patch', patch: { ...patch, slot: null, quote: null } });
  const yearErr = touched && !yearOk(flow.year) ? `Enter a 4-digit year, 1950 to ${new Date().getFullYear() + 1}.` : undefined;
  const makeErr = touched && !flow.make.trim() ? 'Enter the make, for example Toyota.' : undefined;
  const modelErr = touched && !flow.model.trim() ? 'Enter the model, for example Camry.' : undefined;
  const sizeErr = touched && !flow.sizeClass ? 'Choose the size that is closest.' : undefined;
  const valid = stepValid(flow, 2);
  return (
    <StepFrame id="veh" title="Tell us about your vehicle" lede="Size decides time and price, so pick the closest match." focusKey={focusKey}>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="veh-year" label="Year" error={yearErr}>
          <input id="veh-year" className="bk-input" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="2021" value={flow.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, '') })} aria-invalid={Boolean(yearErr)} aria-describedby={yearErr ? 'veh-year-err' : undefined} required />
        </Field>
        <Field id="veh-make" label="Make" error={makeErr}>
          <input id="veh-make" className="bk-input" autoComplete="off" placeholder="Toyota" value={flow.make} onChange={(e) => set({ make: e.target.value })} aria-invalid={Boolean(makeErr)} aria-describedby={makeErr ? 'veh-make-err' : undefined} required maxLength={40} />
        </Field>
        <Field id="veh-model" label="Model" error={modelErr}>
          <input id="veh-model" className="bk-input" autoComplete="off" placeholder="Camry" value={flow.model} onChange={(e) => set({ model: e.target.value })} aria-invalid={Boolean(modelErr)} aria-describedby={modelErr ? 'veh-model-err' : undefined} required maxLength={40} />
        </Field>
      </div>

      <fieldset className="mt-10" aria-describedby={sizeErr ? 'veh-size-err' : undefined}>
        <legend className="bk-label">Vehicle size</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {sizeClasses.map((s) => (
            <label key={s.id} className="bk-choice">
              <input type="radio" name="size" value={s.id} checked={flow.sizeClass === s.id} onChange={() => set({ sizeClass: s.id })} />
              <span className="bk-card">
                <span className="bk-mark round" aria-hidden="true"><Check /></span>
                <span><span className="block font-semibold">{s.label}</span><span className="mt-1 block text-sm text-steel">{s.examples}</span></span>
              </span>
            </label>
          ))}
        </div>
        {sizeErr && <p id="veh-size-err" role="alert" className="bk-err">{sizeErr}</p>}
      </fieldset>
      <NavButtons onBack={() => go(1)} onNext={() => (valid ? go(3) : setTouched(true))} />
    </StepFrame>
  );
}
