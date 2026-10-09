/**
 * @file ParticipantSetup.test.tsx
 * Tests for ParticipantSetup component: input, consent checkbox, delete modal (Stage 11C).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStudyStore } from '../../store/studyStore';
import { ParticipantSetup } from './ParticipantSetup';

describe('ParticipantSetup Component', () => {
  beforeEach(() => {
    useStudyStore.getState().deleteStudyData();
  });

  it('renders participant setup controls with placeholder consent text', () => {
    render(<ParticipantSetup />);

    expect(screen.getByText('Research Study Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText(/Study Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Participant ID/i)).toBeInTheDocument();
    expect(screen.getByText(/pedagogy research/i)).toBeInTheDocument();
  });

  it('generates a new short code when clicking Generate Code', () => {
    render(<ParticipantSetup />);

    const generateBtn = screen.getByRole('button', { name: /Generate Code/i });
    fireEvent.click(generateBtn);

    const input = screen.getByLabelText(/Participant ID/i) as HTMLInputElement;
    expect(input.value).toMatch(/^P-[A-Z0-9]{4}$/);
  });

  it('toggles consent on checkbox click', () => {
    render(<ParticipantSetup />);

    const checkbox = screen.getByRole('checkbox', { name: /pedagogy research/i });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(useStudyStore.getState().hasConsented).toBe(true);
  });

  it('opens confirmation modal and executes delete study data', () => {
    useStudyStore.getState().setParticipantId('STUDENT-123');
    render(<ParticipantSetup />);

    const deleteBtn = screen.getByRole('button', { name: /Delete all my local study data/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Confirm Data Deletion')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
    fireEvent.click(confirmBtn);

    expect(useStudyStore.getState().participantId).toBe('');
  });
});
