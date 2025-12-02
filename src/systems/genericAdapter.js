import BaseAdapter from './BaseAdapter.js'
import { averageDiceString } from '../utils/rollUtils.js'

export default class GenericAdapter extends BaseAdapter {
    constructor() { super(); }

    async estimateAttackForToken(token) {
        try {
            const actor = token?.actor
            if (!actor) return null
            // try to find a weapon-like item
            const weapon = actor.items?.find(i => i.type === 'weapon' || i.type === 'equipment' || i.type === 'item')
            const cp = { avgDamage: 5, attackBonus: 0, weapon: weapon || null }
            if (weapon) {
                const dmg = weapon?.system?.damage?.parts?.[0]?.[0] || weapon?.system?.damage?.value || weapon?.system?.damage?.dice || null
                if (dmg) cp.avgDamage = Math.round(averageDiceString(dmg) || cp.avgDamage)
                cp.attackBonus = Number((weapon?.system?.attackBonus || weapon?.system?.attack) || (actor?.system?.attributes?.prof || 0) + (actor?.system?.abilities?.str?.mod || 0) || 0)
                cp.weapon = weapon
            } else if (actor?.system?.attributes?.hp) {
                cp.avgDamage = Math.round(actor?.system?.details?.cr || cp.avgDamage)
            }
            return cp
        } catch (err) { return null }
    }

    async estimateDprForToken(token) {
        const info = await this.estimateAttackForToken(token)
        if (!info) return 5
        // fallback: assume hits 50% of the time
        return (info.avgDamage || 5) * 0.5
    }

    getActorArmorClass(actorOrToken) {
        const actor = actorOrToken?.actor || actorOrToken
        if (!actor) return 10
        return actor?.system?.attributes?.ac?.value || actor?.system?.attributes?.ac || actor?.system?.defenses?.ac || 10
    }

    getActorHp(actorOrToken) {
        const actor = actorOrToken?.actor || actorOrToken
        if (!actor) return 0
        const hp = actor?.system?.attributes?.hp?.value || actor?.system?.hp || 0
        return hp
    }

    async setActorHp(actor, value) {
        if (!actor) return null
        if (actor.update) {
            // Try common dnd5e style path
            if (actor.system?.attributes?.hp) {
                await actor.update({ 'system.attributes.hp.value': value })
                return this.getActorHp(actor)
            }
            if (actor.system?.hp !== undefined) {
                await actor.update({ 'system.hp': value })
                return this.getActorHp(actor)
            }
        }
        return this.getActorHp(actor)
    }

    async rollItem(item, { target } = {}) {
        if (!item) return null
        if (typeof item.roll === 'function') {
            try { return await item.roll({ target }) } catch (e) { return null }
        }
        return null
    }

    async restoreItemToActor(actor, itemData) {
        // Basic merge: add a new item with the data
        if (!actor || !actor.createEmbeddedDocuments) return null
        const itemToCreate = itemData
        try {
            const created = await actor.createEmbeddedDocuments('Item', [itemToCreate])
            return created
        } catch (err) { return null }
    }
}
