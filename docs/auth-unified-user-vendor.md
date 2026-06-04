# Auth Architecture Decision: Unified User/Vendor, Remove Admin Login Flow

## Decision
- The project no longer supports a separate admin login flow.
- A single account model is used:
  - `user`: buyer capabilities.
  - `vendor`: seller capabilities (same account, elevated by vendor registration).
- Vendor dashboard access must rely on normal user authentication (cookie/session), not a dedicated admin credential flow.

## Why
- Separate admin credential flow (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) creates unnecessary security risk and complexity.
- Current flow also leaks auth tokens via URL query params when opening vendor dashboard.
- Unified authentication reduces attack surface and aligns with real business model: one account can both buy and sell.

## Scope of this change
1. Remove backend admin login API flow.
2. Remove frontend/admin token handoff via URL (`vendorToken`).
3. Make vendor dashboard restore auth from secure cookie (`/api/user/refresh`) instead of localStorage/query token.

## New Authentication Rules
- Login only through user endpoints:
  - `POST /api/user/login`
  - `POST /api/user/google`
  - `POST /api/user/refresh`
  - `POST /api/user/logout`
- Vendor dashboard must validate role from `POST /api/user/profile`.
- SSE notification stream should use HttpOnly cookie auth; query token must not be used by clients.

## Remaining Notes
- This change removes login flow only, not all `adminAuth`-protected endpoints.
- A follow-up phase should replace/remove remaining `adminAuth` routes and static env-based admin credentials completely.

## Rollout Checklist
1. Deploy backend changes first (remove `/api/user/admin` flow).
2. Deploy frontend + admin app changes together (remove `vendorToken` query sharing).
3. Smoke test:
   - Buyer login/logout.
   - Register vendor.
   - Open vendor dashboard from main site.
   - SSE notifications in vendor dashboard.
4. Remove unused admin env vars in next cleanup:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`

## Related Docs
- Redis auth/security plan (Vietnamese): `docs/redis-auth-security-plan-vi.md`
