# RNK Patrol System Adapters

This folder contains adapters for multiple Foundry VTT systems to provide a uniform interface for AI decisions, combat estimations, and action execution.

Currently supported adapters:

- `dnd5e` — Full D&D 5E support

- `pf2e` — Full Pathfinder 2E support

- `pf1` — Pathfinder 1E best-effort

- `starfinder` / `sfrpg` — Starfinder best-effort

- `swade` — Savage Worlds Adventure Edition best-effort

- `blades-in-the-dark` — Blades in the Dark best-effort

- `call-of-cthulhu` / `cof` — Call of Cthulhu best-effort

- `cyberpunk-2020` / `cyberpunk` — Cyberpunk 2020 best-effort

- `dsa5` — The Dark Eye (DSA5) best-effort

- `forbidden-lands` — Forbidden Lands best-effort

- `simple-world-building` — Simple World Building best-effort

- `unhallowed-metropolis` — Unhallowed Metropolis best-effort

Adapters expose the following methods (via `BaseAdapter`):

- `getActorHp(actorOrToken)` - returns current HP or HP-related value

- `getActorMaxHp(actorOrToken)` - returns max HP

- `setActorHp(actor, value)` - sets (updates) HP for the actor

- `getActorAc(actor)` - returns actor AC or defensive stat if available

- `getAttackItems(actor)` - returns candidate attack-capable items associated to the actor

- `estimateBestAttackForToken(token)` - returns { avgDamage, attackBonus, weapon }

- `rollItemUse(item, attacker, targets)` - performs item use via MidiQOL or system roll

- `isPlayerActor(actor)` - boolean

- `tokenHideRemove(token, options)` - hide or remove a token; returns undo payload

How to add a new adapter:

1) Create a new adapter file implementing the BaseAdapter class and override fields where system differs.

2) Add alias keys to `index.js` mapping.

3) Add tests in `tests/foundry-tests` to validate adapter behavior on a sample server install.

Notes:

- These adapters are best-effort and may require system-specific adjustments for advanced features like weapon traits, critical damage, or nested object paths.

- If you maintain a server with multiple systems, consider improving the specific adapter to match the system version and item structures for fidelity.
 
