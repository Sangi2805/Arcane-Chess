## Plan: Coach Ratings + Why Lines

I aligned this plan to your exact decisions:
1. Apply the 9 labels to all move commentary.
2. Show 2-3 Why lines.
3. Show 6 ply per line.
4. Keep existing endpoints (no new API route).

**Steps**
1. Phase 1 - Replace rating taxonomy (blocking phase).
2. In [server/services/evaluationService.js](server/services/evaluationService.js), replace current classification logic so all feedback maps only to: blunder, miss, mistake, inaccuracy, good, excellent, best, great, brilliant.
3. In [server/services/evaluationService.js](server/services/evaluationService.js), unify player and engine move classification under one score-to-rating mapper so legacy labels (Good Move, Engine Threat, etc.) are fully removed.
4. Phase 2 - Generate Why lines (depends on Phase 1).
5. In [server/services/engineService.js](server/services/engineService.js), extend analysis parsing to capture MultiPV output and produce up to 3 continuation lines at 6 ply.
6. In [server/services/evaluationService.js](server/services/evaluationService.js), add whyLines to coach feedback for each rated move, with safe fallbacks when analysis is incomplete.
7. Phase 3 - Keep transport path unchanged (depends on Phase 2).
8. Confirm [server/game/gameManager.js](server/game/gameManager.js#L579) and [server/game/gameManager.js](server/game/gameManager.js#L746) pass the expanded coachFeedback payload through existing moveToken flow.
9. Confirm [server/api/game.js](server/api/game.js#L45) and [server/api/game.js](server/api/game.js#L58) continue serving the same contract with extra fields only.
10. Phase 4 - Coach panel UI (parallel with final backend validation).
11. Add Why button and expandable Why content area in [client/index.html](client/index.html#L481).
12. Extend coach state shape and rendering in [client/app.js](client/app.js#L1045) and [client/app.js](client/app.js#L1908) with whyLines and whyExpanded.
13. Add Why toggle behavior in [client/app.js](client/app.js), scoped so details appear only after clicking Why.
14. Phase 5 - Visual mapping update (depends on Phase 1, parallel with Phase 4).
15. Update rating-to-tone and rating-to-motion mappings in [client/app.js](client/app.js#L1302), [client/app.js](client/app.js#L1321), and [client/app.js](client/app.js#L1349) for all 9 labels.
16. Update badge and motion selectors in [client/styles.css](client/styles.css#L748) and related coach motion sections so all 9 ratings render correctly.
17. Phase 6 - Verification (depends on all phases).
18. Validate each move returns only one of the 9 labels and no legacy terms.
19. Validate Why expands/collapses and shows 2-3 lines of 6 ply.
20. Validate stale moveToken behavior still suppresses outdated coach feedback.

**Relevant files**
- [server/services/evaluationService.js](server/services/evaluationService.js) - classification, explanations, whyLines payload.
- [server/services/engineService.js](server/services/engineService.js) - MultiPV parsing and continuation extraction.
- [server/game/gameManager.js](server/game/gameManager.js) - pending review lifecycle and feedback passthrough.
- [server/api/game.js](server/api/game.js) - existing coach/engine delivery path.
- [client/index.html](client/index.html) - Why button and detail container.
- [client/app.js](client/app.js) - coach state, toggle logic, rendering, tone/motion mapping.
- [client/styles.css](client/styles.css) - badge variants, motion states, Why panel styling.

**Scope boundaries**
- Included: replacing all coach rating labels with the exact 9-label list and adding Why details.
- Excluded: new endpoints, database schema changes, historical re-rating of old games.