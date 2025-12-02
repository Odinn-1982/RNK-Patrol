// Test script: iterate adapters and print results for the selected token
(async () => {
    if (!game.rnkPatrol) return console.warn('RNK Patrol not loaded')
    const sa = game.rnkPatrol.systemAdapters
    if (!sa) return console.warn('systemAdapters missing')
    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
    if (!token) return console.warn('No token on canvas')
    console.log('Testing adapters for token:', token.name)
    for (const [id, adapter] of Object.entries(sa.adapters)) {
        try {
            const hp = adapter?.getActorHp?.(token)
            const max = adapter?.getActorMaxHp?.(token)
            const ac = adapter?.getActorAc?.(token.actor)
            const est = await (adapter?.estimateBestAttackForToken ? adapter.estimateBestAttackForToken(token) : null)
            console.log(id, { hp, max, ac, estimate: est })
        } catch (err) { console.error(id, 'error', err) }
    }
    return true
})()
