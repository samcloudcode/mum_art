# PRP: Supabase Auth with Next.js Frontend

## Issue Context

- **Issue Number**: #3
- **Issue Title**: Set up Supabase Auth for user login
- **Priority/Labels**: None specified
- **Reporter**: samcloudcode
- **Created**: 2025-12-17

### Key Requirements from Issue
- Set up Supabase Authentication for the art inventory app
- Allow Mum (Sue), Dad (Chris), and Sam to log in
- Enable Email auth provider in Supabase Dashboard
- Create user accounts for Sam, Chris, Sue (all admin role)
- Verify `profiles` table trigger creates profile on signup
- Test RLS policies work with authenticated users
- Document login flow

### Acceptance Criteria
- [ ] Email auth provider enabled in Supabase
- [ ] User accounts created for family members
- [ ] Profile trigger correctly creates profile entry on signup
- [ ] RLS policies allow authenticated users CRUD access
- [ ] Login/logout flow works end-to-end
- [ ] Protected routes redirect unauthenticated users

---

## Current State Analysis

### Database Setup (Already Complete)
The Supabase database is already configured with:

**Profiles Table:**
```sql
-- columns: id (uuid PK), email, full_name, role (default 'admin'), created_at, updated_at
-- RLS enabled with policies for own-profile access
```

**Trigger for Auto-Profile Creation:**
```sql
-- on_auth_user_created trigger exists
-- Executes handle_new_user() function:
INSERT INTO public.profiles (id, email, full_name)
VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
```

**RLS Policies on profiles:**
- `Users can read own profile` - SELECT where auth.uid() = id
- `Users can update own profile` - UPDATE where auth.uid() = id

**RLS Policies on data tables (prints, distributors, editions):**
- Authenticated users have full CRUD access (already configured)

### Supabase Project Details
- **Project URL**: `https://jfgoonjqdspogbkjpgcb.supabase.co`
- **Anon Key Available**: Yes (JWT-based legacy key)
- **Publishable Key Available**: Yes (`sb_publishable_...`)

---

## Technical Architecture

### Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Language | TypeScript |
| Auth | Supabase Auth (@supabase/ssr) |
| Database | Supabase PostgreSQL |

### Project Structure (New `web/` Directory)
```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   ├── page.tsx          # Login form
│   │   │   │   └── actions.ts        # Server actions for login/signup
│   │   │   └── layout.tsx            # Auth layout (centered, minimal)
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx              # Dashboard (redirect target after login)
│   │   │   └── layout.tsx            # Protected layout with nav
│   │   ├── auth/
│   │   │   ├── confirm/route.ts      # Email confirmation handler
│   │   │   └── signout/route.ts      # Signout handler
│   │   ├── error/page.tsx            # Error page
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts             # Browser client
│   │       ├── server.ts             # Server client
│   │       └── middleware.ts         # Session refresh logic
│   └── components/
│       └── ui/                       # shadcn components
├── middleware.ts                     # Next.js middleware for auth
├── .env.local                        # Environment variables
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## Implementation Blueprint

### Phase 1: Next.js Project Setup

```bash
# Create Next.js app in web/ directory
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Install dependencies
cd web
npm install @supabase/supabase-js @supabase/ssr

# Install shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button input label card
```

### Phase 2: Supabase Client Configuration

**Browser Client (`lib/supabase/client.ts`):**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server Client (`lib/supabase/server.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - middleware handles this
          }
        },
      },
    }
  )
}
```

### Phase 3: Middleware for Session Refresh

**Critical Security Note from Supabase Docs:**
> Always use `supabase.auth.getUser()` to protect pages and user data.
> Never trust `supabase.auth.getSession()` inside server code - it doesn't revalidate the Auth token.

**Middleware (`middleware.ts`):**
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Phase 4: Login Page with Server Actions

**Login Form Component:**
```typescript
// app/(auth)/login/page.tsx
import { login } from './actions'

export default function LoginPage() {
  return (
    <form className="space-y-4">
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button formAction={login}>Log in</button>
    </form>
  )
}
```

**Server Actions:**
```typescript
// app/(auth)/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    redirect('/error?message=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
```

### Phase 5: Protected Routes

**Dashboard Layout (Protected):**
```typescript
// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div>
      <nav>{/* Navigation with user info and logout */}</nav>
      <main>{children}</main>
    </div>
  )
}
```

---

## Documentation References

### Official Supabase Docs
- **Next.js SSR Auth Guide**: https://supabase.com/docs/guides/auth/server-side/nextjs
- **Creating SSR Client**: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- **Full Next.js Tutorial**: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs

### Example Repository
- **GitHub Example**: https://github.com/supabase/supabase/tree/master/examples/user-management/nextjs-user-management

### Key Gotchas
1. **Always use `getUser()` not `getSession()` on server** - getSession doesn't validate JWT
2. **Middleware must refresh tokens** - Server Components can't write cookies
3. **Use `@supabase/ssr` not `@supabase/auth-helpers-nextjs`** - auth-helpers is deprecated
4. **Cookie name**: `sb-<project_ref>-auth-token` by default

---

## Tasks (Ordered)

### Setup Tasks
1. [ ] Create Next.js project in `web/` directory with TypeScript + Tailwind
2. [ ] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`
3. [ ] Initialize shadcn/ui and add button, input, label, card components
4. [ ] Create `.env.local` with Supabase URL and anon key

