# RNK Patrol - Implementation Summary

## Overview
RNK Patrol is a comprehensive patrol system for Foundry VTT with teleporting guards, capture mechanics, and full GM control.

## Core Systems

### 1. Patrol System
- **Modes**: Blink (teleport), Walk (traditional), Hybrid
- **Patterns**: Sequential, Random, Weighted, Ping-Pong, Priority
- **Effects**: Fade, Flash, Particles, Glitch, Shadow Step, Arcane Portal

### 2. Capture System (`CaptureSystem.js`)
Six possible outcomes when a patrol catches a player:
- **Combat** (default 30%) - Guard attacks the player
- **Theft & Release** (default 25%) - Guard steals gold/items and releases
- **Blindfold & Relocate** (default 20%) - Player blindfolded and moved to random location
- **Disregard** (default 15%) - Guard lets player go with a warning  
- **Jail** (default 10%) - Player sent to a jail scene

**Bribery System**: Players can attempt to bribe guards with configurable success rates:
- 70% normal success
- 20% generous (returns some gold)
- 10% double-cross (takes gold AND arrests)

**Dynamic Scaling**: Guard difficulty scales based on:
- Player level (from actor.system.details.level)
- Party average level (if players share partyId flag)
- Configurable guard templates with per-level stat scaling

### 3. Bark System (`BarkSystem.js`)
Context-appropriate voice clips for patrol actions:
- Spawn/Despawn barks
- Capture barks
- Disregard barks
- Theft barks
- Bribery accept/reject/double-cross barks
- Alert/Investigate/All-clear barks

Features floating text display and audio playback with cooldown.

### 4. Telegraph System (`TelegraphSystem.js`)
Visual warning effects 1-2 seconds before patrol spawns:
- Ripple Effect
- Spinning Runes
- Pulsing Glow
- Portal Opening

Uses PIXI.js for rendering, optional JB2A integration.

### 5. Jail System (`JailSystem.js`)
Jail scenes with dynamic guard spawning:
- **jail_1**: Castle dungeon with multiple cells (bundled map + JSON)

Features:
- Auto-create jail scenes from bundled JSON exports
- **Placeholder system**: JSON contains placeholder tokens for visual reference
- **Dynamic guard spawning**: Guards spawn at placeholder positions when first capture occurs
- **Scaled guards**: HP, AC, damage scale based on captured player/party level
- **Guard templates**: `default-guard` and `elite-guard` with configurable stats
- Track prisoners across scenes
- Configurable jail duration
- Escape attempt mechanics with DC
- **Reset jail**: GM can reset guards to respawn on next capture

Guard Template Stats:
```javascript
default-guard: {
    baseLevel: 1, baseHp: 30, hpPerLevel: 6,
    baseAc: 12, acPerLevel: 0.5,
    baseDamage: 6, damagePerLevel: 1
}
elite-guard: {
    baseLevel: 3, baseHp: 45, hpPerLevel: 8,
    baseAc: 14, acPerLevel: 0.5,
    baseDamage: 8, damagePerLevel: 1.5
}
```

## GM Hub
Central command center accessible via Hotbar slot 5:
- **Patrols Tab**: View/manage all patrols, start/stop/pause controls
- **Quick Setup Tab**: Click tokens to create patrols instantly
- **Capture Tab**: Configure outcome weights and bribery settings
- **Barks Tab**: Enable/disable audio, set volume, custom paths
- **Telegraph Tab**: Visual style, duration, color settings
- **Jails Tab**: Create jails from templates, manage prisoners, reset guards
- **Activity Tab**: Recent patrol activity log
- **Settings Tab**: Import/Export, module configuration

## File Structure
```
RNK Patrol/
├── module.json
├── lang/
│   └── en.json
├── assets/
│   └── maps/
│       └── jails/
│           ├── Jail 1.jpg (background image)
│           └── fvtt-Scene-jail-1-*.json (scene export with placeholders)
├── src/
│   ├── main.js (entry point, API)
│   ├── settings.js
│   ├── Patrol.js
│   ├── Waypoint.js
│   ├── PatrolManager.js
│   ├── PatrolEffects.js
│   ├── PatrolDetection.js
│   ├── PatrolSocket.js
│   ├── CaptureSystem.js
│   ├── BarkSystem.js
│   ├── TelegraphSystem.js
│   ├── JailSystem.js
│   └── apps/
│       ├── GMHubApp.js
│       ├── PatrolCreatorApp.js
│       ├── PatrolConfigApp.js
│       ├── PatrolManagerApp.js
│       └── PatrolAssignmentApp.js
├── templates/
│   ├── gm-hub.hbs
│   ├── patrol-creator.hbs
│   ├── patrol-config.hbs
│   ├── patrol-manager.hbs
│   └── patrol-assignment.hbs
├── styles/
│   ├── patrol.css
│   └── gm-hub.css
└── assets/
    └── audio/
        └── barks/
            └── README.md
```

## API Access
```javascript
// Global API
game.rnkPatrol.createPatrol(config)
game.rnkPatrol.getPatrols()
game.rnkPatrol.startAll()
game.rnkPatrol.stopAll()
game.rnkPatrol.openHub()

// Systems
game.rnkPatrol.captureSystem
game.rnkPatrol.barkSystem
game.rnkPatrol.telegraphSystem
game.rnkPatrol.jailSystem

// Manager
game.rnkPatrol.manager
```

## Settings Registered
All settings configurable via Foundry settings menu or GM Hub:
- Module enable/disable
- Patrol defaults (mode, timing, effects)
- Capture system settings
- Bark audio settings
- Telegraph visual settings
- Jail system settings
