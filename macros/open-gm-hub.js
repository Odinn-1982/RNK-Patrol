/**
 * RNK Patrol - GM Hub Macro
 * 
 * Drag this to your macro bar for quick access to the Patrol Command Center!
 * 
 * Icon suggestion: fas fa-satellite-dish
 * Type: script
 */

// Open the GM Hub
if (game.rnkPatrol?.openHub) {
    game.rnkPatrol.openHub();
} else {
    ui.notifications.warn("RNK Patrol module is not loaded or ready.");
}
