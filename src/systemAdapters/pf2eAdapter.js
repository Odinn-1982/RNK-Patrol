import BaseAdapter from './BaseAdapter.js'
import { getProperty, averageDiceString } from './utils.js'

export class Pf2eAdapter extends BaseAdapter {
    constructor() { super('pf2e') }

    getActorHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        if (!a) return null
        return a.system?.attributes?.hp?.value ?? a.system?.attributes?.hp ?? a.system?.hp ?? null
    }

    getActorMaxHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        if (!a) return null
        return a.system?.attributes?.hp?.max ?? a.system?.hp?.max ?? null
    }

    async setActorHp(actor, value) {
        if (!actor) return false
        try {
            // PF2e may have actor.applyDamage() or use item strikes; prefer update if not available
            if (typeof actor.applyDamage === 'function' && value < this.getActorHp(actor)) {
                const diff = (this.getActorHp(actor) || 0) - value
                await actor.applyDamage(diff)
            } else if (typeof actor.applyHealing === 'function' && value > this.getActorHp(actor)) {
                const diff = value - (this.getActorHp(actor) || 0)
                await actor.applyHealing(diff)
            } else {
                await actor.update({ 'system.attributes.hp.value': value })
            }
            return true
        } catch (err) { return false }
    }
    async applyDamage(actor, amount) {
        try {
            if (!actor) return null
            if (typeof actor.applyDamage === 'function') {
                const before = this.getActorHp(actor) ?? 0
                await actor.applyDamage(Number(amount || 0))
                const after = this.getActorHp(actor) ?? 0
                return { before, after }
            }
            return await super.applyDamage(actor, amount)
        } catch (err) { return null }
    }
    async restoreDamage(actor, restoreValueOrUndo) { return await super.restoreDamage(actor, restoreValueOrUndo) }

    getActorAc(actor) { return actor?.system?.attributes?.ac?.value ?? actor?.system?.attributes?.ac ?? actor?.system?.defences?.ac ?? 10 }

    getAttackItems(actor) { return (actor?.items || []).filter(i => i.type === 'strike' || i.type === 'weapon' || (i.system && (i.system.damage || i.system.damage?.value))) }

    async estimateBestAttackForToken(token) {
        const actor = token?.actor
        if (!actor) return null
        const strikes = this.getAttackItems(actor) || []
        let best = null
        for (const s of strikes) {
            const dmgStr = s.system?.damage?.value || s.system?.damage?.dice || s.system?.damage || null
            const avg = dmgStr ? averageDiceString(dmgStr) : null
            const atk = Number(getProperty(s, 'system.attack') || getProperty(s, 'system.attack.mod') || 0)
            if (avg && (!best || avg > best.avg)) best = { item: s, avg, atk }
        }
        if (best) return { avgDamage: Math.round(best.avg), attackBonus: best.atk, weapon: best.item }
        return { avgDamage: Math.round(getProperty(actor, 'system.details.cr') || 5), attackBonus: Number(getProperty(actor, 'system.skills.perception.rank') || 0), weapon: null }
    }

    async rollItemUse(item, attacker, targets = []) {
        try {
            if (typeof MidiQOL !== 'undefined' && item?.uuid) return await MidiQOL.completeItemUse(item, {}, { showFullCard: false, rollAttack: true })
            if (typeof item.roll === 'function') return await item.roll({ target: targets })
        } catch (e) { }
        return null
    }

    isPlayerActor(actor) { return !!actor?.hasPlayerOwner }
    getActorGold(actor) { return super.getActorGold(actor) }
    async setActorGold(actor, amount) { return await super.setActorGold(actor, amount) }
    async addActorGold(actor, amount) { return await super.addActorGold(actor, amount) }
    async removeActorGold(actor, amount) { return await super.removeActorGold(actor, amount) }
}

export default Pf2eAdapter
