import BaseAdapter from './BaseAdapter.js'
import { getProperty, averageDiceString } from './utils.js'

/**
 * DnD 5E adapter - full support for common operations
 */
export class Dnd5eAdapter extends BaseAdapter {
    constructor() { super('dnd5e') }

    getActorHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        if (!a) return null
        return a.system?.attributes?.hp?.value ?? a.system?.hp ?? null
    }

    getActorMaxHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        if (!a) return null
        return a.system?.attributes?.hp?.max ?? a.system?.hp?.max ?? null
    }

    async setActorHp(actor, value) {
        if (!actor) return false
        try {
            // DnD5e supports actor.update for HP; prefer native method if available
            if (typeof actor.applyDamage === 'function' && value < this.getActorHp(actor)) {
                // applyDamage exists (system or modules may add) - compute diff
                const diff = (this.getActorHp(actor) ?? 0) - value
                await actor.applyDamage(diff)
            } else if (typeof actor.applyHealing === 'function' && value > this.getActorHp(actor)) {
                const diff = value - (this.getActorHp(actor) ?? 0)
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
            // Use dnd5e actor.applyDamage if present
            if (typeof actor.applyDamage === 'function') {
                const before = this.getActorHp(actor) ?? 0
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
            // prefer setting using system fields
            const payload = await super.restoreDamage(actor, restoreValueOrUndo)
            return payload
        } catch (err) { return null }
    }

    getActorAc(actor) {
        return actor?.system?.attributes?.ac?.value ?? actor?.system?.attributes?.ac ?? actor?.system?.attributes?.ac?.flat ?? 10
    }

    getAttackItems(actor) {
        return (actor?.items || []).filter(i => i.type === 'weapon' || i.type === 'melee' || i.type === 'ranged')
    }

    async estimateBestAttackForToken(token) {
        const actor = token?.actor
        if (!actor) return null
        const weapons = this.getAttackItems(actor)
        let best = null
            for (const w of weapons) {
            const dmgParts = w.system?.damage?.parts || []
            const dmgStr = dmgParts?.[0]?.[0] || w.system?.damage?.parts?.[0]?.[0]
            const avg = dmgStr ? averageDiceString(dmgStr) : null
            const atk = Number(w.system?.attackBonus || w.system?.properties?.atk || 0)
            if (avg && (!best || avg > best.avg)) best = { item: w, avg, atk }
        }
        if (best) return { avgDamage: Math.round(best.avg), attackBonus: best.atk, weapon: best.item }
        // fallback via actor
            const prof = actor.system?.attributes?.prof ?? 0
        const strmod = actor.system?.abilities?.str?.mod ?? 0
        return { avgDamage: Math.round(actor.system?.details?.cr || 5), attackBonus: prof + strmod, weapon: null }
    }

    async rollItemUse(item, attacker, targets = []) {
        try {
            // Prefer MidiQOL if present
            if (typeof MidiQOL !== 'undefined' && item?.uuid) return await MidiQOL.completeItemUse(item, {}, { showFullCard: false, rollAttack: true })
            if (typeof item.roll === 'function') return await item.roll({ target: targets })
        } catch (e) { }
        return null
    }

    isPlayerActor(actor) { return !!actor?.hasPlayerOwner }

    async tokenHideRemove(token, options = {}) { return await super.tokenHideRemove(token, options) }
    getActorGold(actor) { return super.getActorGold(actor) }
    async setActorGold(actor, amount) { return await super.setActorGold(actor, amount) }
    async addActorGold(actor, amount) { return await super.addActorGold(actor, amount) }
    async removeActorGold(actor, amount) { return await super.removeActorGold(actor, amount) }
}

export default Dnd5eAdapter
