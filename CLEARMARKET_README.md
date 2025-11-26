# ClearMarket 2.0 - Setup Guide

## Project Overview

ClearMarket 2.0 is a professional networking platform connecting independent Field Representatives with Vendors in the property inspection industry. Built from scratch with clean architecture and modern best practices.

## What's Been Built

### ✅ Backend Infrastructure (Lovable Cloud)
- **Database Schema**: Complete relational database with the following tables:
  - `profiles` - User profiles with role flags (is_fieldrep, is_vendor_admin, etc.)
  - `rep_profile` - Field Rep extended profile information
  - `vendor_profile` - Vendor company information
  - `documents` - Signed NDAs/TOS and uploaded documents
  - `seeking_coverage_posts` - Vendor job postings
  - `messages` - User-to-user messaging
  - `user_wallet` - Credit system for contact unlocking

- **Row-Level Security (RLS)**: All tables have appropriate RLS policies
- **Triggers**: Automatic profile/wallet creation, updated_at timestamps
- **Authentication**: Email/password auth with auto-confirm enabled for testing

### ✅ Frontend Pages & Features

1. **Landing Page** (`/`)
   - Hero section with role-based CTAs
   - Three feature cards (Find Work, Build Trust, Grow Network)
   - "How ClearMarket Works" section with rep and vendor subsections
   - "Trust Matters" section with quality indicators
   - Fully responsive design

2. **Sign Up** (`/signup?role=rep|vendor`)
   - Email/password registration
   - Full name collection
   - Input validation with Zod
   - Error handling and user feedback

3. **Sign In** (`/signin`)
   - Email/password authentication
   - Automatic redirect if already logged in
   - Redirects to dashboard on success

4. **Role Selection** (`/onboarding/role`)
   - Choose between Field Rep or Vendor
   - Updates profile with selected role
   - Proceeds to Terms acceptance

5. **Terms & NDA** (`/onboarding/terms`)
   - Scrollable terms content
   - Must scroll to bottom before accepting
   - E-signature collection (full legal name)
   - Confirmation checkbox
   - Creates signed document record in database
   - Updates profile with terms acceptance

6. **Dashboard** (`/dashboard`)
   - Role-based dashboard (Rep vs Vendor)
   - Placeholder for future features
   - Sign out functionality
   - Profile status display
   - Automatic onboarding redirect if incomplete

### ✅ Design System

**Dark Mode Professional Theme**:
- **Primary Color**: ClearMarket Orange (`hsl(25 95% 53%)`)
- **Secondary Color**: Trust Teal (`hsl(173 80% 40%)`)
- **Background**: Deep charcoal gradient
- **Cards**: Elevated dark surfaces with subtle shadows
- **Shadows**: Glow effects using primary/secondary colors
- **Typography**: Off-white headings, light grey body text

All colors and styles are defined in `src/index.css` and `tailwind.config.ts` for consistency.

### ✅ Security & Best Practices

- **Input Validation**: Zod schemas for all forms
- **Length Limits**: Email max 255 chars, names max 100 chars
- **RLS Policies**: User data properly protected
- **Auth State Management**: Proper session handling with Supabase
- **Error Handling**: User-friendly error messages
- **Secure Functions**: Database functions use SECURITY DEFINER with search_path set

## Environment Configuration

**No manual configuration needed!** Lovable Cloud automatically provides:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

These are managed automatically by the Lovable Cloud integration.

## Auth Configuration

Authentication is pre-configured with:
- ✅ Email confirmation disabled (auto-confirm for testing)
- ✅ Email/password auth enabled
- ✅ Signup enabled

You can modify auth settings in the Cloud tab if needed.

## User Flow

1. **Landing Page** → User clicks "I'm a Field Rep" or "I'm a Vendor"
2. **Sign Up** → User creates account with email/password
3. **Role Selection** → User confirms their role (Rep or Vendor)
4. **Terms & NDA** → User scrolls through terms, signs with legal name, accepts
5. **Dashboard** → User lands on role-appropriate dashboard

If a user signs in after initial setup, they're automatically redirected to their dashboard. If they haven't completed onboarding (role selection or terms), they're redirected to the appropriate step.

## Database Schema Summary

### Core Tables
- **profiles**: Extended auth.users with role flags and terms acceptance
- **rep_profile**: Business name, coverage areas, systems, certifications
- **vendor_profile**: Company name, description, website, regions
- **documents**: Signed agreements with e-signature and timestamp
- **seeking_coverage_posts**: Vendor job postings with location and requirements
- **messages**: User-to-user communication
- **user_wallet**: Credit balance for unlocking contacts

All tables use UUIDs, have created_at/updated_at timestamps, and proper foreign key relationships.

## Next Steps

The foundation is solid and ready for iteration. Future features to implement:

### For Field Reps:
- Complete profile setup (coverage areas, systems, certifications)
- Browse and search Seeking Coverage posts
- Message vendors
- View and manage reputation/reviews
- Upload certifications

### For Vendors:
- Complete company profile
- Create Seeking Coverage posts
- Search and filter field reps
- Purchase and use credits to unlock rep contacts
- Message field reps
- Rate and review completed work

### Platform Features:
- Advanced search and filtering
- Reputation/review system
- Real-time messaging
- Credit purchase/management system
- Admin moderation tools
- Analytics and reporting

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Lovable Cloud (Supabase)
- **Auth**: Supabase Auth
- **Database**: PostgreSQL with RLS
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **State**: React Query for server state

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn components
│   └── FeatureCard.tsx  # Reusable feature card
├── hooks/
│   ├── useAuth.tsx      # Auth context provider
│   └── use-toast.ts     # Toast notifications
├── lib/
│   ├── auth.ts          # Auth utility functions
│   └── utils.ts         # General utilities
├── pages/
│   ├── Index.tsx        # Landing page
│   ├── SignUp.tsx       # Registration
│   ├── SignIn.tsx       # Login
│   ├── RoleSelection.tsx
│   ├── Terms.tsx        # NDA/TOS
│   ├── Dashboard.tsx    # User dashboard
│   └── NotFound.tsx     # 404 page
├── integrations/
│   └── supabase/        # Auto-generated (DO NOT EDIT)
└── App.tsx              # Main app with routing
```

## Development Notes

- **Auto-confirm is enabled** for faster testing (users don't need to verify email)
- **Lovable Cloud handles deployment** of both frontend and backend changes
- **Database types** are auto-generated in `src/integrations/supabase/types.ts`
- **Never edit** files in `src/integrations/supabase/` - they're auto-maintained

## Credits & Contact

Built with Lovable Cloud for rapid full-stack development. The platform automatically handles:
- Database migrations
- Edge function deployment
- Type generation
- Auth configuration
- Environment variables

No external Supabase account needed - everything is integrated!
