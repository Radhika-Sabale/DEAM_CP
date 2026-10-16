/**
 * @file AppShell.test.tsx
 * Tests for AppShell responsive layout and sidebar navigation behavior:
 * - Modules with isAvailable: true render as interactive <button> elements regardless of phase
 * - Available Phase 2 modules (ALU, 8086 CPU, Interrupt Controller) are unlocked and interactive
 * - Clicking an available Phase 2 navigation button sets the active module in useUiStore
 * - Modules with isAvailable: false render as disabled placeholders with aria-disabled="true"
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { AppShell } from './AppShell';
import * as registryModule from '../../modules/registry';
import type { ModuleId } from '../../types/designProject';

describe('AppShell Navigation', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useUiStore.getState().setModule('boolean-tool');
    useUiStore.getState().setSidebarOpen(true);
  });

  it('renders available Phase 2 modules as interactive navigation buttons rather than disabled placeholders', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    // ALU Module
    const aluButton = screen.getByRole('button', {
      name: 'ALU',
    });
    expect(aluButton).toBeInTheDocument();
    expect(aluButton).toBeEnabled();

    // 8086 CPU Module
    const cpuButton = screen.getByRole('button', {
      name: '8086 CPU',
    });
    expect(cpuButton).toBeInTheDocument();
    expect(cpuButton).toBeEnabled();

    // Interrupt Controller Module
    const interruptButton = screen.getByRole('button', {
      name: 'Interrupts',
    });
    expect(interruptButton).toBeInTheDocument();
    expect(interruptButton).toBeEnabled();

    // Confirm no "Coming in Phase 2" badge exists for these available modules
    expect(screen.queryByText('Coming in Phase 2')).not.toBeInTheDocument();
  });

  it('navigates to Phase 2 modules when their sidebar button is clicked', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const aluButton = screen.getByRole('button', {
      name: 'ALU',
    });
    fireEvent.click(aluButton);

    expect(useUiStore.getState().currentModule).toBe('alu');
    expect(aluButton).toHaveAttribute('aria-current', 'page');

    const cpuButton = screen.getByRole('button', {
      name: '8086 CPU',
    });
    fireEvent.click(cpuButton);

    expect(useUiStore.getState().currentModule).toBe('8086-cpu');
    expect(cpuButton).toHaveAttribute('aria-current', 'page');
  });

  it('renders modules with isAvailable: false as disabled placeholders with badge', () => {
    // Temporarily spy on MODULE_REGISTRY to include an unavailable module
    const originalRegistry = registryModule.MODULE_REGISTRY;
    const testRegistry = [
      ...originalRegistry,
      {
        id: 'future-module' as unknown as ModuleId,
        title: 'Future Experimental Peripheral',
        description: 'Upcoming coprocessor module.',
        icon: 'cpu',
        reads: [],
        writes: [],
        nextModules: [],
        phase: 2 as const,
        isAvailable: false,
        component: (() => null) as unknown as registryModule.ModuleEntry['component'],
      },
    ];

    vi.spyOn(registryModule, 'MODULE_REGISTRY', 'get').mockReturnValue(testRegistry);

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    // Should NOT be an interactive button
    const unavailableButton = screen.queryByRole('button', {
      name: /Future Experimental Peripheral/i,
    });
    expect(unavailableButton).not.toBeInTheDocument();

    // Should be a disabled placeholder element
    const disabledPlaceholder = screen.getByText('Future Experimental Peripheral').closest('[aria-disabled="true"]');
    expect(disabledPlaceholder).toBeInTheDocument();
    expect(disabledPlaceholder).toHaveAttribute('aria-disabled', 'true');

    // Should display the badge
    expect(screen.getByText('Coming soon')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
