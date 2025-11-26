# Changelog

All notable changes to the RNK Patrol module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### Added
- Initial release of RNK Patrol
- **Blink Mode**: Teleporting patrols where guards appear/disappear at waypoints
  - Sequential pattern: Visit waypoints in order (1→2→3→1→...)
  - Random pattern: Random waypoint each blink
  - Weighted pattern: Higher weight = more likely to visit
  - Ping-Pong pattern: Back and forth movement (1→2→3→2→1→...)
- **Walk Mode**: Traditional walking patrols for classic movement
- **Hybrid Mode**: Mix teleportation and walking within the same patrol
- Visual effect system with multiple styles:
  - Fade effect
  - Flash effect
  - Particles effect
  - Glitch effect
  - Shadow step effect
  - Arcane portal effect
- Detection system for patrol tokens:
  - Configurable detection radius
  - Alert states: Idle, Alert, Combat, Investigating
  - Detection actions: None, Alert, Pause, Pursue, Run Macro
- Patrol Manager UI for creating and managing patrols
- Patrol Creator wizard for easy patrol setup
- Patrol Configuration editor for fine-tuning
- Token context menu integration for quick patrol assignment
- Socket-based synchronization for multi-user environments
- Comprehensive settings for customization
- Full localization support (English included)
- API for macro and module integration

### Technical
- Foundry VTT v12 minimum, v13.346 verified
- ES Modules architecture
- PIXI.js-based visual effects
- Scene flag storage for patrol data

## [Unreleased]

### Planned
- Sound effect integration
- Sequencer module support for enhanced effects
- Additional blink patterns
- Patrol groups/squads
- Time-based patrol schedules
- Integration with popular game systems
