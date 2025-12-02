// Test script to run inside Foundry's Console as a GM
(async () => {
    if (!game.rnkPatrol) return console.warn('RNK Patrol module not loaded')
    const { getAdapter } = game.rnkPatrol?.systemAdapters || (() => null)
    // Fallback in case module not wired into game
    const adapters = game.rnkPatrol?.systemAdapters?.adapters || null
    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
    if (!token) return console.warn('Select or have a token on the canvas')
    const sysId = game.system.id
    const adapter = getAdapter ? getAdapter(sysId) : (adapters && adapters[sysId])
    console.log('Running adapter tests for', sysId, adapter)
    try {
        const hp = adapter?.getActorHp?.(token)
        const max = adapter?.getActorMaxHp?.(token)
        const ac = adapter?.getActorAc?.(token.actor)
        const items = adapter?.getAttackItems?.(token.actor) || []
        const est = await (adapter?.estimateBestAttackForToken?.(token) || null)
        console.log({ hp, max, ac, items: items.length, estimate: est })
    } catch (err) { console.error('Adapter test failed', err) }
    return true
})()
