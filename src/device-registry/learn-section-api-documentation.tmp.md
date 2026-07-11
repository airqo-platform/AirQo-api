# Learn Section — Mobile API Documentation

Base path: `/api/v2/devices/learn` (device-registry service).

This covers the endpoints the **mobile app's Learn tab** calls: catalog fetch, guest
session, progress read/write/sync, and account linking. The backend exposes additional
endpoints (single-lesson fetch, leaderboard, certificates, admin authoring) that the mobile
client does not currently call — out of scope here.

## Auth model

Two auth paths, selected per endpoint below:

- **Guest** — no login required. Identify the device with headers:
  - `X-Device-Id: <uuid-v4>` (required for any guest-scoped call)
  - `X-Guest-Id: <guest_id>` (once a session exists — from `POST /sessions/anonymous`)
- **JWT** — logged-in user. `Authorization: JWT <token>` header. When both a JWT and guest
  headers could apply, the JWT identity wins server-side.

All requests should send `User-Agent` and `Content-Type: application/json` (for
POST/PUT bodies).

---

## 1. GET `/catalog`

Fetches the full course/unit/lesson/quiz content tree. Public — no auth required.

**Query params:** none required. (`catalog_version` may optionally be passed to check
freshness — omit it to always get the latest.)

**Response `200`:**

