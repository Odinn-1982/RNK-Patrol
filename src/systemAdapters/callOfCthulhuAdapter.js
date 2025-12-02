import BaseAdapter from './BaseAdapter.js'
import { getProperty, averageDiceString } from './utils.js'

export class CallOfCthulhuAdapter extends BaseAdapter {
    constructor() { super('call-of-cthulhu') }

    getActorHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        // CoC often stores HP in system.status.hp or system.wounds
        return getProperty(a, 'system.status.hp.value') ?? getProperty(a, 'system.wounds.value') ?? getProperty(a, 'system.attributes.hp.value') ?? super.getActorHp(a)
    }

    getActorMaxHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        return getProperty(a, 'system.status.hp.max') ?? getProperty(a, 'system.wounds.max') ?? getProperty(a, 'system.attributes.hp.max') ?? super.getActorMaxHp(a)
    }

    getActorAc(actor) { return getProperty(actor, 'system.attributes.ac.value') ?? getProperty(actor, 'system.defences.parry') ?? super.getActorAc(actor) }

    getAttackItems(actor) { return (actor?.items || []).filter(i => i.type === 'weapon' || i.type === 'melee' || (i.system && i.system.damage)) }

    async estimateBestAttackForToken(token) {
        const actor = token?.actor
        if (!actor) return null
        const weapons = this.getAttackItems(actor)
        let best = null
        for (const w of weapons) {
            const dmg = getProperty(w, 'system.damage') || getProperty(w, 'system.damage.parts?.[0]?.[0]')
            const avg = dmg ? averageDiceString(dmg) : null
            const atk = Number(getProperty(w, 'system.attack') || getProperty(w, 'system.bonus') || 0)
            if (avg && (!best || avg > best.avg)) best = { item: w, avg, atk }
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

    isPlayerActor(actor) { return !!actor?.hasPlayerOwner }
}

export default CallOfCthulhuAdapter