### Supabase Client Tasks
5. [ ] Create `lib/supabase/client.ts` (browser client)
6. [ ] Create `lib/supabase/server.ts` (server client)
7. [ ] Create `lib/supabase/middleware.ts` (session update logic)
8. [ ] Create root `middleware.ts` with route matcher

### Auth UI Tasks
9. [ ] Create auth layout `app/(auth)/layout.tsx` (centered, minimal styling)
10. [ ] Create login page `app/(auth)/login/page.tsx` with email/password form
11. [ ] Create login server actions `app/(auth)/login/actions.ts`
12. [ ] Create error page `app/error/page.tsx`

### Route Handler Tasks
13. [ ] Create signout route handler `app/auth/signout/route.ts`
14. [ ] Create email confirmation route `app/auth/confirm/route.ts` (for signup flow)

### Protected Area Tasks
15. [ ] Create dashboard layout `app/(dashboard)/layout.tsx` with auth check
16. [ ] Create dashboard page `app/(dashboard)/page.tsx` (simple welcome message)
17. [ ] Add logout button to dashboard navigation

### Supabase Dashboard Tasks (Manual - Dashboard Required)
> **Note:** The Supabase MCP tools available are for database operations (SQL, migrations, edge functions) but not for auth configuration or user management. These steps require the Supabase Dashboard.

18. [ ] **Enable Email auth provider** - Already enabled by default on hosted Supabase projects
19. [ ] **Update email template** - Go to [Auth Templates](https://supabase.com/dashboard/project/jfgoonjqdspogbkjpgcb/auth/templates) and update "Confirm signup" template (see Appendix)
20. [ ] **Create user accounts** - Go to [Auth Users](https://supabase.com/dashboard/project/jfgoonjqdspogbkjpgcb/auth/users) and click "Add user" for Sam, Chris, Sue

### Verification Tasks
21. [ ] Test login flow end-to-end
22. [ ] Verify profile is created on signup (check profiles table)
23. [ ] Verify RLS policies work (authenticated user can query data)
24. [ ] Test logout clears session
25. [ ] Test protected route redirects to login when unauthenticated

---

## Environment Variables

```bash
# web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://jfgoonjqdspogbkjpgcb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZ29vbmpxZHNwb2dia2pwZ2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjMyMzksImV4cCI6MjA4MTQ5OTIzOX0.c1Fyh2qprZR5YgrkHygzTiHcgerRLCc7jwpHg48fWQE
```

---

## Validation Gates

```bash
# Navigate to web directory
cd web

# Type checking
npx tsc --noEmit

# Lint
npm run lint

# Build (catches SSR issues)
npm run build

# Development server
npm run dev
```

### Manual Validation Checklist
- [ ] Visit `/login` - should see login form
- [ ] Visit `/` unauthenticated - should redirect to `/login`
- [ ] Login with valid credentials - should redirect to dashboard
- [ ] Dashboard shows user email
- [ ] Logout button clears session and redirects to `/login`
- [ ] Query data from Supabase works for authenticated user

---

## Issue Closure Checklist

- [ ] Email auth provider enabled in Supabase Dashboard
- [ ] User accounts created for Sam, Chris, Sue (admin role)
- [ ] Profile trigger creates entry on signup (verified)
- [ ] RLS policies work with authenticated users (verified)
- [ ] Login flow documented
- [ ] All acceptance criteria met
- [ ] Code builds without errors
- [ ] Ready for PR review

---

## Confidence Score: 9/10

**Rationale:**
- Clear, well-documented implementation path from official Supabase docs
- Database already properly configured (profiles table, trigger, RLS)
- Straightforward auth flow with no complex requirements
- Using latest recommended patterns (`@supabase/ssr` package)
- Example code available in Supabase GitHub repo

**Potential Risks:**
- Email provider needs manual enabling in Supabase Dashboard
- Email templates may need manual update for token_hash format
- User creation is manual (dashboard or invite links)

---

## Appendix: Email Template Update

Update the "Confirm signup" email template in Supabase Dashboard:

**Change from:**
```
{{ .ConfirmationURL }}
```

**Change to:**
```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

This enables server-side token verification instead of client-side redirect.
