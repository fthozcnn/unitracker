# UniTracker (Ders Takibi) — Full Optimization Audit

> Audit Date: 2026-02-28  
> Codebase: React 19 + TypeScript + Vite 7 + Supabase + Tailwind CSS 4 + Capacitor  
> Files reviewed: 12 pages, 14 components, 4 lib files, 1 hook, 1 context  

---

## 1) Optimization Summary

**Current optimization health:** The app has a solid feature set but suffers from **excessive Supabase roundtrips**, **duplicated logic across pages**, and **no code‑splitting**. The biggest bottleneck is the Dashboard, which fires **8+ independent Supabase queries** on mount, plus the `useBadgeCheck` hook fires **6 more parallel queries** that fetch **all** study sessions unbounded. This means every dashboard visit generates **14+ DB calls** and pulls potentially tens of thousands of rows.

### Top 3 Highest-Impact Improvements

| # | Improvement | Est. Impact |
|---|-------------|-------------|
| 1 | **Eliminate N+1 queries in challenge progress** (`Social.tsx` L265-291) — sequential `for` loop fires one query per challenge | Latency ↓ 80-95% on Challenges tab |
| 2 | **Bound & paginate `useBadgeCheck` session fetch** — currently `SELECT *` on all study_sessions with no LIMIT | Memory ↓ 50-90%, latency ↓ 50%+ |
| 3 | **Add route-level code-splitting** with `React.lazy` — all 12 pages are bundled eagerly | Initial bundle size ↓ 40-60% |

### Biggest Risk If No Changes Are Made

As user data grows (thousands of study sessions, hundreds of assignments), the **Dashboard and Badge Check will become visibly slow** (3-10+ second loads) and the **challenge progress tab will become unusable** with more than 5 challenges due to the N+1 query problem.

---

## 2) Findings (Prioritized)

---

### F1: N+1 Queries in Challenge Progress Calculation

