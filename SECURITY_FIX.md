# Client Isolation Security Fix

## Overview

This document describes the critical security vulnerability that was fixed and the implementation details of the database-level client isolation system.

## The Vulnerability

### Problem Description

A critical multi-tenant security vulnerability existed where users authenticated in one client (e.g., `/inverta/index`) could access data from another client (e.g., `/demo/index`) by simply navigating to a different URL.

### Root Cause

1. **Client ID was only a JavaScript variable** - `CURRENT_CLIENT` was defined in the HTML file and could be changed by navigating to a different URL
2. **Supabase OTP authentication was global** - Once authenticated, the session worked across all clients
3. **No database-level enforcement** - All security checks were client-side only
4. **No Row Level Security (RLS)** - Database tables had no policies to restrict data access
5. **Edge Functions had no JWT verification** - Functions accepted requests without validating user identity or permissions

### Security Impact

- **HIGH SEVERITY**: Authenticated users could access data from ANY client, not just their authorized client
- Data breach potential across all clients
- Unauthorized access to sensitive lot information, pricing, and sales data

## The Solution

### Architecture Overview

The fix implements a **defense-in-depth** strategy with multiple security layers:

1. **Database Layer**: Row Level Security (RLS) policies
2. **Application Layer**: Client access validation on every page load
3. **API Layer**: JWT verification and client validation in Edge Functions
4. **Audit Layer**: Enhanced logging with client_id tracking

### Implementation Details

#### 1. Database Migration (`supabase/migrations/20250124_client_isolation_security.sql`)

**Purpose**: Establish database-level client isolation

**Changes**:
- Added `user_id` column to `editors` table (links to `auth.users`)
- Enabled Row Level Security on all tables: `lots`, `pins`, `editors`, `lot_updates_audit`
- Created RLS policies that restrict data access based on user's authorized client(s)
- Created helper functions:
  - `get_user_client_ids(user_id)` - Returns all client_ids a user has access to
  - `user_has_client_access(user_id, client_id)` - Validates client access
  - `link_user_to_editor()` - Auto-links users to editors on signup
- Backfilled existing users by matching `auth.users.email` with `editors.email`

**Key RLS Policy Example**:
```sql
CREATE POLICY "Users can only access their client's lots"
ON lots FOR ALL
USING (
  client_id IN (
    SELECT DISTINCT e.client_id
    FROM editors e
    WHERE e.user_id = auth.uid()
  )
);
```

This ensures that even with a valid session, users can ONLY see data from their authorized client(s).

#### 2. Front-End Validation (demo/index.html & inverta/index.html)

**Purpose**: Immediate client access validation in the browser

**New Function**: `validateClientAccess(session)`
- Checks if authenticated user has access to `CURRENT_CLIENT`
- Queries `editors` table filtering by `user_id` and `client_id`
- If unauthorized, immediately signs user out and shows error message

**Integration Points**:
1. **After OTP verification** (line ~1210) - Validates before allowing login
2. **On page load** (line ~1235) - Validates existing session
3. **On auth state change** (line ~1247) - Re-validates on any auth event

**User Experience**:
- User logs into `/inverta/index` ✅
- User navigates to `/demo/index` ⚠️
- System detects unauthorized access
- User is immediately signed out with message: "No tienes acceso a este cliente. Has sido desconectado."

#### 3. Edge Function Security

##### 3.1 Config Changes (`supabase/config.toml`)

```toml
[functions.create-payment-intent]
verify_jwt = true  # Changed from false
```

Now Supabase verifies JWT tokens before the function executes.

##### 3.2 Create Payment Intent (`supabase/functions/create-payment-intent/index.ts`)

**Changes**:
- Requires `client_id` in request body
- Verifies JWT and extracts authenticated user
- Validates user has access to requested `client_id` via `editors` table
- Returns 403 Forbidden if unauthorized
- Stores `client_id` and `user_email` in Stripe payment intent metadata

**Security Flow**:
1. Request arrives with JWT in Authorization header
2. Supabase verifies JWT (config.toml setting)
3. Function extracts user from token
4. Function queries `editors` table: `WHERE user_id = ? AND client_id = ?`
5. If no match, returns 403 error
6. If authorized, creates payment intent with client_id in metadata

##### 3.3 Stripe Webhook (`supabase/functions/stripe-webhook/index.ts`)

**Changes**:
- Extracts `client_id` from payment intent metadata (instead of hardcoding 'inverta')
- Uses dynamic `client_id` in all database queries
- Validates `client_id` is present before processing
- Stores `client_id` in audit records

**Impact**:
- Webhooks now respect multi-tenant architecture
- Each client's payments update the correct client's data
- Audit trail includes client_id for compliance

## Deployment Instructions

### Prerequisites

1. Access to Supabase project
2. Supabase CLI installed: `npm install -g supabase`
3. Git repository access

### Step 1: Apply Database Migration

Option A - Via Supabase Dashboard:
1. Log into https://app.supabase.com
2. Go to SQL Editor
3. Copy contents of `supabase/migrations/20250124_client_isolation_security.sql`
4. Execute the SQL
5. Verify no errors

