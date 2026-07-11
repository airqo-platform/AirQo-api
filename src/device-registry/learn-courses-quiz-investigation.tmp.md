# Learn → Courses Quiz Flow — Investigation Report

Scope: the reported confusion in **Learn tab → Courses → lesson quiz** on mobile
(`AirQo-frontend/src/mobile`) — answers appearing pre-selected on a new question, and
uncertainty about what "correct" vs "incorrect" is supposed to look like, measured against
the expected UX (user story) shared separately. This is a read-only investigation; no
frontend or backend code was changed.

Note on structure: **section 2 is the expected/target behaviour (user story)**, **section 3
is the actual current behaviour and why it diverges**. They are kept separate deliberately —
don't read section 2 as a claim about what the app does today.

---

## 1. Reported symptom

1. User answers a quiz question → immediately marked right/wrong (feedback shown right away).
2. User taps **Continue** → the next question already shows an option selected, before
   the user has touched anything.
3. General confusion about what the intended behaviour is for a correct vs. incorrect answer.

## 2. Expected behaviour (user story — not a description of current behaviour)

This is the target UX, as specified by the product owner, **not** what the app currently
does — the gap between this and section 3 is the bug:

> The learner gets instant feedback on every answer given. They then proceed to the next
> question, which should be blank/unanswered, and only get instant feedback after they
> select an answer on *that* question. Points are calculated accordingly, per question.

The code is written toward this spec — the single-question mechanics (see below) implement
it correctly in isolation — but, as section 3 shows, the mechanism for resetting between
questions is broken, so the spec is only met for the first question in a run of same-format
questions.

**How each quiz format implements one question's instant-feedback cycle:**

- Tap an option → it highlights (selected state), button reads **"Submit"** / **"Check answers"** / **"Check order"**.
- Tap Submit → `LearnQuizScoringService.grade*()` grades locally, the button becomes **"Continue"**,
  each option is recolored (`revealed: true` in `LearnQuizOptionTile`): correct option → green,
  wrongly-selected option → red, and a feedback banner shows `correctFeedback` / `incorrectFeedback`.
  This grade is appended to `_gradedResults` / `_quizAttempts`, which is what
  `LearnQuizScoringService.computeLessonResult()` later divides into `stars` and
  `pointsEarned` (10 points per correct answer — see `learn_quiz_scoring_service.dart:74-99`).
- Tap Continue → `_advanceActivity()` moves to the next activity, which **per the spec above
  should** render blank/unanswered, ready for a fresh submit that adds its own entry to that
  same tally. **This last step is where the actual behaviour diverges from the spec — see
  section 3.**

Source: `learn/widgets/experience/learn_quiz_single_choice.dart`,
`learn_quiz_multi_choice.dart`, `learn_quiz_ranking.dart`, `learn_quiz_option.dart`.

## 3. Actual current behaviour & root cause — quiz state leaks into the next question

`LearnLessonExperience._buildActivityBody()`
(`learn/widgets/experience/learn_lesson_experience.dart:165-199`) returns the quiz widget
for the current activity **without a `Key`**:

```dart
case LearnActivityType.quiz:
  return LearnQuizActivity(
    quiz: activity.quiz!,
    activityTypeLabel: typeLabel,
    onGraded: _recordQuizGrade,
    onFreeText: (text) => _freeTextResponse = text,
    onContinue: _advanceActivity,
  );
```

`LearnQuizActivity` (`learn_quiz_activity.dart:24-57`) is stateless and just forwards to
`LearnQuizSingleChoiceActivity` / `LearnQuizMultiChoiceActivity` / `LearnQuizRankingActivity`
/ `LearnQuizFreeTextActivity` — also with no `key:` passed anywhere in the chain.

When `_advanceActivity()` calls `setState(() => _activityIndex++)`
(`learn_lesson_experience.dart:84-94`), Flutter re-runs `build()` and diffs the new widget
against the one at the same tree slot. Flutter's `Widget.canUpdate` only checks
`runtimeType == oldWidget.runtimeType && key == oldWidget.key`. Two quiz questions of the
**same format back-to-back** (very common — a lesson is often several single-choice
questions in a row) produce the **same runtimeType** and **no key**, so Flutter treats it
as an update to the existing element and **reuses the previous `State` object** instead of
calling `initState()` again.

Concretely, for two consecutive single-choice questions, `_LearnQuizSingleChoiceActivityState`
(`learn_quiz_single_choice.dart:28-44`) is not recreated, so its fields carry over:

| Field | What it holds | Effect on question N+1 |
|---|---|---|
| `_selected` | index tapped on question N | option at that same index renders as "selected" before the user taps anything → **the "preselected answer"** |
| `_submitted` | `true` (question N was submitted) | `revealed: _submitted` is `true` immediately → options are colored right/wrong and the feedback banner shows **before the user answers question N+1** |
| `_grade` | grade for question N | stale feedback banner briefly shows question N's message on question N+1's screen |

