import BaseAdapter from './BaseAdapter.js'
import Dnd5eAdapter from './dnd5eAdapter.js'
import Pf2eAdapter from './pf2eAdapter.js'
// Simple generic adapters for other systems (best-effort)
import Base from './BaseAdapter.js'
import BladesInTheDarkAdapter from './bladesAdapter.js'
import CallOfCthulhuAdapter from './callOfCthulhuAdapter.js'
import CyberpunkAdapter from './cyberpunkAdapter.js'
import Cyberpunk2020Adapter from './cyberpunk2020Adapter.js'
import Dsa5Adapter from './dsa5Adapter.js'
import ForbiddenLandsAdapter from './forbiddenLandsAdapter.js'
import Pf1Adapter from './pf1Adapter.js'
import SwadeAdapter from './swadeAdapter.js'
import SimpleWorldBuilderAdapter from './simpleWorldbuildingAdapter.js'
import StarfinderAdapter from './starfinderAdapter.js'
import UnhallowedMetropolisAdapter from './unhallowedMetropolisAdapter.js'

const adapters = {
    dnd5e: new Dnd5eAdapter(),
    pf2e: new Pf2eAdapter(),
    // Add our system-specific adapters (use canonical keys as known & common aliases below)
    pf1: new Pf1Adapter(),
    sfrpg: new StarfinderAdapter(),
    sw5e: new BaseAdapter('sw5e'), // no detailed adapter
    swade: new SwadeAdapter(),
    wfrp4e: new BaseAdapter('wfrp4e'),
    genesys: new BaseAdapter('genesys'),
    // versions & aliases for CoC
    'cof': new CallOfCthulhuAdapter(),
    'call-of-cthulhu': new CallOfCthulhuAdapter(),
    'call_of_cthulhu': new CallOfCthulhuAdapter(),
    'cthulhu': new CallOfCthulhuAdapter(),
    cyberpunk: new Cyberpunk2020Adapter(),
    'cyberpunk-2020': new Cyberpunk2020Adapter(),
    'blades-in-the-dark': new BladesInTheDarkAdapter(),
    'bladesinth' : new BladesInTheDarkAdapter(),
    'blades-in-the-dark-system': new BladesInTheDarkAdapter(),
    'dsa5': new Dsa5Adapter(),
    'forbidden-lands': new ForbiddenLandsAdapter(),
    'forbiddenlands': new ForbiddenLandsAdapter(),
    'starfinder': new StarfinderAdapter(),
    'sfrpg': new StarfinderAdapter(),
    'simple-world-building': new SimpleWorldBuilderAdapter(),
    'unhallowed-metropolis': new UnhallowedMetropolisAdapter(),
}

export function getAdapter(systemId) {
    const sid = String(systemId || game?.system?.id || 'generic')
    return adapters[sid] || adapters['dnd5e'] || new BaseAdapter(sid)
}

export { adapters }

export default { getAdapter, adapters }
