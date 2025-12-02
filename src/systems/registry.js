import BaseAdapter from './BaseAdapter.js'
import dnd5eAdapter from './dnd5eAdapter.js'
import pf2eAdapter from './pf2eAdapter.js'
import genericAdapter from './genericAdapter.js'

const adapters = new Map()

// Register built-in adapters
adapters.set('dnd5e', dnd5eAdapter)
adapters.set('pf2e', pf2eAdapter)
adapters.set('pf1', genericAdapter)
adapters.set('swade', genericAdapter)
adapters.set('sfrpg', genericAdapter)
adapters.set('sw5e', genericAdapter)
adapters.set('cof', genericAdapter)
adapters.set('cyberpunk-red', genericAdapter)
adapters.set('demonlord', genericAdapter)
adapters.set('world-of-darkness', genericAdapter)

export default class AdapterRegistry {
    static getAdapter(systemId) {
        const id = systemId || game?.system?.id || 'generic'
        if (adapters.has(id)) return adapters.get(id)
        return genericAdapter
    }
}
