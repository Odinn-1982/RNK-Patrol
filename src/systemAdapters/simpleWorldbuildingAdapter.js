import BaseAdapter from './BaseAdapter.js'

export class SimpleWorldBuilderAdapter extends BaseAdapter {
    constructor() { super('simple-world-building') }

    getActorHp(actorOrToken) { return super.getActorHp(actorOrToken) }
    getActorMaxHp(actorOrToken) { return super.getActorMaxHp(actorOrToken) }
    isPlayerActor(actor) { return !!actor?.hasPlayerOwner }

    async applyDamage(actor, amount) {
        return await super.applyDamage(actor, amount)
    }

    async restoreDamage(actor, restoreValueOrUndo) {
        return await super.restoreDamage(actor, restoreValueOrUndo)
    }
}

export default SimpleWorldBuilderAdapter
