# Brand color system

Nirapad Transit visual identity combines the **Shield + wordmark** with **Bangladesh national civic colors** for a public-service product look.

## Official logo

| Item | Detail |
| --- | --- |
| Identified mark | Lucide `Shield` + wordmark **Nirapad Transit** |
| Used in | Sidebar (`AppShell`), landing, login, register (`BrandMark`) |
| Raster/vector files | `frontend/public/logo.svg`, `frontend/public/logo-mark.svg` |
| Light/dark variants | None. Light theme only. |

## National civic palette (current)

Aligned with Bangladesh flag bottle green / national red (Pantone 342 C / 485 C family) plus authority navy from the product lockup.

| Role | HEX | Source |
| --- | --- | --- |
| Primary | `#006747` | National bottle green |
| Primary hover | `#2A9B6A` | Lighter civic green |
| Primary active | `#004530` | Deep green for pressed states |
| Accent | `#2A9B6A` | Shield highlight |
| Secondary | `#0B1F33` | Navy sidebar / authority |
| Secondary hover | `#123049` | Navy hover |
| Deepest navy | `#07111C` | Landing / auth atmosphere |
| Error / SOS | `#DA291C` | National red (danger only) |
| Background | `#F3F6F4` | Soft civic off-white |
| Surface | `#FFFFFF` | Cards / panels |
| Surface secondary | `#E7F0EB` | Soft green-gray |
| Text primary | `#0B1F33` | Navy |
| Text secondary | `#3D5160` | |
| Text muted | `#5B6B76` | |
| Success | `#006747` / `#D8EFE4` | National green family |
| Warning | `#B45309` / `#FEF3C7` | Amber (semantic) |
| Info | `#00553A` / `#D8EFE4` | |

## Before → after (national refresh)

| Token | Previous (logo teal) | Current (national) |
| --- | --- | --- |
| Primary | `#0D9488` | `#006747` |
| Accent | `#2DD4BF` | `#2A9B6A` |
| Error / SOS | `#BE123C` | `#DA291C` |
| Background | `#F4F7F8` | `#F3F6F4` + subtle green/navy wash |

## Typography

- Display: **Fraunces** (`--font-display`) via `next/font`
- Body: **Source Sans 3** (`--font-body`) via `next/font`

## Design tokens

Centralized in `frontend/src/app/globals.css` (`:root`). Tailwind `brand.*` / `ink.*` and `fontFamily` in `frontend/tailwind.config.ts`. Static mirrors: `frontend/src/lib/brand.ts`, `mobile/lib/src/theme.dart`.

## Accessibility

- WCAG-minded contrast on primary buttons (green on white labels)
- Status not color-only (badges keep text labels)
- Focus rings use brand primary

## What was not changed

- Backend, database, auth, RBAC, GPS, route, SOS business logic
- Leaflet/OpenStreetMap provider
- Icon library (Lucide)
- Per-dashboard color themes (all roles share one national brand)
- Dark mode (not present)
