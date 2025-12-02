// Test multi-action undo (gold + item) via the global undo helper
(async () => {
    if (!game.user.isGM) return ui.notifications.warn('Only GM can run this test')
    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
    if (!token) return ui.notifications.warn('Select a token with an actor to test undo')
    const actor = token.actor
    const adapter = game.rnkPatrol.systemAdapters.getAdapter(actor?.system?.id || game.system.id)
    if (!adapter) return ui.notifications.warn('Adapter not available')

    const beforeGold = adapter.getActorGold?.(actor) ?? game.rnkPatrol.captureSystem?._getActorGold?.(actor) ?? 0
    const stealAmount = Math.max(1, Math.floor((beforeGold || 10) * 0.1))

    // Select an item to remove if present
    const items = actor.items?.filter(i => i.type === 'weapon' || i.type === 'equipment' || i.type === 'item') || []
    const itemToSteal = items[0]

    // Perform theft (remove gold and possibly remove an item)
    if (adapter.removeActorGold && adapter.addActorGold) {
        await adapter.removeActorGold(actor, stealAmount)
    } else if (game.rnkPatrol.captureSystem && game.rnkPatrol.captureSystem._removeGold) {
        await game.rnkPatrol.captureSystem._removeGold(actor, stealAmount)
    }

    let removedItemData = null
    if (itemToSteal) {
        // Build item copy for undo
        removedItemData = itemToSteal.toObject()
        // Remove the item
        if (typeof adapter.removeItemFromActor === 'function') {
            await adapter.removeItemFromActor(actor, itemToSteal.id)
        } else {
            await actor.deleteEmbeddedDocuments('Item', [itemToSteal.id])
        }
    }

    const afterGold = adapter.getActorGold?.(actor) ?? game.rnkPatrol.captureSystem?._getActorGold?.(actor) ?? 0

    // Log AI entry with multi-action undo
    const undoActions = []
    undoActions.push({ action: 'restoreGold', actorId: actor.id, before: beforeGold, after: afterGold })
    if (removedItemData) undoActions.push({ action: 'restoreItem', actorId: actor.id, itemData: removedItemData })

    const entry = { type: 'theft', message: `Simulated theft of ${stealAmount} gold${removedItemData ? ' + item' : ''}`, payload: { actorId: actor.id, amount: stealAmount }, timestamp: Date.now(), provider: 'test', undo: { actions: undoActions } }
    await game.rnkPatrol.logAiDecision(entry)

    // Now call the centralized undo helper - this should restore gold and item
    const result = await game.rnkPatrol.undoAiLogEntry(entry)
    console.log('Undo result', result)

    // Validate
    const finalGold = adapter.getActorGold?.(actor) ?? game.rnkPatrol.captureSystem?._getActorGold?.(actor) ?? 0
    const itemRestored = removedItemData && actor.items.some(i => i.name === removedItemData.name)

    ui.notifications.info(`Undo test complete. result.success=${result.success}, finalGold=${finalGold}, itemRestored=${itemRestored}`)
    return { beforeGold, afterGold, finalGold, itemRestored, undoResult: result }
})()
