(async function(actorId, patrolId, bribeAmount = 50) {
    if (!game.user.isGM) return ui.notifications.warn('Simulate: GM only')
    const actor = game.actors.get(actorId)
    if (!actor) return ui.notifications.warn('Invalid actor ID')
    const res = await game.rnkPatrol.simulateBribeFlow(actorId, bribeAmount, patrolId)
    console.log('Simulate bribe flow result', res)
    if (res?.queued) ui.notifications.info('Bribe suggestion queued for approval')
    else ui.notifications.info(`Bribe decision: ${res?.accepted}`)
})
