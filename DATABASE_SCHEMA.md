# ClearMarket 2.0 - Database Schema Documentation

## Schema Version: 1.0

This document provides detailed information about the database schema, including temporary placeholders and future migration plans.

---

## Tables Overview

### `profiles`
**Purpose**: Extended user profile information linked to auth.users  
**Primary Key**: `id` (UUID, references auth.users.id)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | - | Foreign key to auth.users |
| email | text | NO | - | User's email address |
| full_name | text | YES | - | User's full legal name |
| has_signed_terms | boolean | NO | false | Terms acceptance flag |
| terms_signed_at | timestamp | YES | - | When terms were accepted |
| terms_version | text | YES | - | Version of terms signed (e.g., "1.0") |
| is_fieldrep | boolean | NO | false | Field Rep role flag |
| is_vendor_admin | boolean | NO | false | Vendor admin role flag |
| is_vendor_staff | boolean | NO | false | Vendor staff role flag |
| is_admin | boolean | NO | false | Platform admin flag |
| is_moderator | boolean | NO | false | Platform moderator flag |
| is_support | boolean | NO | false | Support staff flag |
| created_at | timestamp | NO | now() | Record creation timestamp |
| updated_at | timestamp | NO | now() | Last update timestamp |

**RLS Policies**: Users can only view and update their own profile.

---

### `rep_profile`
**Purpose**: Extended profile information for Field Representatives  
**Primary Key**: `id` (UUID)  
**Foreign Key**: `user_id` → `profiles.id`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | Foreign key to profiles |
| business_name | text | YES | - | Rep's business/company name |
| bio | text | YES | - | Professional bio |
| certifications | text[] | YES | - | Array of certification names |
| coverage_areas | text[] | YES | - | **⚠️ PLACEHOLDER - See below** |
| systems_used | text[] | YES | - | **⚠️ PLACEHOLDER - See below** |
| created_at | timestamp | NO | now() | Record creation timestamp |
| updated_at | timestamp | NO | now() | Last update timestamp |

#### ⚠️ PLACEHOLDER FIELDS - Scheduled for Migration

**`coverage_areas` (TEMPORARY)**
- **Current**: Simple text array (e.g., `["California", "Nevada"]`)
- **Limitation**: No structured data for pricing, availability, or granular location
- **Future Migration**: Will be replaced with dedicated `coverage_areas` table
- **Planned Schema**:
  ```sql
  CREATE TABLE coverage_areas (
    id uuid PRIMARY KEY,
    rep_id uuid REFERENCES rep_profile(id),
    state text NOT NULL,
    county text,
    rate_per_inspection numeric,
    availability_status text,
    created_at timestamp DEFAULT now()
  );
  ```
- **Action Required**: Do NOT build complex search/matching logic on this field
- **UI Note**: Any UI displaying coverage should be labeled as "Basic coverage placeholder — full coverage builder coming soon"

**`systems_used` (TEMPORARY)**
- **Current**: Simple text array (e.g., `["ISN", "Spectora"]`)
- **Limitation**: No structured metadata about proficiency or certification
- **Future Migration**: May be normalized into dedicated table or standardized enum
- **Action Required**: Keep usage basic; avoid complex filtering logic

**RLS Policies**: 
- Authenticated users can view all rep profiles (for search/discovery)
- Users can only manage their own rep profile

---

### `vendor_profile`
**Purpose**: Extended profile information for Vendor companies  
**Primary Key**: `id` (UUID)  
**Foreign Key**: `user_id` → `profiles.id`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | Foreign key to profiles |
| company_name | text | NO | - | Vendor company name |
| company_description | text | YES | - | Company overview |
| website | text | YES | - | Company website URL |
| regions_covered | text[] | YES | - | Regions/states vendor operates in |
| created_at | timestamp | NO | now() | Record creation timestamp |
| updated_at | timestamp | NO | now() | Last update timestamp |

**RLS Policies**: 
- Authenticated users can view all vendor profiles
- Users can only manage their own vendor profile

---

### `documents`
**Purpose**: Store signed legal documents (NDAs, TOS, contracts)  
**Primary Key**: `id` (UUID)  
**Foreign Key**: `user_id` → `profiles.id`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | Foreign key to profiles |
| document_type | text | NO | - | Type identifier (e.g., "terms_and_nda_v1") |
| title | text | NO | - | Human-readable document title |
| signed_name | text | YES | - | E-signature legal name |
| signature_timestamp | timestamp | YES | - | When document was signed |
| storage_path | text | YES | - | Path to stored PDF/file (future use) |
| metadata | jsonb | YES | {} | Additional document metadata |
| created_at | timestamp | NO | now() | Record creation timestamp |

