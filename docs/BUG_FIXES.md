# Bug Fixes & Lessons Learned Tracker

This file serves as a persistent record of critical bugs encountered and their solutions, so future agents and developers can maintain best practices and avoid regressions.

## 1. Supabase Auth Phone vs. Email Splitting
**Issue**: A user logs in via Email, makes transactions, then logs out and logs back in via Phone Number. Their transactions "disappear" and balance reads zero.
**Root Cause**: Supabase Authentication creates completely separate `user_id` records for an Email login vs. a Phone Number login unless the identities are manually linked via `supabase.auth.linkIdentity()`. 
**Fix/Lesson**: When fetching `wallet_transactions` or `orders` by `profile.id`, the new phone-number login is treated as a brand-new user. To prevent confusion, users should be informed that phone logins and email logins are separate accounts by default.

## 2. Frontend Query Data Limits Hiding Recent Transactions
**Issue**: Active agents complained they couldn't see all their deposits and purchases from "today" in the `WalletManager` or `AgentDashboard` history tabs.
**Root Cause**: We were aggressively capping the Supabase queries with `.limit(20)`. If a user made >20 transactions in a single day, the older transactions from that same day were immediately truncated.
**Fix/Lesson**: Increased limits for user-facing transaction histories to `.limit(500)`. When displaying active feeds, prefer generous limits or implement proper pagination (e.g., Infinite Scrolling) instead of aggressive hardcoded limits like `20`.

## 3. UI Component State Stale on Action Completion
**Issue**: After a successful wallet deposit (Phase switches to `"success"`), the `WalletManager` component updated the balance but the "History" tab still showed "No transactions yet."
**Root Cause**: React `useEffect` was only calling `fetchHistory()` on component mount `[profile?.id]`.
**Fix/Lesson**: Always re-invoke fetching functions (like `fetchHistory()` or `loadHistory()`) immediately alongside `fetchBalance()` when a modifying transaction completes successfully within a component.

## 4. Supabase RPC Balance Calculations Out of Sync
**Issue**: Deposits and purchases weren't reflecting correctly in the `get_wallet_balance` RPC.
**Root Cause**: `wallet_tx_type` ENUM was updated to include `deposit` and `purchase`, but the `get_wallet_balance` SQL function wasn't summing them up because its `CASE WHEN` clause was hardcoded to only look for `'earning', 'refund', 'withdrawal', 'activation_fee'`.
**Fix/Lesson**: Any time a new type is added to an ENUM that affects business logic (like wallet balances), ensure all associated SQL RPCs and Database Triggers are updated in the same migration to recognize the new ENUM values.

## 5. UI Accessibility DevTools Errors (Aria-Hidden)
**Issue**: Chrome DevTools fired a "Blocked aria-hidden" warning when opening the mobile navigation Drawer.
**Root Cause**: The `DrawerTrigger` from Vaul/shadcn remains focused underneath the Drawer overlay, causing browser accessibility warnings.
**Fix/Lesson**: Attach `onClick={(e) => e.currentTarget.blur()}` to `DrawerTrigger` buttons (or similar overlay triggers) so they manually drop focus when the overlay mounts.
