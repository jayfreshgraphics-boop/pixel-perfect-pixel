# Bright Smile Dental Clinic

## User-facing scope
- Replace the placeholder home page with a clear, mobile-friendly clinic website using the requested blue-and-white palette and clinic contact/location/hours.
- Add a public appointment booking page with service selection, the next 30 days of dates, Sunday exclusion, hourly clinic slots, Nigerian phone validation, available-slot refresh, and a confirmation reference.
- Add staff sign-in and a staff appointment dashboard with Today, Upcoming, and Past views, search, counts, status actions, confirmation dialogs, and sign-out.
- Keep demo appointments clearly labeled with fake patient details and protect patient records from anonymous reads.

## Technical approach
- Enable Lovable Cloud, then use its managed database and authentication. Disable public sign-up; staff profiles are stored separately from authentication accounts.
- Create appointments and staff-profile tables, grants, RLS policies, the unique active-slot constraint, and a safe booked-slot lookup. Seed six clearly fake appointments in the schema migration.
- Use server functions for public booking and staff-only reads/updates. Marking a visit complete also attempts the review webhook with server-side secrets and supports retry without duplicating successful sends.
- Keep public and staff pages in separate top-level and authenticated routes; use the project's semantic design tokens and existing UI patterns.
- Add focused tests for clinic hours/slot generation, date availability, and Nigerian phone validation, then verify the public booking flow and staff access where Cloud permits.

## Dependency
- Review webhook delivery needs `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` supplied as Lovable Cloud secrets; the user requested to enter these.