Option B - Via Supabase CLI:
```bash
supabase db push
```

### Step 2: Link Users to Editors

The migration includes a backfill query, but verify it worked:

```sql
-- Check if all editors have user_id linked
SELECT email, user_id, client_id
FROM editors
WHERE user_id IS NULL;
```

If any editors are missing `user_id`, manually link them:

```sql
UPDATE editors e
SET user_id = u.id
FROM auth.users u
WHERE e.email = u.email
AND e.user_id IS NULL;
```

### Step 3: Deploy Edge Functions

```bash
# Deploy create-payment-intent with JWT verification
supabase functions deploy create-payment-intent

# Deploy stripe-webhook with client_id support
supabase functions deploy stripe-webhook
```

### Step 4: Update Environment Variables

Ensure these are set in Supabase Dashboard → Project Settings → Edge Functions:

- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook signing secret
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_ANON_KEY` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase (for webhooks)

### Step 5: Deploy Front-End Changes

The HTML files need to be deployed to your hosting environment. No build step required.

```bash
# If using a deployment service, push changes
git add .
git commit -m "fix: implement client isolation security"
git push origin main
```

### Step 6: Test the Fix

#### Test 1: Verify RLS is working
```sql
-- Set a user context (replace with real user ID)
SET request.jwt.claim.sub = 'some-user-uuid';

-- Try to query lots - should only return lots from user's authorized client(s)
SELECT * FROM lots;
```

#### Test 2: Cross-client access attempt
1. Log into `/inverta/index` with authorized email
2. Successfully authenticate
3. Navigate to `/demo/index`
4. Expected: Immediate sign-out with error message
5. Verify you cannot see any demo data

#### Test 3: Edge Function validation
```bash
# Get a JWT token from authenticated session (from browser dev tools)
TOKEN="your-jwt-token"

# Try to create payment intent for unauthorized client
curl -X POST https://your-project.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "lotNumber": "1",
    "lotName": "test",
    "client_id": "unauthorized_client"
  }'

# Expected: 403 Forbidden
```

## Security Checklist

After deployment, verify:

- [ ] RLS is enabled on all tables (`lots`, `pins`, `editors`, `lot_updates_audit`)
- [ ] All existing users have `user_id` populated in `editors` table
- [ ] Cross-client navigation logs users out immediately
- [ ] Edge Functions require valid JWT tokens
- [ ] Edge Functions validate client access
- [ ] Stripe webhooks use dynamic `client_id` (not hardcoded)
- [ ] Audit logs include `client_id` for all entries
- [ ] Payment intents store `client_id` in metadata

## Maintenance

### Adding New Users

When adding new users to the system:

1. Add entry to `editors` table with their email and `client_id`:
```sql
INSERT INTO editors (email, client_id)
VALUES ('user@example.com', 'inverta');
```

2. When the user signs in for the first time, the trigger will automatically link their `user_id`

### Adding New Clients

To add a new client:

1. Create new HTML file (e.g., `newclient/index.html`)
2. Set `CURRENT_CLIENT = 'newclient'` in the HTML
3. Add users to `editors` table with `client_id = 'newclient'`
4. Ensure all database tables include entries with `client_id = 'newclient'`

### Revoking Access

To revoke a user's access to a client:

```sql
DELETE FROM editors
WHERE user_id = 'user-uuid'
AND client_id = 'client-to-revoke';
```

User will be immediately logged out on next page load or navigation.

## Performance Considerations

- RLS policies add a JOIN on every query (negligible performance impact)
- `validateClientAccess()` runs on every page load (one additional query)
- Consider adding Redis/caching for high-traffic scenarios
- Indexes are already created on `editors(user_id)` and `editors(email, client_id)`

## Rollback Procedure

If you need to rollback (NOT RECOMMENDED):

```sql
-- Disable RLS (DANGEROUS - only for emergency rollback)
ALTER TABLE lots DISABLE ROW LEVEL SECURITY;
ALTER TABLE pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE editors DISABLE ROW LEVEL SECURITY;
ALTER TABLE lot_updates_audit DISABLE ROW LEVEL SECURITY;
```

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs → Edge Functions
2. Check browser console for front-end validation errors
3. Verify RLS policies: Dashboard → Table Editor → Policies
4. Test with `EXPLAIN` to see query plans

## Compliance Notes

This fix addresses:

- **OWASP Top 10**: A01:2021 - Broken Access Control
- **Multi-tenancy**: Proper data isolation between clients
- **Defense in Depth**: Multiple security layers
- **Principle of Least Privilege**: Users only access their authorized data
- **Audit Trail**: All actions tracked with client_id

## Conclusion

This security fix transforms the application from **client-side only** security to **database-enforced** multi-tenant isolation. Even if front-end code is bypassed, the database RLS policies ensure users can ONLY access data from their authorized client(s).

**The vulnerability is now CLOSED** with defense-in-depth security at database, application, and API layers.