* **Category:** DB / Algorithm  
* **Severity:** Critical  
* **Impact:** Latency, DB load, cost  
* **Evidence:** [`Social.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Social.tsx#L260-L296) — `challengeProgress` query iterates each challenge in a `for` loop, issuing a separate `supabase.from('study_sessions').select('duration')` query per challenge.
* **Why it's inefficient:** With 10 challenges, this is 10 sequential DB calls. Each one carries network latency overhead (~50-200ms). The same pattern occurs in [`Dashboard.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Dashboard.tsx#L216-L228) for `activeChallenges`.
* **Recommended fix:**
  1. Create a Supabase RPC function `get_challenge_progress(user_id, challenge_ids[])` that calculates all progress in a single SQL query using `GROUP BY challenge_id`.
  2. Or at minimum, collect all participant user IDs and date ranges, then make a single `study_sessions` query with `.in('user_id', allIds)` and filter/group client-side.
* **Tradeoffs / Risks:** Requires a new RPC function or more complex client-side grouping logic.
* **Expected impact:** Latency reduced from `O(n * RTT)` to `O(1 * RTT)` — e.g., 10 challenges × 150ms = 1500ms → ~150ms.
* **Removal Safety:** Safe
* **Reuse Scope:** Module (Social + Dashboard)

---

### F2: Unbounded `SELECT *` on Study Sessions in Badge Check

* **Category:** DB / Memory  
* **Severity:** Critical  
* **Impact:** Memory, latency, DB load  
* **Evidence:** [`useBadgeCheck.ts`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/hooks/useBadgeCheck.ts#L32) — `supabase.from('study_sessions').select('*').eq('user_id', user.id)` fetches **all columns of all sessions** with no limit.
* **Why it's inefficient:** A user with 1,000 study sessions transfers all rows into browser memory. The `*` also pulls unnecessary columns (`note`, `end_time`, etc.). Additionally, the badge check computes stats like streaks and weekly hours using pure JS iteration that could be done server-side.
* **Recommended fix:**
  1. Select only needed columns: `.select('start_time, duration, course_id')`.
  2. For streak calculation, use a server-side RPC or limit to last 90 days.
  3. For total hours, use `supabase.rpc('get_total_study_hours')` instead of summing client-side.
  4. For weekly marathon check, limit the query to relevant time windows.
* **Tradeoffs / Risks:** Requires selective column fetching and potentially new RPC functions.
* **Expected impact:** Payload size ↓ 60-80%, memory usage ↓ significantly.
* **Removal Safety:** Likely Safe
* **Reuse Scope:** Module (Hook used on Dashboard)

---

### F3: No Route-Level Code Splitting

* **Category:** Frontend / Build  
* **Severity:** High  
* **Impact:** Initial load time, bundle size  
* **Evidence:** [`App.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/App.tsx#L1-L15) — all 12 page components are statically imported at the top level.
* **Why it's inefficient:** Even if a user only visits the Dashboard, they download the code for Social (58KB), Calendar (43KB), Grades (34KB), Schedule (31KB), etc. The combined page source is ~300KB+ before minification.
* **Recommended fix:**
  ```tsx
  const Dashboard = lazy(() => import('./pages/Dashboard'))
  const Social = lazy(() => import('./pages/Social'))
  // ... all pages
  // Wrap routes in <Suspense fallback={<LoadingSpinner />}>
  ```
* **Tradeoffs / Risks:** Minimal — adds a brief loading spinner on route transition.
* **Expected impact:** Initial JS bundle ↓ 40-60%. Each page loads on demand.
* **Removal Safety:** Safe
* **Reuse Scope:** Service-wide

---

### F4: Duplicated Presence Subscription Logic

* **Category:** Code Reuse / Network  
* **Severity:** High  
* **Impact:** Maintainability, network (2 realtime channels for same data on page switch)  
* **Evidence:**
  - [`Dashboard.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Dashboard.tsx#L248-L276): Presence fetch + subscription (channel: `dashboard_presence`)
  - [`Social.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Social.tsx#L57-L85): Nearly identical code (channel: `presence_updates`)
* **Why it's inefficient:** Two places maintain the same logic. If a user navigated from Dashboard → Social, both subscriptions would briefly overlap. Bug fixes must be applied twice.
* **Recommended fix:** Extract a custom hook `useFriendPresence(friendIds)` that manages the query + realtime channel, returning the `friendPresence` map. Both pages import and use it.
* **Tradeoffs / Risks:** None — strictly cleaner.
* **Expected impact:** ~50 lines of duplicated code removed, single source of truth for presence logic.
* **Removal Safety:** Safe
* **Reuse Scope:** Module (Dashboard + Social)

---

### F5: Streak Calculation Fetches All Sessions Then Scans Linearly

* **Category:** DB / Algorithm  
* **Severity:** High  
* **Impact:** Latency, memory  
* **Evidence:** [`Dashboard.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Dashboard.tsx#L140-L174) — `streak_dashboard` query fetches ALL `start_time` values for the user, sorted descending, then scans day-by-day. A second identical computation exists in [`useBadgeCheck.ts`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/hooks/useBadgeCheck.ts#L50-L65).
* **Why it's inefficient:** Downloading thousands of timestamps just to count consecutive days. This should be an SQL window function or a dedicated RPC.
* **Recommended fix:**
  1. Create a Supabase RPC `get_current_streak(user_id)` that computes the streak in a single SQL query using `DISTINCT DATE(start_time)` and a gap-detection window function.
  2. Alternatively, limit the query to the last 365 days (no realistic streak exceeds that).
* **Tradeoffs / Risks:** Requires a new RPC function.
* **Expected impact:** Memory ↓ 90%+ for heavy users, latency ↓ proportionally.
* **Removal Safety:** Safe
* **Reuse Scope:** Module (Dashboard + useBadgeCheck)

---

### F6: `import * as Icons from 'lucide-react'` on Dashboard

* **Category:** Build / Bundle  
* **Severity:** Medium  
* **Impact:** Bundle size (tree-shaking may be blocked)  
* **Evidence:** [`Dashboard.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Dashboard.tsx#L7) — `import * as Icons from 'lucide-react'` alongside named imports on the next line.
* **Why it's inefficient:** `import *` can prevent tree-shaking of the entire lucide-react module (~1,500+ icons) depending on bundler behavior. It's used only for dynamic badge icon lookup `(Icons as any)[b.icon]`.
* **Recommended fix:** Create a small icon registry mapping only the ~20-30 badge icon names to their components:
  ```ts
  const BADGE_ICONS: Record<string, LucideIcon> = { Medal, Trophy, Flame, ... }
  const IconComponent = BADGE_ICONS[b.icon] || Medal
  ```
* **Tradeoffs / Risks:** Must enumerate known badge icons; new icons need manual addition.
* **Expected impact:** Bundle size ↓ 30-100KB (lucide-react is large).
* **Removal Safety:** Safe
* **Reuse Scope:** Local (Dashboard + Badges page)

---

### F7: Duplicate `formatTime` Utility

* **Category:** Code Reuse  
* **Severity:** Medium  
* **Impact:** Maintainability  
* **Evidence:**
  - [`StudyTimer.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/components/StudyTimer.tsx#L198-L203): `formatTime(totalSeconds)` (h:mm:ss)
  - [`StudyDuel.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/components/StudyDuel.tsx#L25-L29): `formatTime(seconds)` (h:mm:ss) — slightly different format
* **Why it's inefficient:** Copy-paste drift risk. Two implementations that do slightly different padding.
* **Recommended fix:** Extract to a shared utility in `src/lib/formatters.ts`.
* **Tradeoffs / Risks:** None.
* **Expected impact:** Deduplication, single source of truth.
* **Removal Safety:** Safe
* **Reuse Scope:** Service-wide

---

### F8: Calendar `upcoming_events` Query Has No Limit

* **Category:** DB / Memory  
* **Severity:** Medium  
* **Impact:** Latency, memory  
* **Evidence:** [`Calendar.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Calendar.tsx#L93-L103) — fetches ALL assignments for the user without any date filter or limit.
* **Why it's inefficient:** As assignments accumulate over semesters, this will fetch hundreds/thousands of records including old, completed ones.
* **Recommended fix:** Add date range filter (e.g., last 30 days past + 60 days future) and/or limit. Filter `is_completed: false` for the upcomng view, or add pagination.
* **Tradeoffs / Risks:** Users might want to see old completed events — add a separate "archive" query with pagination if needed.
* **Expected impact:** Payload size ↓ 50-80% for active users.
* **Removal Safety:** Likely Safe
* **Reuse Scope:** Local

---

### F9: Calendar Import Inserts Assignments Sequentially

* **Category:** I/O / DB  
* **Severity:** Medium  
* **Impact:** Latency during import  
* **Evidence:** [`Calendar.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Calendar.tsx#L292-L303) — `for (const a of json.assignments) { await supabase.from('assignments').insert({...}) }` — one `INSERT` per assignment.
* **Why it's inefficient:** Importing 50 assignments = 50 sequential DB calls. Each has full RTT overhead.
* **Recommended fix:** Batch all assignments into a single `.insert(arrayOfRows)` call.
  ```ts
  const rows = json.assignments.filter(...).map(a => ({...}))
  await supabase.from('assignments').insert(rows)
  ```
* **Tradeoffs / Risks:** If one row fails, the entire batch fails — add error handling.
* **Expected impact:** 50 → 1 DB roundtrip. Import time ↓ 95%.
* **Removal Safety:** Safe
* **Reuse Scope:** Local

---

### F10: `useBadgeCheck` Runs on Every Dashboard Mount (No Throttle)

* **Category:** DB / Cost  
* **Severity:** Medium  
* **Impact:** DB load, latency, cost  
* **Evidence:** [`useBadgeCheck.ts`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/hooks/useBadgeCheck.ts#L9-L337) — The hook fires `checkBadges()` every time the Dashboard mounts, performing 6 parallel queries + potentially costly JS calculations.
* **Why it's inefficient:** If a user rapidly navigates to/from the Dashboard (or React strict mode double-renders in dev), badges are re-checked every time. There's no debounce, throttle, or cache.
* **Recommended fix:**
  1. Wrap in a React Query with `staleTime: 5 * 60 * 1000` (5 min) so it only runs once per 5 minutes.
  2. Or use `localStorage` timestamp to skip re-checks within a time window (already done for exam reminders, same pattern).
* **Tradeoffs / Risks:** Slightly delayed badge award (5 min max).
* **Expected impact:** DB calls ↓ 80-90% on repeated Dashboard visits.
* **Removal Safety:** Safe
* **Reuse Scope:** Local

---

### F11: `QueryClient` Created Without Configuration

* **Category:** Caching / Network  
* **Severity:** Medium  
* **Impact:** Unnecessary re-fetching on tab focus  
* **Evidence:** [`App.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/App.tsx#L18) — `const queryClient = new QueryClient()` with no custom defaults.
* **Why it's inefficient:** React Query defaults: `staleTime: 0` (every query is immediately stale), `refetchOnWindowFocus: true`. This means every time the user switches tabs and comes back, **all visible queries re-fire**. With 8+ queries on Dashboard, that's 8+ unnecessary DB roundtrips on every tab switch.
* **Recommended fix:**
  ```ts
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,  // 2 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
  ```
* **Tradeoffs / Risks:** Data may be up to 2 minutes stale; users can manually refresh.
* **Expected impact:** DB calls ↓ 50-70% from reduced refetching.
* **Removal Safety:** Safe
* **Reuse Scope:** Service-wide

---

### F12: Duplicate Friends Query Across Pages

* **Category:** Code Reuse / Network  
* **Severity:** Medium  
* **Impact:** Maintainability, duplicate network calls  
* **Evidence:**
  - [`Dashboard.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Dashboard.tsx#L235-L245): queryKey `['dashboard_friends']`
  - [`Social.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Social.tsx#L36-L54): queryKey `['friends']`
  - [`Calendar.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Calendar.tsx#L106-L116): queryKey `['friends_for_share']`
* **Why it's inefficient:** Three different query keys for the same data means the cache isn't shared, and the same query runs three times across pages.
* **Recommended fix:** Unify under a single queryKey (`['friends']`) and create a shared hook `useFriends()`. All three pages use it.
* **Tradeoffs / Risks:** None.
* **Expected impact:** 2 fewer redundant DB calls, shared cache.
* **Removal Safety:** Safe
* **Reuse Scope:** Service-wide

---

### F13: Courses Queried Multiple Times with Different Keys

* **Category:** Code Reuse / Network  
* **Severity:** Medium  
* **Impact:** Duplicate DB calls, cache fragmentation  
* **Evidence:**
  - [`StudyTimer.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/components/StudyTimer.tsx#L51-L57): queryKey `['courses']`, selects `id, name, code, color`
  - [`Calendar.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Calendar.tsx#L119-L125): queryKey `['courses']`, selects `id, name`
  - [`useBadgeCheck.ts`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/hooks/useBadgeCheck.ts#L36): selects `*, study_sessions(duration, start_time)`
* **Why it's inefficient:** Same queryKey but different `select()` calls means React Query may serve stale data from a previous query with fewer columns.
* **Recommended fix:** Create a `useCourses()` hook that always selects a consistent column set and uses a single queryKey.
* **Tradeoffs / Risks:** Some extra columns fetched where not needed (negligible overhead).
* **Expected impact:** Consistency, fewer bugs from mismatched cache.
* **Removal Safety:** Safe
* **Reuse Scope:** Service-wide

---

### F14: Legacy / Dead Notification Exports

* **Category:** Dead Code  
* **Severity:** Low  
* **Impact:** Bundle size, maintainability  
* **Evidence:** [`pushNotifications.ts`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/lib/pushNotifications.ts#L194-L206) — `isPushNotificationSupported`, `subscribeToPushNotifications`, `unsubscribeFromPushNotifications`, `isSubscribedToPush` are labelled "Legacy exports" — they are thin wrappers or no-ops.
* **Why it's inefficient:** Dead code increases cognitive load and bundle size (minor).
* **Recommended fix:** Search for usages. If unused, remove. If used, inline the actual implementation.
* **Tradeoffs / Risks:** Verify no external callers first.
* **Expected impact:** ~15 lines removed, cleaner API surface.
* **Removal Safety:** Needs Verification
* **Reuse Scope:** Local

---

### F15: `AuthContext.fetchProfile` Uses `SELECT *`

* **Category:** DB / Network  
* **Severity:** Low  
* **Impact:** Slightly larger payloads  
* **Evidence:** [`AuthContext.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/context/AuthContext.tsx#L32-L36) — `.select('*')` on profiles table.
* **Why it's inefficient:** Pulls all profile columns including potentially unused fields.
* **Recommended fix:** Select only used columns: `.select('id, email, display_name, avatar_url, bio, total_xp, level')`.
* **Tradeoffs / Risks:** Must update if new profile fields are needed.
* **Expected impact:** Minimal — but good practice.
* **Removal Safety:** Safe
* **Reuse Scope:** Local

---

### F16: `addXP()` Is a Read-Then-Write (Race Condition Risk)

* **Category:** Reliability / Concurrency  
* **Severity:** Medium  
* **Impact:** Data correctness  
* **Evidence:** [`xpSystem.ts`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/lib/xpSystem.ts#L33-L73) — Reads `total_xp`, adds amount client-side, then writes back. If two tabs or rapid actions call `addXP` concurrently, one update will be lost.
* **Why it's inefficient:** Classic lost-update race condition.
* **Recommended fix:** Use an atomic server-side increment via Supabase RPC:
  ```sql
  CREATE OR REPLACE FUNCTION add_user_xp(uid UUID, amount INT)
  RETURNS VOID AS $$
    UPDATE profiles SET total_xp = total_xp + amount, level = floor(sqrt((total_xp + amount) / 100))
    WHERE id = uid;
  $$ LANGUAGE SQL SECURITY DEFINER;
  ```
  Then call `supabase.rpc('add_user_xp', { uid: userId, amount })`.
* **Tradeoffs / Risks:** Requires new RPC function.
* **Expected impact:** Eliminates XP data loss on concurrent operations.
* **Removal Safety:** Safe
* **Reuse Scope:** Service-wide

---

### F17: `incomingShares` Polled at 15s Intervals

* **Category:** Network / Cost  
* **Severity:** Low  
* **Impact:** Unnecessary network usage  
* **Evidence:** [`Calendar.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/pages/Calendar.tsx#L128-L140) — `refetchInterval: 15000`.
* **Why it's inefficient:** Continuous polling every 15s for a rarely-occurring event (event shares). This means ~4 queries/minute even when idle on the calendar page.
* **Recommended fix:** Use Supabase Realtime subscription on `event_shares` table (same pattern as presence), or increase interval to 60s with an on-focus refetch.
* **Tradeoffs / Risks:** Realtime subscription adds a persistent WebSocket channel.
* **Expected impact:** DB calls ↓ 75% on Calendar page.
* **Removal Safety:** Safe
* **Reuse Scope:** Local

---

### F18: StudyDuel Fetch Polls at 10s Intervals  

* **Category:** Network / Cost  
* **Severity:** Low  
* **Impact:** Unnecessary DB roundtrips  
* **Evidence:** [`StudyDuel.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/components/StudyDuel.tsx#L529) — `refetchInterval: 10000` for `my_duels` query.
* **Why it's inefficient:** Polls even when no active duel exists. The component already uses Realtime channels for active duels.
* **Recommended fix:** Only enable `refetchInterval` when the duels tab is active, or use Realtime for duel status changes too.
* **Tradeoffs / Risks:** Minimal.
* **Expected impact:** 6 queries/minute → 0 when no duel.
* **Removal Safety:** Safe
* **Reuse Scope:** Local

---

### F19: Multiple Redundant SQL Script Files at Root

* **Category:** Dead Code / Maintainability  
* **Severity:** Low  
* **Impact:** Developer confusion, maintenance burden  
* **Evidence:** Root directory contains 18 `supabase_*.sql` files including seemingly redundant/overlapping ones: `supabase_badge_fixes.sql`, `supabase_fix_badges.sql`, `supabase_new_badges.sql`; and utility scripts like `check_badges.js`, `check_badges.mjs`, `verify_badges_db.js`, `update_badges.js`, `generate_dedupe_sql.js`.
* **Why it's inefficient:** Unclear which scripts are current. Risk of running outdated migrations.
* **Recommended fix:** Consolidate into a `migrations/` or `supabase/migrations/` directory with numbered/timestamped files. Archive or delete one-off utility scripts.
* **Tradeoffs / Risks:** Must verify which scripts have been run.
* **Expected impact:** Cleaner project root, reduced confusion.
* **Removal Safety:** Needs Verification
* **Reuse Scope:** Service-wide

---

### F20: Unused `breakUntil` Variable in StudyDuel

* **Category:** Dead Code  
* **Severity:** Low  
* **Impact:** Readability  
* **Evidence:** [`StudyDuel.tsx`](file:///c:/Users/fetih/OneDrive/Masaüstü/Ders%20Takibi/src/components/StudyDuel.tsx#L242) — `const breakUntil = new Date(Date.now() + parseInt(breakMinutes || '5') * 60000)` is declared but never used (the next line recalculates `until`).
* **Why it's inefficient:** Dead variable.
* **Recommended fix:** Remove the unused `breakUntil` line.
* **Tradeoffs / Risks:** None.
* **Expected impact:** Cleaner code.
* **Removal Safety:** Safe
* **Reuse Scope:** Local

---

## 3) Quick Wins (Do First)

| # | Finding | Time to Fix | Impact |
|---|---------|-------------|--------|
| 1 | **F11:** Configure `QueryClient` defaults (`staleTime`, `refetchOnWindowFocus`) | 5 min | High — eliminates ~50% of re-fetches |
| 2 | **F6:** Replace `import *` with explicit badge icon registry | 15 min | Medium — bundle size ↓ |
| 3 | **F9:** Batch calendar import into single `.insert()` | 10 min | Medium — 50x faster imports |
| 4 | **F7:** Extract `formatTime` to shared utility | 10 min | Low — dedup |
| 5 | **F15:** Change `fetchProfile` to use `.select('id, email, ...')` | 2 min | Low — good practice |
| 6 | **F20:** Remove unused `breakUntil` variable | 1 min | Low — cleanup |
| 7 | **F14:** Audit and remove legacy notification exports | 10 min | Low — cleanup |

---

## 4) Deeper Optimizations (Do Next)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | **F1:** Create `get_challenge_progress` RPC to eliminate N+1 | 1-2 hours | Critical — N+1 elimination |
| 2 | **F2:** Refactor `useBadgeCheck` to use selective queries + RPC | 2-3 hours | Critical — unbounded data eliminated |
| 3 | **F3:** Add `React.lazy` code-splitting on all routes | 30 min | High — initial load ↓ 40-60% |
| 4 | **F4+F12+F13:** Extract shared hooks (`useFriendPresence`, `useFriends`, `useCourses`) | 1-2 hours | High — dedup + cache sharing |
| 5 | **F5:** Create `get_current_streak` RPC | 1 hour | High — eliminates full session fetch for streak |
| 6 | **F16:** Create `add_user_xp` atomic RPC | 30 min | Medium — data correctness |
| 7 | **F10:** Throttle badge check to max once per 5 minutes | 15 min | Medium — DB load ↓ |
| 8 | **F17+F18:** Replace polling with Realtime subscriptions or conditional polling | 1 hour | Low-Medium — reduces constant DB load |
| 9 | **F19:** Consolidate SQL migration files | 1-2 hours | Low — developer experience |

---

## 5) Validation Plan

### Benchmarks

1. **Before/After query count:** Open browser DevTools → Network tab → filter by `supabase`/`rest`. Count requests on:
   - Dashboard load
   - Social → Challenges tab
   - Calendar page
   - Tab-switch and back to Dashboard
   
2. **Bundle size comparison:**
   ```bash
   # Before changes
   npm run build
   # Note the output sizes in dist/assets/
   
   # After code-splitting + icon registry
   npm run build
   # Compare chunk sizes
   ```

3. **Payload size for badge check:** In DevTools Network, observe the response size of the `study_sessions` query. Before: all rows. After: limited columns + date range → measure the reduction.

### Profiling Strategy

- Use **React DevTools Profiler** to measure component render times on Dashboard
- Use **Supabase Dashboard → Logs** to monitor query frequency and execution time
- Use **Lighthouse** to measure initial page load, LCP, and TTI before and after code-splitting

### Test Cases to Preserve Correctness

| Test | What to Verify |
|------|----------------|
| Badge check | Award same badges after refactoring `useBadgeCheck` (compare earned badges before/after) |
| Challenge progress | Verify progress % matches between N+1 and batched approach (create 3 challenges with known study data) |
| Streak calculation | Verify streak count matches between client-side and RPC approach (test edge cases: today, yesterday gap, zero sessions) |
| XP addition | Verify concurrent `addXP` calls produce correct total (open two tabs, trigger XP from both) |
| Code-splitting | Verify all routes still load correctly after `React.lazy` migration; check no broken imports |
| Calendar import | Import a JSON file with 10+ events — verify all appear in the calendar |

### Manual Verification

- Navigate through all pages after changes — ensure no regressions in UI
- Create a study session, earn a badge, verify confetti + notification still fire
- Test friend presence: one user studying, another viewing Dashboard → presence dot should appear
- Test calendar share workflow: share an event → accept on another account → verify it appears

---

## 6) Optimized Code / Patches (Key Fixes)

### Patch 1: QueryClient Configuration

```diff
// App.tsx
-const queryClient = new QueryClient()
+const queryClient = new QueryClient({
+  defaultOptions: {
+    queries: {
+      staleTime: 2 * 60 * 1000,      // 2 minutes
+      refetchOnWindowFocus: false,
+      retry: 1,
+    },
+  },
+})
```

### Patch 2: Route-Level Code Splitting

```diff
// App.tsx
-import Dashboard from './pages/Dashboard'
-import Social from './pages/Social'
-import CalendarPage from './pages/Calendar'
-// ... etc
+import { lazy, Suspense } from 'react'
+const Dashboard = lazy(() => import('./pages/Dashboard'))
+const Social = lazy(() => import('./pages/Social'))
+const CalendarPage = lazy(() => import('./pages/Calendar'))
+const Analytics = lazy(() => import('./pages/Analytics'))
+const Settings = lazy(() => import('./pages/Settings'))
+const Badges = lazy(() => import('./pages/Badges'))
+const Schedule = lazy(() => import('./pages/Schedule'))
+const Attendance = lazy(() => import('./pages/Attendance'))
+const Grades = lazy(() => import('./pages/Grades'))
+const Study = lazy(() => import('./pages/Study'))
+const CourseDetail = lazy(() => import('./pages/CourseDetail'))
+
+// Wrap routes:
+<Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
+  <Routes>...</Routes>
+</Suspense>
```

### Patch 3: Badge Icon Registry (Replace `import *`)

```diff
// Dashboard.tsx
-import * as Icons from 'lucide-react'
-import { Play, Calendar, BookOpen, ... } from 'lucide-react'
+import { Play, Calendar, BookOpen, ..., Medal, Flame, Star, Zap, Coffee, Moon, Sun } from 'lucide-react'
+
+const BADGE_ICONS: Record<string, any> = {
+  Medal, Flame, Star, Zap, Trophy, Coffee, Moon, Sun, BookOpen, Target,
+  ShieldCheck, Clock, Calendar, Users, Swords, GraduationCap,
+  // Add known badge icons here
+}

// In render:
-const IconComponent = (Icons as any)[b.icon] || Icons.Medal;
+const IconComponent = BADGE_ICONS[b.icon] || Medal;
```

### Patch 4: Batch Calendar Import

```diff
// Calendar.tsx handleImport
-let imported = 0
-for (const a of json.assignments) {
-    const courseId = courseMap[a.course]
-    if (!courseId || !a.title || !a.due_date) continue
-    await supabase.from('assignments').insert({
-        user_id: user?.id, course_id: courseId,
-        title: a.title, type: a.type || 'other',
-        due_date: a.due_date, is_completed: a.is_completed || false,
-    })
-    imported++
-}
+const rows = json.assignments
+    .filter((a: any) => courseMap[a.course] && a.title && a.due_date)
+    .map((a: any) => ({
+        user_id: user?.id,
+        course_id: courseMap[a.course],
+        title: a.title,
+        type: a.type || 'other',
+        due_date: a.due_date,
+        is_completed: a.is_completed || false,
+    }))
+if (rows.length > 0) {
+    const { error } = await supabase.from('assignments').insert(rows)
+    if (error) throw error
+}
+const imported = rows.length
```

### Patch 5: Selective Columns in Badge Check

```diff
// useBadgeCheck.ts
 const [sessionsRes, friendsRes, challengesRes, profileRes, coursesRes, assignmentsRes] = await Promise.all([
-    supabase.from('study_sessions').select('*').eq('user_id', user.id).order('start_time', { ascending: false }),
+    supabase.from('study_sessions')
+        .select('start_time, duration, course_id')
+        .eq('user_id', user.id)
+        .order('start_time', { ascending: false })
+        .limit(5000),  // Safety limit
     // ... rest unchanged
 ])
```
