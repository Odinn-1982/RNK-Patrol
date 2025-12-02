# Quick Foundry In-Game Tests for RNK Patrol

How to use:

- Open the Foundry VTT Console (F12) as the GM

- Paste the contents of the script files below and run them to validate behaviors.

List of scripts:

- `simulate_pending.js` - Pushes a pending AI suggestion and verifies it's listed in the GM Hub pending actions

- `simulate_bribe.js` - Simulates a bribe AI suggestion for the given actor and patrol id

- `simulate_undo_restore.js` - Adds a sample AI log entry and triggers the undo handler to ensure restoration works

Note: These are manual-run scripts intended to be pasted into the Foundry console during development; they are not part of a Node-based test harness.

Example usage:

1) Move into the Foundry console and paste `simulate_bribe.js` with a valid actor & patrol id

2) Inspect GM Hub to ensure pending entry is present and approve/undo from the UI

These scripts are intentionally minimal and require the module to be loaded with the user as GM.
