import React from 'react';

export interface SoftCoBrandProps {
  /** Shelter / rescue display name (from shelters.name). */
  shelterName: string;
  /**
   * apply → “Applying with …”
   * status → “Application with …”
   */
  context?: 'apply' | 'status';
  /** Additional CSS classes for the wrapper. */
  className?: string;
}

/**
 * Soft co-brand chrome (#169): shelter name leads; Raised Paws as powered-by.
 * No logo/colors — text only until a follow-up ticket.
 *
 * @category molecular
 */
export default function SoftCoBrand({
  shelterName,
  context = 'apply',
  className = '',
}: SoftCoBrandProps) {
  const name = shelterName.trim();
  if (!name) return null;

  const lead =
    context === 'status' ? `Application with ${name}` : `Applying with ${name}`;

  return (
    <div
      className={`text-base-content/80 ${className}`.trim()}
      data-testid="soft-co-brand"
    >
      <p className="text-base-content text-base font-semibold">{lead}</p>
      <p className="text-sm opacity-70">Powered by Raised Paws</p>
    </div>
  );
}
