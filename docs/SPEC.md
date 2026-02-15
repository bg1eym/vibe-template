# SPEC

Goal:

- TBD

Roles:

- guest
- user
- admin

Must-have:

- TBD

Nice-to-have:

- TBD

Non-goals:

- TBD

Data model:
User:

- id
- email
- created_at

Item:

- id
- owner_id
- title
- content
- tags (string[], JSON in DB)
- created_at
- updated_at

Invariants:

- user can only access own data
- destructive actions require confirmation
- validate all inputs

Definition of done:

- matches spec
- tests added
- tests pass
- docs updated if needed
