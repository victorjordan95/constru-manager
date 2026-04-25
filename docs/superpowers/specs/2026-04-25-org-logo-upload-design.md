# Organization Logo Upload — Design Spec

**Date:** 2026-04-25  
**Status:** Approved

## Overview

ADMIN users can upload a logo for their organization. The logo is stored on Cloudinary and its URL is saved in the database. The logo appears in the app sidebar (replacing the "Constru Manager" text) and in the PDF quote header.

## Requirements

1. `ADMIN` can upload a logo only for their own organization. `SUPER_ADMIN` can upload for any org.
2. Upload accepts image files up to 2 MB. Cloudinary resizes to max 400px width.
3. Logo URL is stored in `Organization.logoUrl` (nullable).
4. A new `GET /organizations/current` endpoint returns `{ id, name, logoUrl }` for the authenticated user's org.
5. `AppLayout` fetches the org logo once on load and caches it. Shows `<img>` if available, text fallback otherwise.
6. `SUPER_ADMIN` always sees the text fallback (no org of their own).
7. A new `/settings` route (ADMIN only) shows the current logo and an upload form.
8. `generateQuotePDF` accepts an optional `logoUrl` and renders it in the header if provided.

## Backend

### Schema change
```prisma
model Organization {
  // existing fields...
  logoUrl  String?
}
```

### New dependencies
- `multer` + `@types/multer` — multipart/form-data parsing (in-memory storage)
- `cloudinary` — upload SDK

### New env vars
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### `POST /organizations/:id/logo`
- Auth: `ADMIN` (own org only) or `SUPER_ADMIN`
- Body: `multipart/form-data`, field `logo`, image file, max 2 MB
- Handler: parse with multer memoryStorage → upload buffer to Cloudinary with `{ transformation: [{ width: 400, crop: 'limit' }] }` → update `Organization.logoUrl` → return `{ logoUrl }`
- Errors: `FILE_REQUIRED`, `FILE_TOO_LARGE`, `ORG_NOT_FOUND`, `FORBIDDEN`

### `GET /organizations/current`
- Auth: any authenticated non-SUPER_ADMIN user
- Returns: `{ id, name, logoUrl }` for `req.user.organizationId`
- Error: `ORG_NOT_FOUND`

## Frontend

### New files
- `client/src/features/organizations/api.ts` — `uploadOrgLogo(id, file)`, `getCurrentOrganization()`
- `client/src/features/organizations/hooks.ts` — `useCurrentOrganization()`, `useUploadOrgLogo()`
- `client/src/features/organizations/OrganizationSettingsPage.tsx` — logo preview + upload form

### Modified files
- `server/src/prisma/schema.prisma` — add `logoUrl`
- `server/src/features/organizations/organizations.service.ts` — add `getCurrentOrg`, update `updateOrganization` to accept `logoUrl`
- `server/src/features/organizations/organizations.controller.ts` — add handlers
- `server/src/features/organizations/organizations.routes.ts` — add routes
- `client/src/layouts/AppLayout.tsx` — fetch org logo, conditional render
- `client/src/features/quotes/QuotePDF.ts` — accept `logoUrl?`, render in header
- `client/src/features/quotes/QuoteDetailPage.tsx` — pass `logoUrl` to `generateQuotePDF`
- `client/src/router/index.tsx` — add `/settings` route

## Data Flow

```
ADMIN uploads image → POST /organizations/:id/logo
  → multer parses buffer
  → cloudinary.uploader.upload_stream → returns secure_url
  → prisma.organization.update({ logoUrl: secure_url })
  → return { logoUrl }

AppLayout mounts → GET /organizations/current (if not SUPER_ADMIN)
  → useCurrentOrganization() caches result in React Query
  → sidebar renders <img src={logoUrl}> or text fallback

QuoteDetailPage "Download PDF" click
  → generateQuotePDF(quote, orgLogoUrl)
  → fetch image as dataURL → doc.addImage(...)
```

## What This Does NOT Change

- SUPER_ADMIN org management — they still see the full org list; no logo upload UI for them in OrganizationsPage (they could use the existing endpoint directly if needed)
- Existing auth token — no change to JWT payload
- Existing organization CRUD endpoints — unchanged except logoUrl is now included in responses
