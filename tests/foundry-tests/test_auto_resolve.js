// Test auto-resolve combat using AIService
(async () => {
    if (!game.user.isGM) return ui.notifications.warn('Only GM can run this test')
    const tokens = canvas.tokens.controlled.length ? canvas.tokens.controlled : canvas.tokens.placeables.slice(0, 2)
    if (tokens.length < 2) return ui.notifications.warn('Need at least two tokens on the canvas to run auto-resolve')
    // Create a quick combat with two tokens
    const combat = await Combat.create({ scene: canvas.scene.id, active: true })
    await combat.createEmbeddedDocuments('Combatant', tokens.map(t => ({ tokenId: t.id, actorId: t.actor?.id })))
    await combat.rollAll()
    // Trigger AI auto-resolve for this combat
    try {
        await game.rnkPatrol.aiService.autoResolveCombat(combat)
        ui.notifications.info('AI auto-resolve executed; check AI log for autoResolve entry and undo payloads')
    } catch (err) {
        console.error('Auto-resolve test failed', err)
    }
    return true
})()
