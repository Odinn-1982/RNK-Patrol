# RNK Patrol: Manual Test Runner (Foundry Console)


Run these scripts inside the Foundry Console (F12) as GM to validate adapter behaviors, Midi-QOL logging, undo flows, and auto-resolve.

1) Open the Foundry Console as GM (F12).
2) Load one of the scripts by copying its contents into the console and running it.

Scripts:

- `simulate_pending.js` - Pushes a pending AI suggestion and verifies it's listed in the GM Hub pending actions.
- `simulate_bribe.js` - Simulates a bribe AI suggestion for the given actor & patrol id.
- `simulate_undo_restore.js` - Adds a sample AI log entry and triggers the undo handler to ensure restoration works.
- `test_system_adapters.js` - Run the adapter test for the current system using the selected token.
- `test_all_system_adapters.js` - Iterate through all installed adapters and print results for the selected token.
- `test_auto_resolve.js` - Create a combat with two tokens and run AI auto-resolve.
- `test_midi_logging.js` - Attempt a MidiQOL or system item roll and observe the AI log being enriched.
- `test_undo_multi_action.js` - Simulate a theft that removes both gold and an item, then call the central undo helper to restore both assets.

- GM Hub Tests: The GM Hub includes a built-in 'Tests' tab with quick-run buttons for: `simulatePending`, `simulateBribe`, `simulateUndo`, `adapterTest`, `midiTest`, `autoResolve` (GM only). Use this for quick diagnostics and to run the tests from the Hub UI.

Notes:

- These are manual test scripts designed for convenience. They are not a CI or unit test harness (as Foundry requires a running client).
- For best results, ensure your scene has at least two tokens for combat and one token with attack items for MIDI tests.
