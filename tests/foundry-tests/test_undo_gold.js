// Test undoing gold change via adapter (simulate theft and undo)
(async () => {
    if (!game.user.isGM) return ui.notifications.warn('Only GM can run this test')
    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
    if (!token) return ui.notifications.warn('Select a token with an actor to test gold undo')
    const actor = token.actor
    const adapter = game.rnkPatrol.systemAdapters.getAdapter(actor?.system?.id || game.system.id)
    if (!adapter || typeof adapter.getActorGold !== 'function' || typeof adapter.setActorGold !== 'function') return ui.notifications.warn('Adapter gold helpers not available')
    const before = adapter.getActorGold(actor) || 0
    const stealAmount = Math.max(1, Math.floor((before || 10) * 0.1))
    const after = Math.max(0, Number(before) - Number(stealAmount))
    // Apply theft
    await adapter.setActorGold(actor, after)
    console.log('Applied theft. Before:', before, 'After:', after)
    // Log AI entry with undo
    const entry = { type: 'theft', message: `Stole ${stealAmount} gold`, payload: { actorId: actor.id, amount: stealAmount }, timestamp: Date.now(), provider: 'test', undo: { actions: [{ action: 'restoreGold', actorId: actor.id, before, after }] } }
    await game.rnkPatrol.logAiDecision(entry)
    // Perform undo via adapter logic (simulate GMHub undo handler)
    await adapter.setActorGold(actor, Number(before))
    const restored = await adapter.getActorGold(actor)
    console.log('Restored gold to:', restored)
    ui.notifications.info('Undo simulated: check AI log and actor gold')
    return { before, after, restored }
})()
