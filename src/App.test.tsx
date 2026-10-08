import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import App from './App';

describe('App', () => {
  it('renders the main heading', async () => {
    render(<App />);
    const heading = await screen.findByRole('heading', {
      name: /digital electronics virtual lab/i,
      level: 1,
    });
    expect(heading).toBeInTheDocument();
  });
});
