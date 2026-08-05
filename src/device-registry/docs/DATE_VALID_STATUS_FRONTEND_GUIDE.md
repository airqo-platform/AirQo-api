# `dateValidStatus`: Frontend Integration Guide

**Audience:** Vertex frontend team (`airqo-frontend/src/vertex`)
**Status:** New, additive, non-breaking field. No existing behavior changes.

## Background

Devices with a broken onboard clock occasionally report timestamps in the
future (e.g. a reading dated 2028 sent in 2026). Historically this caused
`rawOnlineStatus`/`isOnline` to be miscomputed as `true` (a negative
"time since last seen" always satisfied our freshness check). That's now
fixed: a future-dated reading is correctly treated as not-fresh.

That fix intentionally keeps `rawOnlineStatus`/`isOnline` conservative rather
than reverting to a "pure connectivity" signal — every existing consumer
(dashboards, list filters, alerts, calibration eligibility) already assumes
these fields mean "is this device's data current," and changing that meaning
would require auditing every consumer of those two fields. Concretely: when a
newly-received timestamp is rejected, the backend does **not** unconditionally
set `rawOnlineStatus` to `false` — it falls back to whether the device's
*previously-stored* `lastRawData` is still fresh. A device with a healthy
recent history that sends one bad-clock reading will still show
`rawOnlineStatus: true`, because its last known-good data is still within the
freshness window. It only goes `false` once the fallback data itself is
stale or also future-dated — which is what happened in the case that prompted
this fix, since `lastRawData` there was itself the corrupted value.

The gap this leaves: a device with a **bad clock but working connectivity**
now looks identical, in the API, to a device that's **genuinely
unreachable** — both show `rawOnlineStatus: false`. Hardware/field teams
need to tell these apart, since the fix is completely different (reset the
RTC/replace the battery vs. check power/antenna/SIM).

`dateValidStatus` is the new field that carries that distinction, without
touching the meaning of `rawOnlineStatus`/`isOnline` at all.

## The field

Present on both **Device** and **Site** API responses (single-device,
device-list, and site-list endpoints).

```ts
type DateValidStatus = "valid" | "future_timestamp" | "invalid_format" | "unknown";
```

| Value | Meaning |
| --- | --- |
| `"valid"` | The most recently checked raw feed timestamp was not more than 5 minutes in the future. Note this is a **one-sided** check — there's no lower bound here, so an old-but-legitimate timestamp is still `"valid"`; staleness is handled separately by `rawOnlineStatus`'s own 2-hour freshness threshold, not by this field. |
| `"future_timestamp"` | The most recently checked raw feed timestamp was more than 5 minutes ahead of server time — likely a device clock/RTC issue. **This is the "hardware team" case**: the device may well be connected, its clock is just wrong. |
| `"invalid_format"` | The most recently checked raw feed timestamp couldn't be parsed as a date at all. |
| `"unknown"` (default) | No raw feed timestamp has been evaluated yet for this device (new device, no feed data, a successful check whose response simply had no timestamp field, or a check that didn't reach the timestamp evaluation step, e.g. missing API key). Not an error — just "no verdict yet." |

**Important:** this field is diagnostic-only. It never feeds into
`rawOnlineStatus`, `isOnline`, `lastActive`, or `transmissionStatus`. Those
keep behaving exactly as before.

## Where it comes from / rollout timing

Set by the same two backend processes that already compute
`rawOnlineStatus`: the hourly raw-status cron job and the on-demand
per-device check triggered by `GET /devices/:id`. It updates every time
either of those actually evaluates a raw feed timestamp — so:

- Existing devices will show `"unknown"` until the next time they're
  checked (worst case: next hourly cron run).
- It only changes when there's fresh feed data to evaluate — a device with
  no new data keeps its last known `dateValidStatus`, same as
  `rawOnlineStatus` does today.

## Suggested frontend usage

No changes are required to existing status logic — `getDeviceStatus` /
`getSimpleStatus` in `core/utils/status.ts` and every screen that consumes
them (`table-columns.tsx`, `sites-list-table.tsx`,
`client-paginated-sites-table.tsx`, `site-information-card.tsx`,
`online-status-card.tsx`) keep working unmodified.

The suggested addition is a **secondary, non-blocking indicator** layered
on top of the existing status badge — e.g. a small icon/tooltip next to the
existing "Not Transmitting" or "Data Available" label when
`dateValidStatus === "future_timestamp"`, along the lines of:

```ts
// core/utils/status.ts — additive helper, doesn't change getDeviceStatus's
// existing return value or the four-state matrix.
export const getDateValidHint = (
  dateValidStatus?: "valid" | "future_timestamp" | "invalid_format" | "unknown"
): { label: string; description: string } | null => {
  if (dateValidStatus === "future_timestamp") {
    return {
      label: "Clock Error",
      description:
        "Device may be connected, but its reported time is in the future " +
        "(likely a bad onboard clock/RTC). Status below reflects that we " +
        "can't currently trust this device's data as current.",
    };
  }
  if (dateValidStatus === "invalid_format") {
    return {
      label: "Timestamp Error",
      description: "Device sent a timestamp that couldn't be parsed.",
    };
  }
  return null; // "valid" or "unknown" — nothing to surface
};
```

Call sites would pass `device.dateValidStatus` / `site.dateValidStatus`
alongside the existing `getDeviceStatus(...)` call and render the hint next
to (not instead of) the existing badge — e.g. in
`online-status-card.tsx`, next to the `status.label` badge:

```tsx
const dateHint = getDateValidHint(device.dateValidStatus);
// ...
<span>{status.label}</span>
{dateHint && (
  <Tooltip>
    <TooltipTrigger><AlertTriangle className="w-4 h-4 text-purple-600" /></TooltipTrigger>
    <TooltipContent>{dateHint.description}</TooltipContent>
  </Tooltip>
)}
```

This keeps the existing "Operational / Transmitting / Data Available / Not
Transmitting / Invalid Date" behavior completely intact for every existing
screen, and adds the "this might just be a clock, not a connectivity
problem" signal only where you choose to render it.

`RunDeviceTestCard` doesn't need any change — it already does its own live
future-date check directly against the raw ThingSpeak feed, which is a
different (and still useful) signal: "what is the device saying right
now," independent of what's stored on the Device document.

## Non-goals / what this is not

- Not a replacement for `transmissionStatus` or the existing "Invalid Date"
  label logic — those still take priority as before.
- Not a trust signal — nothing should start treating a device as
  "effectively online" because `dateValidStatus === "future_timestamp"`.
  `rawOnlineStatus`/`isOnline` remain the only fields that should drive
  trust-based decisions (filtering "operational" devices, alerts,
  calibration eligibility, etc.).
