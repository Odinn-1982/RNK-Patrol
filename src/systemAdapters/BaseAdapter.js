/**
 * BaseAdapter: Defines the standard interface adapters should implement
 * Provides default best-effort implementations for common operations.
 */
import { getProperty } from './utils.js'
import { MODULE_ID } from '../main.js'

export class BaseAdapter {
    constructor(systemId) {
        this.systemId = systemId || 'generic'
    }

    // Extract HP value for the given token or actor
    getActorHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        if (!a) return null
        // Common path: system.attributes.hp
        return a.system?.attributes?.hp?.value ?? a.system?.hp ?? a.data?.attributes?.hp?.value ?? null
    }

    getActorMaxHp(actorOrToken) {
        const a = (actorOrToken?.actor) ? actorOrToken.actor : actorOrToken
        if (!a) return null
        return a.system?.attributes?.hp?.max ?? a.system?.hp?.max ?? a.data?.attributes?.hp?.max ?? null
    }

    async setActorHp(actor, value) {
        try {
            if (!actor) return false
            if (actor.system?.attributes?.hp !== undefined) {
                await actor.update({ 'system.attributes.hp.value': value })
                return true
            }
            if (actor.system?.hp !== undefined) {
                await actor.update({ 'system.hp': value })
                return true
            }
            // last-resort fallback: store flag
            await actor.setFlag('rnk-patrol', 'lastKnownHp', value)
            return true
        } catch (err) { return false }
    }

    /**
     * Apply damage to actor by decreasing HP by `amount`. Returns undo info { before, after }
     */
    async applyDamage(actor, amount) {
        try {
            if (!actor) return null
            const before = this.getActorHp(actor) ?? 0
            const newHp = Math.max(0, Number(before) - Number(amount || 0))
            await this.setActorHp(actor, newHp)
            return { before, after: newHp }
        } catch (err) { return null }
    }

    /**
     * Restore damage by setting hp to `hpValue` (before) or adding amount back.
     * Accepts either number or undo payload {before, after}.
     */
    async restoreDamage(actor, restoreValueOrUndo) {
        try {
            if (!actor) return null
            const target = (typeof restoreValueOrUndo === 'object' && restoreValueOrUndo?.before !== undefined) ? Number(restoreValueOrUndo.before) : Number(restoreValueOrUndo || 0)
            const before = this.getActorHp(actor) ?? 0
            await this.setActorHp(actor, target)
            return { before, after: target }
        } catch (err) { return null }
    }

    // Currency helpers
    getActorGold(actor) {
        if (!actor) return 0
        if (actor.system?.currency?.gp !== undefined) return actor.system.currency.gp
        if (actor.system?.details?.wealth?.value !== undefined) return actor.system.details.wealth.value
        if (actor.system?.gold !== undefined) return actor.system.gold
        return 0
    }

    async setActorGold(actor, amount) {
        try {
            if (!actor) return false
            if (actor.system?.currency?.gp !== undefined) await actor.update({ 'system.currency.gp': amount })
            else if (actor.system?.details?.wealth?.value !== undefined) await actor.update({ 'system.details.wealth.value': amount })
            else if (actor.system?.gold !== undefined) await actor.update({ 'system.gold': amount })
            else await actor.setFlag(MODULE_ID, 'lastKnownGold', amount)
            return true
        } catch (err) { return false }
    }

    async addActorGold(actor, amount) {
        try {
            const current = this.getActorGold(actor) || 0
            await this.setActorGold(actor, Math.max(0, current + Number(amount || 0)))
            return true
        } catch (err) { return false }
    }

    async removeActorGold(actor, amount) {
        try {
            const current = this.getActorGold(actor) || 0
            await this.setActorGold(actor, Math.max(0, current - Number(amount || 0)))
            return true
        } catch (err) { return false }
    }

    // Item restore helper
    async restoreItemToActor(actor, itemUndoData) {
        try {
            if (!actor || !itemUndoData) return false
            const itemData = itemUndoData.itemData ?? itemUndoData
            const quantity = itemUndoData.quantity ?? (itemData?.system?.quantity ?? 1)
            const existing = actor.items.find(i => i.name === itemData.name && i.type === itemData.type)
            if (existing && existing.system?.quantity !== undefined && typeof existing.system.quantity === 'number') {
                const newQty = (existing.system.quantity || 0) + Number(quantity || 1)
                await existing.update({ 'system.quantity': newQty })
            } else {
                if (!itemData.system) itemData.system = {}
                itemData.system.quantity = Number(quantity || 1)
                await actor.createEmbeddedDocuments('Item', [itemData])
            }
            return true
        } catch (err) { return false }
    }

    /**
     * Remove an item from an actor by id or fallback to name matching
     * @param {Actor} actor
     * @param {string} itemId
     */
    async removeItemFromActor(actor, itemIdOrNameOrData) {
        try {
            if (!actor || !itemIdOrNameOrData) return false
            let item = actor.items.find(i => i.id === itemIdOrNameOrData || i._id === itemIdOrNameOrData)
            if (!item && typeof itemIdOrNameOrData === 'string') {
                item = actor.items.find(i => i.name === itemIdOrNameOrData)
            }
            if (!item && typeof itemIdOrNameOrData === 'object' && itemIdOrNameOrData.name) {
                item = actor.items.find(i => i.name === itemIdOrNameOrData.name)
            }
            if (!item) return false
            await actor.deleteEmbeddedDocuments('Item', [item.id])
            return true
        } catch (err) { return false }
    }

    // get actor AC
    getActorAc(actor) {
        return actor?.system?.attributes?.ac?.value ?? actor?.system?.attributes?.ac ?? actor?.system?.defences?.ac ?? actor?.system?.defenses?.ac ?? 10
    }

    // Return attack-capable items; default: items with damage or weapon type
    getAttackItems(actor) {
        return (actor?.items || []).filter(i => (i.type === 'weapon' || (i.system && (i.system.damage || i.system.damage?.parts || i.system.damage?.value))))
    }

    // Best effort estimate of a token's best attack
    async estimateBestAttackForToken(token) {
        try {
            const actor = token?.actor ?? null
            if (!actor) return null
            const weapons = this.getAttackItems(actor) || []
            let best = null
            for (const w of weapons) {
                let avg = null
                try { avg = this._parseAverageDamage(w) } catch (err) { }
                const atk = Number(getProperty(w, 'system.attackBonus') || getProperty(w, 'system.attack') || getProperty(w, 'system.attack-bonus') || 0)
                if (avg && (!best || avg > best.avg)) best = { item: w, avg, atk }
            }
            if (best) return { avgDamage: Math.round(best.avg), attackBonus: best.atk, weapon: best.item }
            // Fallback to actor fields
            const hp = getProperty(actor, 'system.attributes.hp.value') || getProperty(actor, 'system.hp') || null
            return { avgDamage: Math.round(getProperty(actor, 'system.details.cr') || 5), attackBonus: Number(getProperty(actor, 'system.attributes.prof') || 0), weapon: null }
        } catch (err) { return null }
    }

    async rollItemUse(item, attacker, targets = []) {
        // Try MidiQOL via common pattern or fallback to Item.roll
        try {
            if (typeof MidiQOL !== 'undefined' && item?.uuid) {
                const workflow = await MidiQOL.completeItemUse(item, {}, { showFullCard: false, rollAttack: true })
                return workflow
            }
            if (typeof item?.roll === 'function') {
                return await item.roll({ target: Array.isArray(targets) ? targets : [targets] })
            }
        } catch (err) { /* ignore */ }
        return null
    }

    isPlayerActor(actor) {
        return !!actor?.hasPlayerOwner
    }

    // Hide or delete token (auto-resolve flows)
    async tokenHideRemove(token, options = {}) {
        try {
            if (!token) return false
            const actor = token.actor
            const tokenDocState = token.document.toObject()
            if (this.isPlayerActor(actor) && !options.applyToPlayers) {
                // Do nothing for players unless explicitly allowed
                return false
            }
            // Prefer setting HP to 0 for systems that support it
            if (actor && actor.system?.attributes?.hp !== undefined) {
                await actor.update({ 'system.attributes.hp.value': 0 })
                // Delete the token document
                await token.document.delete()
                return { action: 'restoreToken', tokenDoc: tokenDocState }
            }
            try { await token.document.update({ hidden: true }); return { action: 'unhideToken', tokenDoc: tokenDocState } } catch (err) { return false }
        } catch (err) { return false }
    }

    _parseAverageDamage(item) {
        // Best-effort parse of a damage string; tries common places
        const dmgStr = getProperty(item, 'system.damage.parts.0.0') || getProperty(item, 'system.damage.value') || getProperty(item, 'system.damage')
        if (!dmgStr) return null
        const avg = this._parseAverageDamageFormula(dmgStr) || null
        return avg
    }

    _parseAverageDamageFormula(formula) {
        if (!formula || typeof formula !== 'string') return null
        const clean = formula.replace(/\s+/g, '')
        const m = clean.match(/(\d+)d(\d+)([+-]\d+)?/i)
        if (!m) return null
        const diceCount = parseInt(m[1],10)
        const diceSides = parseInt(m[2],10)
        const modifier = m[3] ? parseInt(m[3],10) : 0
        const avgDice = diceCount * (diceSides + 1) / 2
        return avgDice + modifier
    }
}

export default BaseAdapter
