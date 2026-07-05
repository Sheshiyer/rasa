# monthlymealprep

*A month of meals, planned to your macros and budget, ordered with one tap.*

A thoughtseed product branch. A user answers a few preference questions — via a copy-paste ChatGPT/Claude prompt or in-app — and a multi-agent system builds a **30-day meal-ordering plan** and orders it through the **Swiggy MCP** (Zomato/Instamart/tiffin in later versions), one tap at a time.

## Status
Design-spec stage. No application code yet.

- **Design spec + architecture:** [`docs/superpowers/specs/2026-07-05-monthlymealprep-design.md`](docs/superpowers/specs/2026-07-05-monthlymealprep-design.md)
- **Architecture diagram:** [`docs/architecture/runtime-agent-pipeline.html`](docs/architecture/runtime-agent-pipeline.html)

## The wedge (evidence-backed)
Convenience is the hook, **nutrition/health-adherence** is the value, **budget** is a guardrail, and the defensible core (reserved for v2) is **neutral cross-platform orchestration** — one plan spanning every food source. Beachhead: the metro IT/tech professional. Autonomy: **one-tap-approve per order**, not silent auto-ordering.

## Next steps
1. Cambium Genesis brand-mint (name, positioning, visual system, product-branch proof packet).
2. v1 build: seven agents against the Swiggy adapter; the copy-paste onboarding prompt; INDB nutrition.