This is the exact bug described: the "get marked right away with the right answer shown"
happens on question N+1 without any input, and the "already preselected answer" is
literally the option the user picked on the *previous* question, reinterpreted against the
new question's options list. The same class of bug exists in `learn_quiz_multi_choice.dart`
(`_selected` is a `Set<int>`) and `learn_quiz_ranking.dart` (`_order` list persists) whenever
two ranking or two multi-choice questions happen to sit next to each other.

### It's worse than a visual glitch — question N+1 never actually gets graded

Because `_submitted` carries over as `true`, two other things happen on question N+1 that
compound the bug, beyond the wrong colors showing up:

- **Options become untappable.** `LearnQuizOptionTile.onTap` is `revealed ? null : onTap`
  (`learn_quiz_option.dart:48`), and `revealed` is bound to the stale `_submitted`. So the
  learner physically cannot select an answer for question N+1 — same for reordering in
  `learn_quiz_ranking.dart:145` (`onReorder` returns early `if (_submitted)`) and typing in
  `learn_quiz_free_text.dart:86` (`enabled: !_submitted`).
- **The button is already wired to "Continue".** `primaryLabel`/`onPrimary` are keyed off
  the same stale `_submitted` flag (e.g. `learn_quiz_single_choice.dart:86-88`), so tapping
  it calls `widget.onContinue` — not `_submit()`.

Net effect: `_submit()` is never called for question N+1, so `widget.onGraded(grade)` never
fires, so `_recordQuizGrade()` never appends an entry to `_gradedResults` / `_quizAttempts`
for it (`learn_lesson_experience.dart:154-163`). Question N+1 is silently **skipped from
scoring entirely** — not marked wrong, just absent. Since
`LearnQuizScoringService.computeLessonResult()` derives `stars` and `pointsEarned` from
`_gradedResults.length` as the denominator (`learn_quiz_scoring_service.dart:74-99`), any
lesson with ≥2 consecutive same-format quiz questions under-counts `totalGraded` and
therefore under-awards points — a learner can never earn credit for a question that gets
skipped this way, even one they would have answered correctly. This directly affects the
points calculation, not just the on-screen feedback.

### Reproduction

1. Open a course with ≥2 consecutive quiz questions of the same format (single-choice is
   most common).
2. Answer question 1, submit, tap Continue.
3. Observe question 2 render with an option already highlighted/marked and the feedback
   banner already visible, before tapping anything; options are non-tappable and the button
   already reads "Continue".
4. Finish the lesson and compare the completion screen's stars/points against what they
   should be if every question had been answered correctly — question 2 (and any further
   same-format run) contributes zero points even on a correct guess, because it was never
   graded.

### Fix direction (not applied — flagged for the frontend owner)

Give the quiz widget returned by `_buildActivityBody()` a key that changes per activity,
e.g. `key: ValueKey(_activityIndex)` on `LearnQuizActivity`, or thread the key down through
`LearnQuizActivity` into each concrete quiz widget. That forces Flutter to dispose the old
State and call `initState()` fresh for every new question, which resets `_selected`,
`_submitted`, and `_grade`. Worth double-checking `LearnArticleActivity` / `LearnVideoActivity`
/ `LearnImageActivity` too — they don't carry meaningful internal state today, but the same
missing-key pattern applies to them.

---

## 4. Secondary findings (device-registry backend) — quiz-attempt data integrity

While tracing how a submitted answer reaches the backend, related gaps turned up in
`src/device-registry`. These don't cause the on-screen bug above, but they mean the backend
can't currently tell *what* a learner answered, only whether the app claims it was correct.

**a) The mobile app never sends the selected answer.**
`QuizAttemptData` (`mobile/lib/src/app/learn/services/learn_sync_service.dart:9-27`) has a
`selectedIndex` field, but `_recordQuizGrade()`
(`learn_lesson_experience.dart:154-163`) never sets it:

```dart
_quizAttempts.add(QuizAttemptData(
  activityId: _current.index.toString(),
  format: _current.quiz!.format.apiKey,
  isCorrect: grade.isCorrect,
));
```

So `selected_index` / `selected_indices` / `selected_order` are never present in the
`PUT /progress/lessons/:lesson_id` body, even though the validator and the model
(`validators/learn.validators.js:121-155`) support all three.

**b) `activity_id` sent by the app isn't the activity's real ID.**
`_current.index` is the quiz's position within the *locally built lesson script*
(`mobile/lib/src/app/learn/services/learn_lesson_experience_service.dart:8-18`, a plain
loop counter), not the `LearnActivity` Mongo `_id`. The backend receives `"0"`, `"1"`, `"2"`, …