**Document Type Standards**:
- `terms_and_nda_v1` - Terms of Service + NDA version 1.0
- Future versions will increment: `terms_and_nda_v2`, etc.

**RLS Policies**: Users can only view and create their own documents.

---

### `seeking_coverage_posts`
**Purpose**: Vendor job postings seeking field rep coverage  
**Primary Key**: `id` (UUID)  
**Foreign Key**: `vendor_id` → `profiles.id`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| vendor_id | uuid | NO | - | Foreign key to profiles (vendor) |
| title | text | NO | - | Job posting title |
| description | text | YES | - | Detailed job description |
| location | text | YES | - | Job location |
| inspection_type | text | YES | - | Type of inspection needed |
| systems_required | text[] | YES | - | Required inspection software |
| status | text | NO | 'active' | Post status (active/closed/filled) |
| expires_at | timestamp | YES | - | When posting expires |
| created_at | timestamp | NO | now() | Record creation timestamp |
| updated_at | timestamp | NO | now() | Last update timestamp |

**RLS Policies**: 
- All authenticated users can view active posts
- Vendors can only manage their own posts

---

### `messages`
**Purpose**: User-to-user messaging system  
**Primary Key**: `id` (UUID)  
**Foreign Keys**: `sender_id`, `recipient_id` → `profiles.id`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| sender_id | uuid | NO | - | Foreign key to profiles (sender) |
| recipient_id | uuid | NO | - | Foreign key to profiles (recipient) |
| subject | text | YES | - | Message subject line |
| body | text | NO | - | Message content |
| read | boolean | NO | false | Read status flag |
| created_at | timestamp | NO | now() | Message sent timestamp |

**RLS Policies**: 
- Users can view messages they sent or received
- Users can send messages as themselves
- Recipients can update read status

---

### `user_wallet`
**Purpose**: Credit system for unlocking contact information  
**Primary Key**: `id` (UUID)  
**Foreign Key**: `user_id` → `profiles.id`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | Foreign key to profiles |
| credits | integer | NO | 0 | Current credit balance |
| created_at | timestamp | NO | now() | Record creation timestamp |
| updated_at | timestamp | NO | now() | Last update timestamp |

**RLS Policies**: Users can only view their own wallet.

**Note**: Credit purchase and transaction history features are not yet implemented.

---

## Database Functions

### `handle_new_user()`
**Trigger**: After insert on auth.users  
**Purpose**: Automatically create profile record for new users  
**Security**: DEFINER with search_path set to public

### `handle_new_profile_wallet()`
**Trigger**: After insert on profiles  
**Purpose**: Automatically create wallet record with 0 credits  
**Security**: DEFINER with search_path set to public

### `update_updated_at_column()`
**Trigger**: Before update on tables with updated_at column  
**Purpose**: Automatically update updated_at timestamp  
**Security**: DEFINER with search_path set to public

---

## Migration Roadmap

### Phase 1: Current Implementation ✅
- Basic schema with all core tables
- Simple placeholder fields for coverage and systems
- RLS policies for data protection
- Auto-triggers for profile/wallet creation

### Phase 2: Coverage Areas Normalization (Planned)
- Create dedicated `coverage_areas` table
- Migrate data from `rep_profile.coverage_areas`
- Add pricing, availability, and granular location fields
- Build advanced search/matching logic

### Phase 3: Systems & Certifications (Planned)
- Standardize `systems_used` into enum or reference table
- Create `certifications` table with verification tracking
- Link certifications to document uploads

### Phase 4: Advanced Features (Planned)
- Transaction history table for wallet
- Review/rating system tables
- Notification preferences table
- Admin audit log table

---

## Development Guidelines

1. **Do NOT build complex logic** on `coverage_areas` or `systems_used` placeholder fields
2. **Label UI components** that use placeholder fields as temporary
3. **Keep queries simple** until proper normalization is complete
4. **Use consistent document_type values** when storing signed agreements
5. **Always check RLS policies** when adding new tables or queries

---

## Contact & Questions

For questions about this schema or to propose changes, please consult the project maintainer or reference the CLEARMARKET_README.md file.

**Last Updated**: 2025-11-26  
**Schema Version**: 1.0
