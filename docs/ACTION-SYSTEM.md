# MotionHive — Action System (implementation reference)

Source: Claude Design "MotionHive — Action System.html" (answers `docs/UI-ACTIONS-AUDIT.md`).
This is the **migration bible**: pick the **role the action plays in the view**, the style follows.

## Foundation (already applied in `core/styles.primeng.ts`)
- One radius: **8px** soft-rect on every button.
- Compact size scale: default ≈36px, `sm` ≈30px, `lg` ≈44px. Label weight 600.

## The 7 roles → PrimeNG `p-button`

| Role | `p-button` attributes | Use for (labels) |
|---|---|---|
| **Primary CTA** | _default_ — **no `severity`**, no variant (solid honey) | Save · Create · Send · Continue · Submit · Book · Join · Invite · Publish · the one main action of the view |
| **Secondary** | `severity="secondary" outlined` | Edit · Manage · Change · neutral alternative beside a primary |
| **Quiet** | `severity="secondary" text` | **Cancel · Dismiss · Back · Close · Skip · Not now** |
| **Confirm** | `severity="success"` (solid) | Approve · Accept · Mark complete · Publish (confirming something good) |
| **Destructive** | `severity="danger" text` at rest → **solid `severity="danger"`** as the confirm button in a destructive dialog | Delete · Remove · Log out · Leave group · Block · Revoke · Cancel subscription |
| **Negative** | `severity="danger" outlined` | Reject · Decline · Deny · Cancel request |
| **Link** | `link` on `p-button`, or `<a routerLink>` | View profile · See all · Discover more · Learn more (navigates) |

## Retire (remap by role)
- `severity="warn"` → **gone.** Reject/decline-type → **Negative** (`danger outlined`); anything else → Secondary, or Primary if it's the main CTA.
- `severity="info"` on buttons → **gone.** → Secondary (or Primary if it's the CTA, e.g. Reload/Retry → Secondary).
- `severity="contrast"` → **gone.** Cancel → **Quiet**; a real CTA (e.g. Login) → **Primary**; neutral (Share/Copy link/Add manually) → **Secondary**.

## Dialog-footer rule (Phase 1)
Every `<p-dialog>` / modal footer is **one shape**:
- **Quiet** Cancel/Close on the left (`severity="secondary" text`).
- **Primary** confirm on the right (default), OR — for a destructive confirm — **solid** `severity="danger"` (NOT text) labelled with the destructive verb (Delete, Leave, Remove…).
- Confirm of "something good" (Approve/Accept) uses **Confirm** (`severity="success"`).

## Scope guardrails (do NOT change in this pass)
- **`p-tag`** severities — those are status tags, not actions. Only touch `p-button` / `pButton`.
- **Dynamic status `[severity]="expr"`** (e.g. policy/payment-status driven) — leave it; it's data-driven, not a fixed role.
- **`size`** attributes — leave as-is (size is preset-level now; a separate pass).
- **`[rounded]` icon buttons** — leave the rounded shape for now (separate visual pass); only fix their role tint if clearly wrong.
- Keep all `[loading]`, `[disabled]`, `icon`, `iconPos`, `(onClick)`, `routerLink`, `fluid`, `ariaLabel` exactly as they are — only change `severity` + variant (`outlined`/`text`) per the role.
- Match the file's existing attribute style (bare `outlined` vs `[outlined]="true"`).

## Notes
- "Edit" in a dense table row is better as a **quiet icon button** (✎) than a labelled Secondary — but don't restructure rows in this pass; just set the role.
- When genuinely unsure of a button's role, prefer **Secondary** (outlined) over guessing, and leave a `<!-- TODO action-system: role? -->` note.
