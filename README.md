# RNK Patrol

> Advanced patrol system for FoundryVTT with teleporting guards

![Foundry Version](https://img.shields.io/badge/Foundry-v12--v13-informational)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

RNK Patrol revolutionizes guard and NPC patrol systems in FoundryVTT. Instead of tokens walking predictable paths, guards can **blink** between waypoints—appearing briefly, disappearing, then reappearing at another location. This creates dynamic, unpredictable patrol patterns that keep players on their toes.

## Features

### 🌀 Blink Mode (Teleporting Patrols)
- Guards appear and disappear at waypoints with stunning visual effects
- Multiple blink patterns: Sequential, Random, Weighted, Ping-Pong
- Customizable timing for appear/disappear durations
- Variance options for unpredictable patrol timing

### 🚶 Walk Mode (Traditional Patrols)
- Classic walking patrols for those who prefer the traditional approach
- Smooth token movement between waypoints
- Configurable movement speed

### 🔀 Hybrid Mode
- Mix teleportation and walking within the same patrol
- Per-waypoint configuration for maximum flexibility

### ✨ Visual Effects
- **Fade**: Smooth opacity transitions
- **Flash**: Bright flash on appear/disappear
- **Particles**: Particle burst effects
- **Glitch**: Digital glitch distortion
- **Shadow**: Shadow step effect for stealthy patrols
- **Arcane**: Magical portal effects

### 👁️ Detection System
- Configurable detection radius per waypoint
- Alert states: Idle, Alert, Combat, Investigating
- Actions on detection: Alert, Pause, Pursue, Run Macro
- Integration with other modules via hooks

### 🎛️ Management Tools
- Intuitive Patrol Manager UI
- Drag-and-drop waypoint ordering
- Bulk operations (Start All, Stop All)
- Import/Export patrol configurations
- Token context menu integration

## Installation

### Method 1: Module Browser
1. Open FoundryVTT's Setup screen
2. Go to "Add-on Modules" tab
3. Click "Install Module"
4. Search for "RNK Patrol"
5. Click Install

### Method 2: Manifest URL
1. Open FoundryVTT's Setup screen
2. Go to "Add-on Modules" tab
3. Click "Install Module"
4. Paste the manifest URL:
   ```
   https://github.com/yourusername/rnk-patrol/releases/latest/download/module.json
   ```

## Quick Start

1. **Enable the module** in your world's module settings
2. **Open the Patrol Manager** from the token controls or use the hotkey
3. **Create a new patrol**:
   - Click "Create Patrol"
   - Select a token (guard/NPC)
   - Choose patrol mode (Blink recommended!)
   - Set waypoints by clicking on the canvas
4. **Start the patrol** and watch your guard teleport!

## Configuration

### Module Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enabled | Master toggle | ✓ |
| GM Only | Restrict management to GM | ✓ |
| Default Mode | Default patrol mode | Blink |
| Default Pattern | Default blink pattern | Sequential |
| Appear Duration | Time visible at waypoint | 3s |
| Disappear Duration | Time invisible | 2s |
| Show Waypoints | Display waypoint markers | ✓ |
| Effect Type | Default visual effect | Fade |
| Effect Intensity | Visual effect strength | 0.8 |
| Play Sounds | Audio feedback | ✓ |
| Detection Radius | Default detection range | 3 units |
| Debug Mode | Enable debug tools | ✗ |

### Patrol Modes

#### Blink Mode
Tokens teleport between waypoints:
```
Waypoint A → (disappear) → (invisible) → (appear) → Waypoint B
```

#### Walk Mode
Traditional walking patrols:
```
Waypoint A → (walk) → (walk) → (walk) → Waypoint B
```

#### Hybrid Mode
Mix both modes per waypoint segment.

### Blink Patterns

| Pattern | Description |
|---------|-------------|
| Sequential | Visit waypoints in order (1→2→3→1→...) |
| Random | Random waypoint each blink |
| Weighted | Higher weight = more likely to visit |
| Ping-Pong | Back and forth (1→2→3→2→1→...) |

## API

RNK Patrol exposes a public API for macro and module integration:

```javascript
// Access the API
const patrol = game.modules.get('rnk-patrol').api;

// Get the patrol manager
const manager = patrol.manager;

// Create a patrol programmatically
const newPatrol = await manager.createPatrol({
    name: "Guard Patrol",
    tokenId: "token123",
    mode: "blink",
    waypoints: [
        { x: 1000, y: 1000, appearDuration: 3 },
        { x: 1500, y: 1200, appearDuration: 2 },
        { x: 1200, y: 1500, appearDuration: 4 }
    ]
});

// Start a patrol
await manager.startPatrol(newPatrol.id);

// Stop all patrols
await manager.stopAll();

// Get all active patrols
const activePatrols = manager.getActivePatrols();
```

### Hooks

```javascript
// When a patrol starts
Hooks.on('rnkPatrolStarted', (patrol) => {
    console.log(`${patrol.name} started!`);
});

// When a patrol detects a token
Hooks.on('rnkPatrolDetection', (patrol, detectedTokens) => {
    console.log(`${patrol.name} detected ${detectedTokens.length} tokens!`);
});

// When a token appears at a waypoint
Hooks.on('rnkPatrolAppear', (patrol, waypoint) => {
    console.log(`${patrol.name} appeared at ${waypoint.name}`);
});

// When a token disappears
Hooks.on('rnkPatrolDisappear', (patrol, waypoint) => {
    console.log(`${patrol.name} disappeared from ${waypoint.name}`);
});
```

## Compatibility

- **FoundryVTT**: v12 - v13
- **Game Systems**: System agnostic (works with any game system)
- **Recommended Modules**: 
  - Sequencer (enhanced visual effects)
  - JB2A (additional animations)

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/rnk-patrol/issues)
- **Discord**: Join the FoundryVTT Discord
- **Wiki**: [Documentation Wiki](https://github.com/yourusername/rnk-patrol/wiki)

## License

This module is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Credits

- Developed by RNK Studios
- Inspired by the need for more dynamic guard patrols in TTRPGs
- Built with ❤️ for the FoundryVTT community
