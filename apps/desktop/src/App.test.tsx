import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the Double Trouble TFT root', () => {
    render(<App />);
    expect(screen.getByTestId('app-root')).toHaveTextContent('Double Trouble TFT');
  });
});
