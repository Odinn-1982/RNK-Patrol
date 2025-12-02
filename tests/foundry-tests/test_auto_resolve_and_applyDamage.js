// Test script to run inside Foundry's Console as a GM
(async () => {
    if (!game.rnkPatrol) return console.warn('RNK Patrol not loaded')
    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
    if (!token) return console.warn('Select or have a token on the canvas')
    const actor = token.actor
    console.log('Before HP', actor?.system?.attributes?.hp?.value || actor?.system?.hp)
    const adapter = game.rnkPatrol.systemAdapters.getAdapter(actor?.system?.id || game.system.id)
    if (adapter && typeof adapter.applyDamage === 'function') {
        const res = await adapter.applyDamage(actor, 5)
        console.log('applyDamage result', res)
        await new Promise(r => setTimeout(r, 400))
        // restore
        if (res && typeof adapter.restoreDamage === 'function') {
            const restored = await adapter.restoreDamage(actor, res)
            console.log('restoreDamage result', restored)
        }
    } else {
        console.warn('No adapter applyDamage for this system')
    }
    return true
})()
