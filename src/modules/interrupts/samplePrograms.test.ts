import { describe, it, expect } from 'vitest';
import { INTERRUPT_SAMPLE_PROGRAMS } from './samplePrograms';
import { assemble } from '../../engine/cpu8086/assembler';
import { createCpuState, step } from '../../engine/cpu8086/cpu';

describe('INTERRUPT_SAMPLE_PROGRAMS', () => {
  it('contains exactly 8 curated educational sample programs', () => {
    expect(INTERRUPT_SAMPLE_PROGRAMS.length).toBe(8);
  });

  INTERRUPT_SAMPLE_PROGRAMS.forEach((prog) => {
    it(`assembles "${prog.title}" without errors`, () => {
      const res = assemble(prog.source);
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error(`Assembly failed for ${prog.id}:`, res.errors);
      }
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.program.instructions).toBeDefined();
        // Check that state can be initialized and stepped
        let state = createCpuState(res.program);
        expect(state).toBeDefined();
        // Execute up to 10 steps or until halted/fault
        for (let s = 0; s < 10 && !state.halted && !state.fault; s++) {
          const stepRes = step(state, res.program, { scenario: prog.defaultScenario });
          state = stepRes.state;
        }
        expect(state.ticks).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
