# Project Requirements Plan: Next.js + Supabase Migration

## Project Overview

Migrate the art print inventory management system from Python CLI + PostgreSQL to a modern web application using Next.js and Supabase.

### Business Context
- **What:** Inventory management system for fine art print editions
- **Who:** Artist couple managing their print business
- **Purpose:** Track prints as they move between home and galleries, monitor sales, and manage commissions

### Current State
- Python-based CLI application with SQLAlchemy ORM
- PostgreSQL database (local)
- ~44 print designs, 23 distributors, 7,879 edition records
- Data imported from Airtable CSV exports

### Target State
- Modern web application accessible from any device
- Supabase for authentication and hosted PostgreSQL
- Next.js frontend deployed on Vercel
- Single source of truth (no more Airtable dependency after migration)

---

## Users & Access

### Primary Users
| User | Role | Access |
|------|------|--------|
| Mum | Admin | Full access to all features |
| Dad | Admin | Full access to all features |

### Authentication
- Email + password login via Supabase Auth
- Simple auth flow - no complex SSO needed
- Password reset via email

### Future Consideration
- Gallery/distributor access (view/edit their own inventory only)
- Will require Row Level Security policies when implemented
- Database schema designed to support this without changes

---

## Data Model

### Tables

#### `profiles`
Extends Supabase auth.users with application-specific data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK, FK → auth.users) | User ID from Supabase Auth |
| email | text | User email |
| full_name | text | Display name |
| role | text | 'admin' (future: 'gallery') |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

#### `prints`
Master catalog of artwork designs.

| Column | Type | Description |
|--------|------|-------------|
| id | serial (PK) | Primary key |
| name | text (unique) | Artwork name |
| description | text | Design description |
| total_editions | integer | Total edition count |
| image_urls | text[] | Array of image URLs |
| web_link | text | External reference |
| notes | text | Additional notes |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

#### `distributors`
Galleries and locations that hold inventory.

| Column | Type | Description |
|--------|------|-------------|
| id | serial (PK) | Primary key |
| name | text (unique) | Gallery/location name |
| commission_percentage | decimal(5,2) | 0% (Direct) to 50% |
| contact_number | text | Phone contact |
| web_address | text | Website |
| notes | text | Additional notes |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

#### `editions`
Individual physical prints (main inventory table).

| Column | Type | Description |
|--------|------|-------------|
| id | serial (PK) | Primary key |
| print_id | integer (FK → prints) | Parent artwork |
| distributor_id | integer (FK → distributors) | Current location (nullable) |
| edition_number | integer | Edition number (e.g., 87 of 350) |
| edition_display_name | text | Full display name |
| size | text | 'Small', 'Large', 'Extra Large' |
| frame_type | text | 'Framed', 'Tube only', 'Mounted' |
| variation | text | Optional variation detail |
| is_printed | boolean | Has been physically printed |
| is_sold | boolean | Has been sold |
| is_settled | boolean | Payment received |
| retail_price | decimal(10,2) | Sale price in GBP |
| date_sold | date | Sale date |
| date_in_gallery | date | When placed in gallery |
| notes | text | Additional notes |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

**Constraints:**
- Unique: (print_id, edition_number)
- Check: size IN ('Small', 'Large', 'Extra Large')
- Check: frame_type IN ('Framed', 'Tube only', 'Mounted')

### Relationships
```
prints (1) ──────→ (many) editions
distributors (1) ──→ (many) editions
```

### Calculated Fields (computed on-demand, not stored)
- Commission amount = retail_price × commission_percentage / 100
- Net revenue = retail_price × (1 - commission_percentage / 100)
- Days in gallery = date_sold - date_in_gallery

---

## Features

### Priority 1: Inventory Management (Core)

#### Editions List View
- **Paginated table** of all editions
- **Search** by print name, edition number
- **Filters:**
  - Print (dropdown)
  - Distributor/location (dropdown)
  - Status: All / Printed / Unprinted
  - Status: All / Sold / Available
  - Status: All / Settled / Unsettled
  - Size (dropdown)
  - Frame type (dropdown)