```json
{
  "success": true,
  "catalog_version": "2026-06-01",
  "stages": [
    { "index": 0, "name": "Curious" },
    { "index": 1, "name": "Aware" },
    { "index": 2, "name": "Observer" },
    { "index": 3, "name": "Champion" },
    { "index": 4, "name": "Defender" }
  ],
  "max_points": 2400,
  "courses": [
    {
      "id": "665f1c...",
      "course_number": 1,
      "title": "Air Quality Basics",
      "plain_title_key": "air_quality_basics",
      "cover_image_url": "https://...",
      "units": [
        {
          "id": "665f1d...",
          "title": "Unit 1",
          "lessons": [
            {
              "id": "665f1e...",
              "title": "Lesson 1",
              "cover_image_url": "https://...",
              "completion_message": "Nice work!",
              "activities": [
                {
                  "id": "665f1f...",
                  "type": "quiz",
                  "order": 1,
                  "payload": {
                    "format": "single_choice",
                    "question": "What does PM2.5 refer to?",
                    "options": ["Option A", "Option B", "Option C"],
                    "correct_index": 1,
                    "correct_feedback": "Correct!",
                    "incorrect_feedback": "Not quite — try reviewing the lesson."
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

`activities[].type` is one of `article | video | image | quiz`; `payload` shape depends on
`type`. For `type: "quiz"`, `payload.format` is one of:

| format | extra payload fields |
|---|---|
| `single_choice` | `options[]`, `correct_index` (int) |
| `multi_choice` | `options[]`, `correct_indices[]` (int[]) |
| `ranking` | `options[]`, `correct_order[]` (int[], the correct order of option indices) |
| `free_text` | none of the above — always graded as correct client-side once non-empty |

**Error `4xx/5xx`:**

```json
{ "success": false, "message": "no published learn catalog available", "errors": { "message": "..." } }
```

---

## 2. POST `/sessions/anonymous`

Creates (or returns the existing) guest session for a device, so an unauthenticated user
can accumulate Learn progress before signing in.

**Headers:** `X-Device-Id` recommended but session identity comes from the body's
`device_id`.

**Request body:**

```json
{
  "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "app_version": "4.2.0",
  "platform": "android",
  "username": "optional display name",
  "event_id": "optional-campaign-or-event-id"
}
```

| field | required | notes |
|---|---|---|
| `device_id` | yes | must be a UUIDv4 |
| `app_version` | no | free text |
| `platform` | no | `android` or `ios` |
| `username` | no | 3–30 chars; letters, numbers, spaces, `_ . -` only |
| `event_id` | no | 1–100 chars; scopes the session to an event (e.g. leaderboard cohort) |

**Response `201`:**

```json
{
  "success": true,
  "guest_id": "guest_abc123",
  "display_name": "optional display name",
  "avatar_icon": "leaf",
  "avatar_image_url": "https://.../avatar.png",
  "username": "optional display name",
  "event_id": "optional-campaign-or-event-id",
  "created_at": "2026-06-01T12:00:00.000Z"
}
```

Persist `guest_id` locally and send it as `X-Guest-Id` on subsequent progress calls.

---

## 3. GET `/progress`

Reads back everything the caller has accumulated — use this to rehydrate local progress
when a user logs in on a new device (their progress is on the server, including anything
merged in via `/progress/link`, see #6).

**Headers:** `Authorization: JWT <token>` for logged-in users; otherwise `X-Device-Id`
(required) and `X-Guest-Id` for guests. JWT wins if both are present — same resolution rule
as `PUT /progress/lessons/:lesson_id` below.

**Response `200`:**

```json
{
  "success": true,
  "learner_type": "user",
  "guest_id": null,
  "total_points": 210,
  "max_points": 2400,
  "completed_lessons": 7,
  "current_stage": { "index": 1, "name": "Aware" },
  "lessons": {
    "665f1e...": {
      "completed": true,
      "stars": 3,
      "points_earned": 30,
      "quiz_score_ratio": 1,
      "furthest_activity_index": 4,
      "free_text_response": null
    }
  }
}
```

Notes:

- `lessons` is an **object keyed by `lesson_id`**, not an array — iterate with
  `Object.entries(lessons)` / `Object.keys(lessons)`.
- `furthest_activity_index`, `completed`, `stars`, and `points_earned` are enough to fully
  rehydrate local per-lesson state; `quiz_score_ratio` is included too. Individual quiz
  answers are not returned (the server doesn't currently store which option was picked —
  see the investigation report for why).
- `free_text_response` is the learner's latest saved free-text answer for that lesson, or
  `null` if the lesson has no free-text activity / none was submitted.
- If nothing has been recorded yet, this returns `200` with `total_points: 0`,
  `completed_lessons: 0`, `current_stage` = the first stage, and `lessons: {}` — not a 404.

**Error `400`:** `X-Device-Id header is required for guest progress` — returned when
neither a JWT nor `X-Device-Id` is present.

---

## 4. PUT `/progress/lessons/:lesson_id`

Reports progress/completion for one lesson — called when a lesson finishes (or, per the
current app, at the end of each lesson with the full quiz attempt list).

**Path params:** `lesson_id` — the lesson's Mongo `_id` (from the catalog response).

**Headers:** same resolution rule as `GET /progress` above.

**Request body:**

```json
{
  "furthest_activity_index": 4,
  "completed": true,
  "quiz_attempts": [
    {
      "activity_id": "665f1f...",
      "format": "single_choice",
      "selected_index": 1,
      "is_correct": true
    }
  ],
  "free_text_response": "Because air pollution affects everyone."
}
```

| field | required | notes |
|---|---|---|
| `furthest_activity_index` | no | non-negative int; furthest step reached in the lesson |
| `completed` | no | boolean |
| `quiz_attempts[]` | no | one entry per graded quiz activity in the lesson |
| `quiz_attempts[].activity_id` | no | **must be the quiz activity's real `_id` from the catalog** for server-side verification to run |
| `quiz_attempts[].format` | no | `single_choice \| multi_choice \| ranking \| free_text` |
| `quiz_attempts[].selected_index` | no | for `single_choice` — the option index the learner picked |
| `quiz_attempts[].selected_indices[]` | no | for `multi_choice` |
| `quiz_attempts[].selected_order[]` | no | for `ranking` |
| `quiz_attempts[].is_correct` | no | client's own grading; the server re-derives this when `activity_id` + a `selected_*` field are both present and valid, otherwise it trusts this value as-is |
| `free_text_response` | no | max 2000 chars; stored per lesson and returned by `GET /progress`. Omit if there's nothing new to save — an omitted value leaves the previously stored response untouched (it isn't cleared). |

`free_text` quiz attempts are always excluded from scoring server-side (matches the app's
local behaviour) — they never count toward `points_earned`, `stars`, or `quiz_score_ratio`.
`free_text_response` is unrelated to `quiz_attempts` scoring — it's the free-form answer text
itself, not a graded attempt, and there's no "better/worse" comparison for it: the latest
non-empty submission is what's kept, independent of the replay-scoring rule below.

**Replay behaviour:** if a lesson is completed more than once, the server keeps the **best
full result** — `stars`, `points_earned`, `quiz_score_ratio`, and the stored `quiz_attempts`
snapshot are only overwritten together, and only when the new attempt scores at least as
well as the stored one. A worse replay leaves the previous best result untouched.
`furthest_activity_index` always takes the max independent of score.

**Response `200`:**

```json
{
  "success": true,
  "lesson_id": "665f1e...",
  "stars": 3,
  "points_earned": 30,
  "total_points": 210,
  "current_stage": { "index": 1, "name": "Aware" },
  "unlock": { "next_lesson_id": "665f20...", "course_complete": false }
}
```

`unlock` is `null` when the lesson wasn't just completed, or when there's no next lesson in
the unit. `points_earned` is `10 × number of correct graded (non-free-text) quiz attempts`
for this lesson.

**Error `4xx/5xx`:**

```json
{ "success": false, "message": "lesson not found", "errors": { "message": "..." } }
```

---

## 5. POST `/progress/sync`

Batch-uploads any progress reports that failed to send while offline (buffered locally by
the app). Same auth as #4.

**Request body:**

```json
{
  "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "updates": [
    {
      "lesson_id": "665f1e...",
      "furthest_activity_index": 4,
      "completed": true,
      "quiz_attempts": [ /* same shape as PUT /progress/lessons/:lesson_id */ ]
    }
  ]
}
```

| field | required | notes |
|---|---|---|
| `device_id` | yes | UUIDv4 |
| `updates[]` | yes, min 1 | each entry uses the same body shape as the PUT above, plus `lesson_id` |
| `updates[].lesson_id` | yes | the lesson's real `_id` |

**Response `200`:**

```json
{
  "success": true,
  "merged_count": 2,
  "total_points": 210,
  "current_stage": { "index": 1, "name": "Aware" }
}
```

Entries whose `lesson_id` doesn't resolve to a real lesson are silently skipped (not
counted in `merged_count`, no error surfaced). Same replay/best-result rule as #4 applies to
each entry.

---

## 6. POST `/progress/link`

Links a guest's accumulated progress to a logged-in account (called right after sign-in, if
a guest session/progress exists on the device). After this call, `GET /progress` with the
same JWT returns the merged total.

**Headers:** `Authorization: JWT <token>` **required** — returns `401` without it.

**Request body:**

```json
{
  "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "guest_id": "guest_abc123"
}
```

**Response `200`:**

```json
{ "success": true, "user_id": "665aa1...", "merged": true }
```

**Error `400`:** guest session not found, or already linked to a different account.
**Error `401`:** missing/invalid JWT.

---

## Typical call order (guest-first flow)

1. `POST /sessions/anonymous` once, on first Learn tab open — cache `guest_id`.
2. `GET /catalog` — cache with a TTL; the app already does this (1 day on wifi, 3 days on mobile).
3. `GET /progress` on app start / after login — rehydrate local state instead of assuming zero.
4. `PUT /progress/lessons/:lesson_id` at the end of each lesson.
5. `POST /progress/sync` on reconnect, to flush anything buffered while offline.
6. `POST /progress/link` once, right after the user signs in, if a guest session existed —
   then re-call `GET /progress` (now under the JWT) to pick up the merged total.
