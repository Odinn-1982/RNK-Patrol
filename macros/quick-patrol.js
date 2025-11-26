/**
 * RNK Patrol - Quick Patrol Macro
 * 
 * Creates an instant patrol for the selected token.
 * Select a token first, then run this macro!
 * 
 * Icon suggestion: fas fa-bolt
 * Type: script
 */

// Check for selected token
const token = canvas.tokens.controlled[0];

if (!token) {
    ui.notifications.warn("Please select a token first!");
    return;
}

// Check if module is ready
if (!game.rnkPatrol?.manager) {
    ui.notifications.warn("RNK Patrol module is not loaded or ready.");
    return;
}

// Create a quick blink patrol
const patrol = await game.rnkPatrol.createPatrol({
    name: `${token.name}'s Patrol`,
    tokenId: token.id,
    mode: 'blink',
    blinkPattern: 'random',
    appearDuration: 3,
    disappearDuration: 2,
    effectType: 'fade',
    waypoints: [
        { x: token.x, y: token.y, name: 'Start Position' }
    ]
});

ui.notifications.info(`Created patrol for ${token.name}! Add waypoints by shift-clicking on the canvas.`);

// Open the config for the new patrol
const { PatrolConfigApp } = await import(`/modules/rnk-patrol/src/apps/PatrolConfigApp.js`);
new PatrolConfigApp(patrol.id).render(true);
