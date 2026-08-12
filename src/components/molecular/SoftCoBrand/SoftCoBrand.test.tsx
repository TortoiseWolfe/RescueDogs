import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SoftCoBrand from './SoftCoBrand';

describe('SoftCoBrand', () => {
  it('renders Applying with {shelter} for apply context', () => {
    render(<SoftCoBrand shelterName="Second Chance Rescue" />);
    expect(screen.getByTestId('soft-co-brand')).toHaveTextContent(
      'Applying with Second Chance Rescue'
    );
    expect(screen.getByTestId('soft-co-brand')).toHaveTextContent(
      'Powered by Raised Paws'
    );
  });

  it('renders Application with {shelter} for status context', () => {
    render(<SoftCoBrand shelterName="Second Chance Rescue" context="status" />);
    expect(screen.getByTestId('soft-co-brand')).toHaveTextContent(
      'Application with Second Chance Rescue'
    );
  });

  it('returns null when shelterName is blank', () => {
    const { container } = render(<SoftCoBrand shelterName="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('merges a custom className', () => {
    render(<SoftCoBrand shelterName="Demo Rescue" className="mb-4" />);
    expect(screen.getByTestId('soft-co-brand')).toHaveClass('mb-4');
  });
});
