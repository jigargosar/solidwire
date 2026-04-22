# MockBench: View Driven Development (VDD)

MockBench is a wireframing tool with a sketchy hand-drawn aesthetic. It is a document of intent, not a visual asset.

## Philosophical Mandates
- **As fast as a pencil**: Speed of thought is prioritized over precision.
- **Thinking tool, not production tool**: Constraints are deliberate to prevent premature visual discussions.
- **Progressive Disclosure**: The interface stays small; depth reveals itself only when needed.
- **Ship less, reveal gradually**: Never let the interface outgrow the idea.

## Architecture & Conventions (Target)
- **VDD (View Driven Development)**: Components should have dual variants:
    - `*Full`: Interactive canvas version.
    - `*Mini`: Simplified sidebar preview.
- **SVG Primacy**: Canvas widgets should be SVG-based.
- **Aesthetics**: Use `roughjs` and `font-kalam` for a hand-drawn look.
