// Test Midi logging: attempt a system-native item use (via adapter) and verify AI log updates
(async () => {
    if (!game.user.isGM) return ui.notifications.warn('Only GM can run this test')
    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
    if (!token) return ui.notifications.warn('Select a token with an item (attack) and a target on canvas')
    const actor = token.actor
    const items = (token.actor?.items || []).filter(i => i.type === 'weapon' || i.system?.damage)
    if (!items.length) return ui.notifications.warn('No candidate attack items')
    const item = items[0]
    const target = canvas.tokens.placeables.find(t => t.id !== token.id && t.actor)
    if (!target) return ui.notifications.warn('No target token found')
    // Log initial AI entry; AIService.performAction also logs but for this test we'll call adapter.rollItemUse and then watch the aiLog
    const adapter = game.rnkPatrol.systemAdapters.getAdapter(actor?.system?.id || game.system.id)
    if (!adapter) return ui.notifications.warn('No adapter for this system')
    console.log('Attempting roll via adapter:', adapter)
    const tsKey = Date.now()
    const logEntry = { type: 'test-midi', message: 'Starting midi logging test', payload: { actor: actor.id, item: item.id }, timestamp: tsKey }
    const saved = await game.rnkPatrol.logAiDecision(logEntry)
    // If adapter can do midi action, we register pending workflow to ensure AIService updates the saved log
    const AIService = game.rnkPatrol.aiService
    const key = `${actor.id}:${item?.uuid || item?.id}:${tsKey}`
    if (AIService && AIService._midiPendingWorkflows && typeof AIService._midiPendingWorkflows.set === 'function') {
        AIService._midiPendingWorkflows.set(key, { logTimestamp: saved.timestamp, payload: logEntry.payload })
    }
    let workflow = null
    try {
        workflow = await adapter.rollItemUse(item, token, [target])
    } catch (err) { console.error('Adapter roll failed', err) }
    console.log('Roll complete', workflow)
    ui.notifications.info('Rolled item; check AI log for updated entry')
    // Wait a moment for AIService hooks to update the log
    await new Promise(r => setTimeout(r, 1000))
    const updated = game.rnkPatrol.getAiLog().find(e => e.timestamp === saved.timestamp)
    if (updated && updated.payload && updated.payload.workflow) console.log('AI log updated with workflow info:', updated.payload.workflow)
    else console.warn('AI log not updated: check Midi-QOL and adapter workflow registration')
    return true
})()
