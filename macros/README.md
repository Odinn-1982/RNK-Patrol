# RNK Patrol Macros

Ready-to-use macros for quick patrol management. Import these into your Foundry VTT world!

## Available Macros

### 🛰️ Open GM Hub
**File:** `open-gm-hub.js`
**Icon:** `fas fa-satellite-dish`

Opens the Patrol Command Center - your central hub for managing all patrols.

---

### ⚡ Quick Patrol
**File:** `quick-patrol.js`  
**Icon:** `fas fa-bolt`

Select a token and run this macro to instantly create a blink patrol for it. Opens the configuration dialog to add waypoints.

---

### 🔌 Toggle All Patrols
**File:** `toggle-all-patrols.js`
**Icon:** `fas fa-power-off`

Quickly start or stop all patrols on the current scene. If any patrols are active, stops them all. If none are active, starts them all.

---

## How to Import

1. Open Foundry VTT
2. Go to **Macro Directory** (📜 icon in sidebar)
3. Click **Create Macro**
4. Set the name and icon
5. Set **Type** to `script`
6. Copy/paste the macro code
7. Save!

Tip: Drag macros to your hotbar for quick access!

## API Examples

You can also use the patrol API directly in your own macros:

```javascript
// Get the patrol manager
const manager = game.rnkPatrol.manager;

// Get all patrols
const patrols = manager.getPatrols();

// Create a new patrol
const patrol = await game.rnkPatrol.createPatrol({
    name: "Guard Patrol",
    tokenId: "token123",
    mode: "blink",
    blinkPattern: "random"
});

// Start a specific patrol
await patrol.start();

// Stop all patrols
await manager.stopAll();

// Open the GM Hub
game.rnkPatrol.openHub();
```
