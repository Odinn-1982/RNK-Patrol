(async function(actorId, amount) {
    if (!game.user.isGM) return ui.notifications.warn('Simulate: GM only')
    const entry = await game.rnkPatrol.simulateTheftUndoFlow(actorId, amount)
    console.log('Simulated theft log entry:', entry)
    ui.notifications.info('Simulated theft log entry created. Check AI Log to perform Undo')
})
