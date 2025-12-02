(function() {
    if (!game.user.isGM) return ui.notifications.warn('Simulate: GM only')
    const entry = { type: 'test', message: 'Pending test', payload: { test: true }, timestamp: Date.now() }
    game.rnkPatrol?.pushPendingAction(entry).then(() => {
        ui.notifications.info('Queued pending AI action for test')
        console.log('Pending actions:', game.rnkPatrol?.getPendingActions?.())
    })
})()