- **Columns:** Print name, Edition #, Location, Size, Frame, Status badges, Price
- **Row actions:** View, Edit, Quick status toggle
- **Bulk actions:** Move to location, Mark as printed, Mark as sold

#### Edition Detail/Edit
- View all edition fields
- Edit: location, status flags, price, dates, notes
- Show parent print info
- Show distributor commission info

### Priority 2: Dashboard

#### Overview Stats
- Total editions (printed / unprinted)
- Total sold / available
- Unsettled payments count & value
- Editions by location (pie/bar chart)

#### Quick Actions
- Recent sales
- Low stock alerts (prints with few available editions)

### Priority 3: Reference Data

#### Prints List
- Table of all artwork designs
- Columns: Name, Total editions, Printed count, Sold count, Available
- Click to view all editions for that print

#### Distributors List
- Table of galleries/locations
- Columns: Name, Commission %, Current inventory count, Total sales
- Click to view all editions at that location

### Priority 4: Sales & Settlements

#### Sales Recording
- Quick "Mark as sold" flow
- Set price, date sold
- Auto-capture commission rate from distributor

#### Settlement Tracking
- Filter unsettled sales by distributor
- Bulk mark as settled
- Payment notes

### Future Features (Not in Scope)
- Gallery self-service portal
- Reporting & analytics dashboards
- Print/edition creation workflow
- Image upload and management

---

## Technical Architecture

### Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Language | TypeScript |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Hosting | Vercel |

### Project Structure
```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── editions/
│   │   │   │   ├── page.tsx          # Editions list
│   │   │   │   └── [id]/page.tsx     # Edition detail
│   │   │   ├── prints/
│   │   │   │   ├── page.tsx          # Prints list
│   │   │   │   └── [id]/page.tsx     # Print detail
│   │   │   ├── distributors/
│   │   │   │   ├── page.tsx          # Distributors list
│   │   │   │   └── [id]/page.tsx     # Distributor detail
│   │   │   └── layout.tsx            # Dashboard layout with nav
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn components
│   │   ├── editions/                 # Edition-specific components
│   │   ├── prints/                   # Print-specific components
│   │   ├── distributors/             # Distributor-specific components
│   │   └── layout/                   # Nav, sidebar, etc.
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client
│   │   │   ├── server.ts             # Server client
│   │   │   └── middleware.ts         # Auth middleware
│   │   ├── types/
│   │   │   └── database.ts           # Generated types from Supabase
│   │   └── utils.ts                  # Helpers
│   └── hooks/                        # Custom React hooks
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Database schema
├── scripts/
│   └── import-csv.py                 # Data migration script
├── public/
├── .env.local.example
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

### Authentication Flow
1. User visits app → redirected to /login if not authenticated
2. User enters email + password
3. Supabase validates credentials
4. Session stored in cookies (httpOnly)
5. Middleware checks session on each request
6. User redirected to dashboard on success

### Data Flow
```
Browser → Next.js Server Component → Supabase Client → PostgreSQL
                    ↓
              Server Action (mutations)
                    ↓
              Revalidate cache
