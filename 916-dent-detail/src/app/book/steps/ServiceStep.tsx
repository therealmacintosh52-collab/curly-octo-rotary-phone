'use client';
import { addonDefs, bookingServices } from '@/config/booking';
import { Check, NavButtons, StepFrame } from '../ui';
import { stepValid } from '../state';
import type { StepProps } from './types';

export function ServiceStep({ flow, dispatch, go, focusKey }: StepProps) {
  const applicable = addonDefs.filter((a) => a.appliesTo.some((s) => flow.services.includes(s)));
  return (
    <StepFrame id="svc" title="What do you need done?" lede="Pick one or more. We combine them into a single visit." focusKey={focusKey}>
      <fieldset>
        <legend className="sr-only">Services</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {bookingServices.map((s) => (
            <label key={s.id} className="bk-choice">
              <input type="checkbox" checked={flow.services.includes(s.id)} onChange={() => dispatch({ type: 'toggleService', id: s.id })} aria-describedby={`svc-${s.id}-d`} />
              <span className="bk-card">
                <span className="bk-mark" aria-hidden="true"><Check /></span>
                <span>
                  <span className="block font-semibold">{s.plain}</span>
                  <span id={`svc-${s.id}-d`} className="mt-1 block text-sm text-steel">{s.summary}</span>
                  {s.requiresPhotos && <span className="mt-2 block text-xs text-gold">Photos needed for a price</span>}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {applicable.length > 0 && (
        <fieldset className="mt-10">
          <legend className="eyebrow mb-4">Optional add-ons</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {applicable.map((a) => (
              <label key={a.id} className="bk-choice">
                <input type="checkbox" checked={flow.addons.includes(a.id)} onChange={() => dispatch({ type: 'toggleAddon', id: a.id })} />
                <span className="bk-card">
                  <span className="bk-mark" aria-hidden="true"><Check /></span>
                  <span><span className="block font-semibold">{a.label}</span><span className="mt-1 block text-sm text-steel">{a.blurb}</span></span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <NavButtons hideBack onNext={() => go(2)} nextDisabled={!stepValid(flow, 1)} hint={flow.services.length === 0 ? 'Choose at least one service to continue.' : undefined} />
    </StepFrame>
  );
}