**c) Because of (a) and (b), server-side re-grading never runs.**
`gradeQuizAttempts()` (`src/device-registry/utils/learn.util.js:149-183`) is meant to
independently re-check each answer against `LearnActivity.payload` via `isAttemptCorrect()`
(`learn.util.js:97-136`), but it only re-grades attempts where
`attemptHasSubmittedAnswer()` (`learn.util.js:139-145`) is true — which requires
`selected_index`/`selected_indices`/`selected_order` to be present. Even if the app started
sending `selected_index`, the accompanying `activity_id` would still fail
`mongoose.Types.ObjectId.isValid()` (`learn.util.js:158`) and be skipped. **Net effect:
`is_correct` reported by the mobile client is currently trusted as-is for stars, points, and
stage progression** — there is no server-side check in the path the app actually exercises
today. Still blocked on a frontend fix (a) + (b); nothing backend-only can close this gap.

**d) [Fixed 2026-07-09] `free_text_response` was silently dropped; `total_activities`
intentionally stays unhandled.** `total_activities` and `free_text_response` are included in
the mobile PUT body (`learn_sync_service.dart:187-194`) but were not part of
`updateLessonProgress`'s validator and were never read by `upsertLessonProgress`. The
free-text quiz format tells the learner "your response has been saved"
(`learn_quiz_scoring_service.dart:70`), but nothing on the server persisted it — that promise
is now kept: `free_text_response` is validated (max 2000 chars, both on `PUT
/progress/lessons/:lesson_id` and each entry of `POST /progress/sync`), stored per lesson
(latest non-empty submission wins — free text has no "better/worse" so it doesn't participate
in the replay-scoring comparison from finding (e)), and returned by `GET /progress`.
`total_activities` remains deliberately unhandled: nothing server-side needs it (the lesson's
activity count is already derivable from the catalog), so there's no field to add it to —
storing an unused number wasn't judged worth the schema/validator surface.

**e) [Fixed 2026-07-09] Replay scoring bug found while addressing a related read-progress
request.** `LearnProgressModel.upsertLessonProgress` previously kept the max `points_earned`
across replay attempts but left `stars` and `quiz_score_ratio` frozen from the *first*
completion, so a learner who did badly once and then replayed perfectly could end up stored
as e.g. `points_earned: 30, stars: 1` — internally inconsistent. Fixed so a replay only
overwrites the stored result when it scores at least as well, and `stars`, `points_earned`,
`quiz_score_ratio`, and the `quiz_attempts` snapshot always move together. Covered by new
tests in `models/test/ut_learn-progress.model.js`.

## 5. Summary

| # | Finding | Where | Status |
|---|---|---|---|
| 1 | Quiz `State` reused across consecutive same-format questions → preselected option, instant reveal, question becomes untappable and is silently skipped from grading (under-counts stars/points) | mobile: `learn_lesson_experience.dart`, `learn_quiz_*_choice.dart` | **Open — High.** Directly matches the reported bug, also breaks scoring. Requires a frontend fix. |
| 2 | `selected_index`/`selected_indices`/`selected_order` never sent to backend | mobile: `learn_sync_service.dart`, `learn_lesson_experience.dart` | Open — Medium. Frontend fix. |
| 3 | `activity_id` sent is a local index, not the real activity ID | mobile: `learn_lesson_experience_service.dart` | Open — Medium. Frontend fix; same root cause as #2. |
| 4 | Server never re-grades mobile quiz submissions (client `is_correct` fully trusted) | backend: `learn.util.js` (`gradeQuizAttempts`) | Open — Medium/High. Blocked on #2 + #3. |
| 5 | `free_text_response` silently dropped despite the app's "saved" message; `total_activities` deliberately left unhandled (no server-side use) | backend: `validators/learn.validators.js`, `LearnProgress.js`, `learn.util.js` | **Fixed 2026-07-09.** |
| 6 | Replay scoring: `stars`/`quiz_score_ratio` not recalculated on replay while `points_earned` was maxed | backend: `models/LearnProgress.js` | **Fixed 2026-07-09.** |
| 7 | `getCatalog` computed `max_points` but the controller never returned it | backend: `controllers/learn.controller.js` | **Fixed 2026-07-09.** Harmless until now since mobile computes max points locally, but was a genuine contract gap. |

Finding #1 is the one to fix to resolve both the user-visible issue and the points/stars
under-counting it causes — it requires a mobile change and is out of scope for this backend
session. Findings #2–#4 remain open, blocked on that same mobile fix (the backend's
verification path already exists and works — see `gradeQuizAttempts` — it just never
receives valid input from the app today). Findings #5–#7 were backend-only and have been
fixed in this PR, with regression tests added in `models/test/ut_learn-progress.model.js`,
`utils/test/ut_learn.util.js`, and `controllers/test/ut_learn.controller.js` (141 Learn-module
tests passing).