```

### Security
- Row Level Security (RLS) enabled on all tables
- Initial policy: Authenticated users can read/write all data
- Future: Gallery users filtered to their distributor_id only
- No sensitive data exposed to client

---

## Data Migration

### Approach
Adapt existing Python import script to write directly to Supabase.

### Steps
1. Export current PostgreSQL data OR use existing CSV files
2. Update Python script to use Supabase Python client
3. Run migration script once
4. Verify data integrity
5. Supabase becomes single source of truth

### Migration Script Requirements
- Connect to Supabase using service role key
- Import prints first (no dependencies)
- Import distributors second (no dependencies)
- Import editions last (depends on prints + distributors)
- Map old IDs to new Supabase IDs
- Handle duplicates gracefully
- Report success/failure counts

---

## Deployment

### Supabase Setup (Manual)
1. Create Supabase project at supabase.com
2. Run SQL migrations in SQL Editor
3. Enable Email auth provider
4. Create initial admin users
5. Note project URL and keys

### Vercel Setup
1. Connect GitHub repository
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
3. Deploy

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Never expose to client
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Create Next.js project with TypeScript + Tailwind
- [ ] Install and configure shadcn/ui
- [ ] Set up Supabase client (browser + server)
- [ ] Create database migrations SQL
- [ ] Implement auth (login, logout, middleware)
- [ ] Create basic layout with navigation

### Phase 2: Core Inventory (MVP)
- [ ] Editions list page with table
- [ ] Edition detail/edit page
- [ ] Search and filter functionality
- [ ] Status toggle actions (printed, sold, settled)
- [ ] Move edition to different location

### Phase 3: Reference Data
- [ ] Prints list page
- [ ] Print detail page (shows editions)
- [ ] Distributors list page
- [ ] Distributor detail page (shows editions)

### Phase 4: Dashboard
- [ ] Stats cards (totals, counts)
- [ ] Recent activity
- [ ] Quick actions

### Phase 5: Data Migration
- [ ] Adapt Python import script for Supabase
- [ ] Run migration
- [ ] Verify data

### Phase 6: Polish & Deploy
- [ ] Mobile responsive testing
- [ ] Error handling
- [ ] Loading states
- [ ] Deploy to Vercel

---

## Success Criteria

1. **Functional:** Mum and dad can log in and manage inventory
2. **Usable:** Intuitive UI, works on desktop and tablet
3. **Reliable:** Data is safe in Supabase, no data loss
4. **Maintainable:** Clean code, easy to add features later
5. **Performant:** Pages load quickly, table handles 8,000 rows

---

## Open Questions / Decisions

| Question | Decision |
|----------|----------|
| Keep airtable_id fields? | No - clean break, Supabase is source of truth |
| Sync logging? | No - not needed for single source of truth |
| Image hosting? | Keep existing URLs, no upload feature for now |
| Soft delete? | No - hard delete for simplicity |

---

## Appendix: UI Wireframes

### Editions List (Main View)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Art Print Inventory          [User Menu ▼]          │
├─────────────────────────────────────────────────────────────┤
│ Dashboard │ Editions │ Prints │ Distributors               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Editions                                    [+ Add New]    │
│                                                             │
│  [Search...        ] [Print ▼] [Location ▼] [Status ▼]     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ □ │ Print      │ #   │ Location  │ Size │ Status   │   │
│  ├───┼────────────┼─────┼───────────┼──────┼──────────┤   │
│  │ □ │ Lymington  │ 42  │ Gallery A │ Lrg  │ 🟢 Avail │   │
│  │ □ │ Lymington  │ 43  │ Direct    │ Sm   │ 🔴 Sold  │   │
│  │ □ │ No Man's.. │ 1   │ Gallery B │ XL   │ 🟢 Avail │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [◀ Prev]  Page 1 of 158  [Next ▶]      Showing 50 of 7879 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Edition Detail
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Editions                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Lymington - Edition 42                          [Edit]     │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐│
│  │                      │  │ Print:     Lymington         ││
│  │    [Print Image]     │  │ Edition:   42 of 350         ││
│  │                      │  │ Size:      Large             ││
│  │                      │  │ Frame:     Framed            ││
│  └──────────────────────┘  │ Location:  Gallery A         ││
│                            │ Commission: 45%              ││
│                            ├──────────────────────────────┤│
│                            │ Status                       ││
│                            │ [x] Printed  [ ] Sold        ││
│                            │ [ ] Settled                  ││
│                            ├──────────────────────────────┤│
│                            │ Price:     £150.00           ││
│                            │ Date Sold: -                 ││
│                            └──────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
