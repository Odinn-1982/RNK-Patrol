/**
 * BaseAdapter interface for per-system behavior
 * Implement methods to extract attack info, HP, AC, item damage, apply damage etc.
 */
export default class BaseAdapter {
    constructor() {}

    // Returned object {avgDamage, attackBonus, weapon}
    async estimateAttackForToken(token) { throw new Error('Not implemented') }

    // Estimate DPR for a token
    async estimateDprForToken(token) { throw new Error('Not implemented') }

    // Get effective AC from an actor or token
    getActorArmorClass(actorOrToken) { throw new Error('Not implemented') }

    // Get HP value from an actor or token
    getActorHp(actorOrToken) { throw new Error('Not implemented') }

    // Apply HP change to actor (positive/negative); returns updated HP
    async setActorHp(actor, value) { throw new Error('Not implemented') }

    // Return whether the system supports native item roll or midi workflows
    supportsMidi() { return typeof MidiQOL !== 'undefined' }

    // Roll an item using system-native method; optional target
    async rollItem(item, { target } = {}) { throw new Error('Not implemented') }

    // When needed, can implement item restore logic - default is to add item
    async restoreItemToActor(actor, itemData) { throw new Error('Not implemented') }

    // Collect a short label for the system
    systemId() { return game?.system?.id || 'unknown' }
}
