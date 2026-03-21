# Knowledge Engine

This folder stores the structured knowledge layer for the resume analyzer.

It is split into four parts:

- `methodology.ts`: stable principles and product-level guardrails
- `routes.ts`: route pool and route definitions
- `scenes.ts`: user background mapping and scene-level defaults
- `faqs.ts`: objection handling and explanation snippets
- `cases.ts`: scenario cases, creator references, and execution archetypes
- `case-filters.ts`: case selection and scoring rules
- `case-schema.ts`: case detail structure and CMS-ready schema

The runtime adapter that turns these definitions into model context lives in
[`../knowledge-engine.ts`](../knowledge-engine.ts).
