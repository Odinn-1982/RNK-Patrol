import BaseAdapter from './BaseAdapter.js'

export class CyberpunkAdapter extends BaseAdapter {
    constructor() { super('cyberpunk-2020') }

    getActorHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        return a?.system?.hp?.value ?? a?.system?.attributes?.hp?.value ?? super.getActorHp(a)
    }

    getActorMaxHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        return a?.system?.hp?.max ?? a?.system?.attributes?.hp?.max ?? super.getActorMaxHp(a)
    }

    getAttackItems(actor) { return (actor?.items || []).filter(i => i.type === 'weapon' || i.system?.weaponType) }
    isPlayerActor(actor) { return !!actor?.hasPlayerOwner }

    async applyDamage(actor, amount) {
        try {
            if (!actor) return null
            const before = this.getActorHp(actor) ?? 0
            if (typeof actor.applyDamage === 'function') {
                await actor.applyDamage(Number(amount || 0))
                const after = this.getActorHp(actor) ?? 0
                return { before, after }
            }
            return await super.applyDamage(actor, amount)
        } catch (err) { return null }
    }

    async restoreDamage(actor, restoreValueOrUndo) {
        try {
            if (!actor) return null
            if (typeof actor.applyHealing === 'function') {
                const target = (typeof restoreValueOrUndo === 'object' && restoreValueOrUndo?.before !== undefined) ? Number(restoreValueOrUndo.before) : Number(restoreValueOrUndo || 0)
                const before = this.getActorHp(actor) ?? 0
                const delta = Math.max(0, target - before)
                if (delta > 0) await actor.applyHealing(delta)
                return { before, after: target }
            }
            return await super.restoreDamage(actor, restoreValueOrUndo)
        } catch (err) { return null }
    }
}

export default CyberpunkAdapter
