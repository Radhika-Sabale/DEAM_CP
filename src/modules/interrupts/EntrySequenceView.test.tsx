import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntrySequenceView } from './EntrySequenceView';
import type { InterruptRecord } from '../../engine/interrupts';

describe('EntrySequenceView', () => {
  it('renders placeholder when no interrupt record is present', () => {
    render(
      <EntrySequenceView
        lastInterruptRecord={null}
        microStepIndex={-1}
        onStepIntoMicroStep={vi.fn()}
        onPrevMicroStep={vi.fn()}
        onShowAllMicroSteps={vi.fn()}
        onResetMicroSteps={vi.fn()}
      />
    );

    expect(screen.getByText(/No interrupt entry currently active/i)).toBeInTheDocument();
  });

  it('renders 5 micro-steps when interrupt record is present and handles stepper', () => {
    const mockRecord: InterruptRecord = {
      kind: 'software',
      vector: 0x20,
      source: 'software-int',
      flagsBefore: 0x0202,
      flagsAfter: 0x0002,
      returnIp: 0x0102,
      returnCs: 0x0000,
      vectorAddress: 0x0080,
      handlerIp: 0x0500,
      microSteps: [
        {
          stepNumber: 1,
          kind: 'push-flags',
          description: 'Push FLAGS onto stack',
          registersChanged: [{ name: 'SP', old: 0x0100, new: 0x00fe }],
          flagsChanged: [],
          memoryWrites: [{ address: 0x00fe, oldByte: 0, newByte: 0x02 }],
        },
        {
          stepNumber: 2,
          kind: 'clear-if-tf',
          description: 'Clear IF and TF',
          registersChanged: [],
          flagsChanged: [{ name: 'I', old: 1, new: 0 }],
          memoryWrites: [],
        },
        {
          stepNumber: 3,
          kind: 'push-cs',
          description: 'Push CS onto stack',
          registersChanged: [{ name: 'SP', old: 0x00fe, new: 0x00fc }],
          flagsChanged: [],
          memoryWrites: [{ address: 0x00fc, oldByte: 0, newByte: 0 }],
        },
        {
          stepNumber: 4,
          kind: 'push-ip',
          description: 'Push IP onto stack',
          registersChanged: [{ name: 'SP', old: 0x00fc, new: 0x00fa }],
          flagsChanged: [],
          memoryWrites: [{ address: 0x00fa, oldByte: 0, newByte: 0x02 }],
        },
        {
          stepNumber: 5,
          kind: 'read-vector',
          description: 'Load vector from IVT',
          registersChanged: [{ name: 'IP', old: 0x0102, new: 0x0500 }],
          flagsChanged: [],
          memoryWrites: [],
        },
      ],
    };

    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onAll = vi.fn();

    render(
      <EntrySequenceView
        lastInterruptRecord={mockRecord}
        microStepIndex={0}
        onStepIntoMicroStep={onNext}
        onPrevMicroStep={onPrev}
        onShowAllMicroSteps={onAll}
        onResetMicroSteps={vi.fn()}
      />
    );

    expect(screen.getByText(/Entry Sequence: SOFTWARE \(Vector 32\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1: Push FLAGS onto stack/i)).toBeInTheDocument();
    expect(screen.getByText('Push FLAGS')).toBeInTheDocument();
    expect(screen.getByText('Clear IF & TF')).toBeInTheDocument();
    expect(screen.getByText('Load Vector')).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Next micro-step/i });
    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledOnce();

    const allBtn = screen.getByRole('button', { name: /Complete all micro-steps/i });
    fireEvent.click(allBtn);
    expect(onAll).toHaveBeenCalledOnce();
  });
});
