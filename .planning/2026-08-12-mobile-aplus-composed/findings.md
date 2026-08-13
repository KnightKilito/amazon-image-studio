# Findings

- The current main-content layout model, editor, composed spec builder, and prompt rules are named and partly hard-coded for Premium A+.
- Mobile currently has five fixed independent modules at 600x450 upload and 1200x900 generation.
- Existing slicing, conversion, and exact-size infrastructure already understands Mobile mother images at a 1200x900 per-panel base.
- Planner sessions currently persist only one Premium layout mode/group list, so Mobile needs a separate state without changing Premium when tabs switch.
- Composed planner guidance currently hard-codes `Premium A+` and a 1200px boundary; these must be driven by the content type and generation tier.
- Concurrent Brand Story work is changing overlapping planner/type files; Brand Story must stay outside the generalized main-content builder/editor boundary.
- A single content-type/tier profile can drive upload geometry, generation geometry, slot prefixes, mother-image sizing, and editor labels without duplicating a Mobile tab implementation.
- The common layout-state map provides independent tab behavior while the deprecated Premium fields remain a safe migration bridge for older sessions.
- Continuous prompt boundaries must be derived from actual generation height divided by slice count; this correctly yields 1200px for Premium, 900px for Mobile 2K, and 1800px for Mobile 4K.
