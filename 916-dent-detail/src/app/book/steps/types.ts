import type { Dispatch } from 'react';
import type { Action, Flow } from '../state';

export type StepProps = {
  flow: Flow;
  dispatch: Dispatch<Action>;
  /** Move to step n (validated by the shell). */
  go: (n: number) => void;
  focusKey: number;
};
