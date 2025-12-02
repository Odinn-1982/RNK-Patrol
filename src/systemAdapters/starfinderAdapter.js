import BaseAdapter from './BaseAdapter.js'
import { getProperty, averageDiceString } from './utils.js'

export class StarfinderAdapter extends BaseAdapter {
    constructor() { super('starfinder') }

    getActorHp(actorOrToken) { return getProperty(actorOrToken, 'system.attributes.hp.value') ?? super.getActorHp(actorOrToken) }
    getActorMaxHp(actorOrToken) { return getProperty(actorOrToken, 'system.attributes.hp.max') ?? super.getActorMaxHp(actorOrToken) }
    getActorAc(actor) { return getProperty(actor, 'system.attributes.ac.value') ?? getProperty(actor, 'system.defenses.ac') ?? super.getActorAc(actor) }

    getAttackItems(actor) { return (actor?.items || []).filter(i => i.type === 'weapon' || i.type === 'strike' || i.system?.damage) }

    async estimateBestAttackForToken(token) {
        const actor = token?.actor
        if (!actor) return null
        const items = this.getAttackItems(actor)
        let best = null
        for (const i of items) {
            const dmg = getProperty(i, 'system.damage.parts?.[0]?.[0]') || getProperty(i, 'system.damage') || getProperty(i, 'system.damage.value')
            const avg = dmg ? averageDiceString(dmg) : null
            const atk = Number(getProperty(i, 'system.attack') || 0)
            if (avg && (!best || avg > best.avg)) best = { item: i, avg, atk }
        }
        if (best) return { avgDamage: Math.round(best.avg), attackBonus: best.atk, weapon: best.item }
        return super.estimateBestAttackForToken(token)
    }

    async rollItemUse(item, attacker, targets = []) {
        try { if (typeof MidiQOL !== 'undefined' && item?.uuid) return await MidiQOL.completeItemUse(item, {}, { showFullCard: false, rollAttack: true }) } catch (err) {}
        if (typeof item?.roll === 'function') return item.roll({ target: targets })
        return null
    }

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

export default StarfinderAdapter
