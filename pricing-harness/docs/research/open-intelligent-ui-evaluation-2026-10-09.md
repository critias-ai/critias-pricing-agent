# Open Intelligent UI fit for conversational pricing visuals

Date: 2026-10-09. High-level review of upstream `main` and local UI; no installation, integration testing, or paid model calls.

## Recommendation

**Keep Plotly for analytical charts. Consider OpenUI later as the conversation presentation layer, if interactive forms, filters, tables and follow-up actions become a product requirement.** The two solve different problems: Plotly draws analytical figures; OpenUI composes interactive interfaces from an allowed component library.

For the immediate goal of seeing existing charts inside the conversation, embedding an approved report or chart beside its answer is likely a smaller, lower-risk change than adopting a generated-UI protocol. This is an architectural judgment, not a tested implementation estimate.

## What the linked repository provides

`open-intelligent-ui` is a travel demo built using the broader OpenUI framework. It combines custom map, itinerary and image components with the framework's chat/forms. The demo is an example to learn from, not an analytical-chart package or a ready-made pricing interface. Its package is `0.1.1`, with Next.js and React 19 dependencies. [Demo README](https://github.com/thesysdev/open-intelligent-ui), [Package](https://github.com/thesysdev/open-intelligent-ui/blob/main/package.json)

The demo sends conversation messages to Thesys's OpenUI Gateway through the Responses API. It requires `THESYS_API_KEY`, defaults to `openai/gpt-5.5`, and uses the hosted image-search tool. Copying its backend would therefore change the current provider path and add another service dependency. [Chat endpoint](https://github.com/thesysdev/open-intelligent-ui/blob/main/src/app/api/chat/route.ts)

These dependencies belong to this demo's architecture. Official documentation explicitly states that the language and renderer do not depend on a model provider, chat library or hosted service. Keeping the existing Pi/OpenRouter backend is possible in principle, with an adapter and appropriate UI generation instructions; compatibility is untested. [OpenUI overview](https://www.openui.com/docs/openui-lang/overview), [Renderer](https://www.openui.com/docs/openui-lang/renderer)

## Relationship to Plotly and the harness

OpenUI offers built-in charts, forms, tables and layouts. It lets developers define allowed components and their schemas, then render model-generated OpenUI Lang. It could support a pricing-specific answer card with a chart, verified metrics and a "show underperforming SKUs" action. [Framework README](https://github.com/thesysdev/openui)

A custom component could plausibly wrap Plotly or load an approved artifact by ID: the demo already registers application-owned React components with Zod prop schemas. This is an inference from its extension mechanism; no Plotly integration was identified or tested. [Component definitions](https://github.com/thesysdev/open-intelligent-ui/blob/main/src/lib/travel/components.tsx), [Component library](https://github.com/thesysdev/open-intelligent-ui/blob/main/src/lib/library.ts)

Today the harness exposes HTML reports in the Outputs sidebar and a sandboxed preview iframe. Moving those approved artifacts into a chat message does not inherently require model-generated UI. Regardless of renderer, preserve controller-owned checkpoints, numerical/visual verification and downloads. Do not ask a presentation model to invent or recalculate chart values.

## Adoption cautions

Generated UI adds a new output contract and potential parsing/rendering failures. The framework's own reliability documentation acknowledges incomplete generations. Validate artifact references and preserve a usable text/download fallback; UI schema validation does not establish financial correctness. [Reliability](https://www.openui.com/docs/openui-lang/reliability)

The OpenUI framework has an explicit MIT license. The linked demo's root listing has no license file, its package declares no license, and fetching its root `LICENSE` returned 404. Its "open-source" description alone does not establish permission to reuse the demo code; clarify before copying it. [Framework license](https://github.com/thesysdev/openui/blob/main/LICENSE), [Demo root](https://github.com/thesysdev/open-intelligent-ui)

The demo shows four commits and no test script; framework adoption should be evaluated independently. Start with one artifact-backed chart/card and the current model, then test mobile sizing, persistence, follow-up actions and invalid output before broader adoption.
