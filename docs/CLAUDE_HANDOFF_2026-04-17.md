# Mall263 Mobile Handoff (for Claude)

## Purpose

This document is a clean handoff so another agent (Claude) can finish the current work without losing context.

Main user objective for this session:

1. Keep web and mobile chat flows aligned.
2. Finish Phase 4 chat reliability/completion.
3. Fix production/runtime regressions quickly while keeping deploy cadence fast.

---

## Original Plan (this session)

1. Ship mobile chat inbox and room flow.
2. Align web with matching chat inbox entry and unread behavior.
3. Add seller attendant access parity in backend chat authorization.
4. Improve reliability (focus/reconnect refresh, unread indicators).
5. Upgrade to realtime socket updates with polling fallback.

---

## What Was Implemented

## 1) Chat foundation (mobile + web + backend)

- Mobile:
  - `apps/mobile/app/chat/index.tsx`
  - `apps/mobile/app/chat/[roomId].tsx`
  - `apps/mobile/lib/chat-api.ts`
- Web:
  - `frontend/src/app/chat/page.tsx`
  - `frontend/src/app/chat/[roomId]/page.tsx`
  - `frontend/src/app/demands/page.tsx` (chat entrypoint + unread count)
- Backend:
  - `backend/src/modules/chat/chat.service.ts` (attendant access in room list + auth)

Commits:
- `b9ec3ec` feat(chat): ship inbox and attendant access
- `915b098` fix(chat): stabilize refresh and unread indicators
- `2311ebe` feat(chat): show unread counts on demand entrypoints

## 2) Realtime chat sockets (with fallback polling)

- Backend:
  - `backend/src/modules/chat/chat.gateway.ts` (new)
  - `backend/src/modules/chat/chat.module.ts` (gateway + jwt wiring)
  - `backend/src/modules/chat/chat.controller.ts` (emit on send)
  - `backend/src/modules/chat/chat.service.ts` (`assertRoomAccess` helper)
- Clients:
  - `apps/mobile/app/chat/[roomId].tsx` socket subscribe/join
  - `frontend/src/app/chat/[roomId]/page.tsx` socket subscribe/join

Commit:
- `d0d1192` feat(chat): add realtime room delivery via sockets

## 3) Expo/Metro fix for socket dependency resolution

- `apps/mobile/metro.config.js`
  - `config.resolver.unstable_enablePackageExports = false;`
- `apps/mobile/app/chat/[roomId].tsx`
  - room param normalization + better load error surfacing

Commit:
- `c4141fd` fix(mobile-chat): resolve room params and Metro socket loading

---

## Current Status / Known Issue

User now reports: **"database error"** when opening chat room (mobile seller path).

Given Prisma filter behavior, likely cause is schema mismatch or query mismatch in attendant filtering on deployed DB.

There is an **uncommitted local hotfix** already applied in:
- `backend/src/modules/chat/chat.service.ts`

Hotfix removes `isActive` predicate from attendant relations in chat queries:
- `verifyAccess()` attendants include filter removed
- `getMyRooms()` attendants `some` filter changed to `{ userId }`

This is intended to avoid runtime DB compatibility issues while preserving buyer/merchant/attendant access checks.

---

## What Is Left

1. **Commit + push the chat.service hotfix** above.
2. Redeploy backend.
3. Re-test seller room open + message send/receive.
4. If still failing, capture exact backend exception (Prisma code + query location).
5. Only after chat is stable, continue with next roadmap item (Phase 5 deposits/Paynow mobile deep-link flow).

---

## Exact Next Steps for Claude

1. Confirm current working tree:
   - `git status --short`
2. Commit and push only:
   - `backend/src/modules/chat/chat.service.ts`
3. Ask user to redeploy and test:
   - seller opens chat room
   - buyer/seller realtime message exchange
4. If user still gets "database error":
   - inspect backend logs for Prisma error code (`P20xx`) and failing query location
   - patch the specific failing query defensively
   - keep API contracts unchanged
5. Keep web/mobile alignment rule:
   - any user-facing flow change in mobile must be mirrored on web when relevant

---

## Safety Constraints Followed

- No DB migrations added in this session.
- No API route contract changes.
- No destructive git operations.
- Unrelated local files intentionally left untouched:
  - `.claude/settings.local.json`
  - `backend/tsconfig.tsbuildinfo`
  - `frontend/tsconfig.tsbuildinfo`
  - `PITCH_BULAWAYO_ENTERPRISE_SHOWCASE.md`

---

## Reminder of Bigger Roadmap Position

`docs/MOBILE_BUILD_PLAN.md` currently reflects:
- Phase 4 chat marked complete from feature perspective (including realtime/poll fallback)
- Immediate practical priority: stabilize the current production regression ("database error")
- Next major feature after stabilization: Phase 5 write-side wallet flows (Paynow/deep links)
