/**
 * RNK Patrol - Toggle All Patrols Macro
 * 
 * Quickly start or stop all patrols on the current scene.
 * 
 * Icon suggestion: fas fa-power-off
 * Type: script
 */

// Check if module is ready
if (!game.rnkPatrol?.manager) {
    ui.notifications.warn("RNK Patrol module is not loaded or ready.");
    return;
}

const manager = game.rnkPatrol.manager;
const patrols = manager.getPatrols();

if (patrols.length === 0) {
    ui.notifications.info("No patrols on this scene.");
    return;
}

// Check if any patrols are active
const activePatrols = patrols.filter(p => p.state === 'active');

if (activePatrols.length > 0) {
    // Stop all patrols
    await manager.stopAll();
    ui.notifications.info(`Stopped ${activePatrols.length} patrol(s).`);
} else {
    // Start all patrols
    await manager.startAll();
    ui.notifications.info(`Started ${patrols.length} patrol(s).`);
}
