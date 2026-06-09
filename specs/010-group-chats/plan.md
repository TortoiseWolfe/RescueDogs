# Implementation Plan: Group Chats

**Branch**: `010-group-chats` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-group-chats/spec.md`

## Summary

Add group chat functionality to RescueDogs's existing E2E encrypted messaging system. Groups support up to 200 members using symmetric AES-GCM-256 encryption with key versioning. New members cannot see pre-join history, any member can add others, only owner can remove members, and 1-to-1 conversations can be upgraded to groups while preserving original participants' history access.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15.5, React 19
**Primary Dependencies**: Supabase (Auth, Database, Realtime), Web Crypto API (ECDH P-256, AES-GCM-256), DaisyUI, Tailwind CSS 4
**Storage**: PostgreSQL via Supabase (monolithic migration file)
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (a11y), jest-axe
**Target Platform**: Static export to GitHub Pages (PWA), mobile-first responsive
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Group key distribution for 200 members within 10 seconds, group creation + first message within 30 seconds
**Constraints**: Static export (no server-side API routes), offline-first with IndexedDB, 44px touch targets
**Scale/Scope**: Up to 200 members per group, existing 1-to-1 messaging infrastructure to extend

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Status  | Notes                                                                                     |
| --------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| I. Component Structure Compliance | ✅ PASS | New components (AvatarStack, GroupMemberList, etc.) will use 5-file pattern via generator |
| II. Test-First Development        | ✅ PASS | Tasks will include TDD workflow for all new components and services                       |
| III. PRP Methodology              | ✅ PASS | Following /specify → /clarify → /plan → /checklist → /tasks → /analyze → /implement       |
| IV. Docker-First Development      | ✅ PASS | All development in Docker containers per CLAUDE.md                                        |
| V. Progressive Enhancement        | ✅ PASS | Core group messaging works everywhere, enhanced with realtime, offline queue              |
| VI. Privacy & Compliance First    | ✅ PASS | E2E encryption, key versioning prevents unauthorized history access, RLS policies         |

**Gate Result**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```
specs/010-group-chats/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
src/
├── components/
│   ├── atomic/
│   │   ├── AvatarStack/           # NEW: Stacked avatars for groups
│   │   └── SystemMessage/         # NEW: Join/leave event messages
│   ├── molecular/
│   │   ├── GroupMemberList/       # NEW: Scrollable member list
│   │   ├── AddMemberModal/        # NEW: Search/select members
│   │   ├── GroupInfoPanel/        # NEW: Slide-in group details
│   │   ├── GroupChatHeader/       # NEW: Group name, count, settings
│   │   └── ConversationListItem/  # MODIFY: Support groups
│   └── organisms/
│       ├── CreateGroupModal/      # NEW: Group creation flow
│       ├── ChatWindow/            # MODIFY: Group header support
│       ├── ConversationList/      # MODIFY: Fetch groups
│       └── UnifiedSidebar/        # MODIFY: "New Group" button
├── services/messaging/
│   ├── group-service.ts           # NEW: Group CRUD operations
│   ├── group-key-service.ts       # NEW: Symmetric key management
│   ├── message-service.ts         # MODIFY: Dual-path encryption
│   ├── key-service.ts             # MODIFY: Group key support
│   └── connection-service.ts      # MODIFY: Group creation
├── hooks/
│   ├── useGroupMembers.ts         # NEW: Group member management
│   └── useConversationRealtime.ts # MODIFY: Group message handling
├── types/
│   └── messaging.ts               # MODIFY: Add group types
├── lib/
│   ├── messaging/
│   │   └── encryption.ts          # MODIFY: Group key encryption
│   └── supabase/
│       └── messaging-client.ts    # MODIFY: Group queries
└── app/
    └── messages/
        └── page.tsx               # MODIFY: Group UI integration

supabase/migrations/
└── 20251006_complete_monolithic_setup.sql  # MODIFY: Add group tables

tests/
├── unit/
│   └── services/messaging/        # NEW: Group service tests
├── integration/
│   └── messaging/                 # NEW: Group integration tests
└── e2e/
    └── messaging/                 # NEW: Group E2E tests
```

**Structure Decision**: Extending existing Next.js web application structure. New components follow atomic design pattern, new services extend existing messaging architecture.

## Complexity Tracking

_No Constitution Check violations - table not required_
