'use client';

import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';
import { ShelterGate } from './ShelterGate';

export default function ShelterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ProtectedRoute owns the auth-debounce + redirect-to-sign-in path.
  // ShelterGate layers the membership check on top, with its own wasStaff
  // ref so transient token-refresh flips don't kick staff back to '/'.
  // Composition mirrors src/app/admin/layout.tsx.
  return (
    <ProtectedRoute>
      <ShelterGate>{children}</ShelterGate>
    </ProtectedRoute>
  );
}
