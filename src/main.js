/**
 * RNK Patrol - Advanced Patrol System for Foundry VTT
 * 
 * Features:
 * - Teleporting Waypoint Patrols: Guards appear/disappear at waypoints
 * - Traditional Walking Patrols: Classic A→B→C movement
 * - Randomization: Unpredictable patrol patterns
 * - Visual Effects: Customizable appear/vanish animations
 * - Detection System: Guards can detect tokens in range
 * 
 * @module rnk-patrol
 * @version 1.0.0
 */

'use strict'

// Module exports
export const MODULE_ID = 'rnk-patrol'
export const MODULE_NAME = 'RNK Patrol'

// Logging utilities
export const log = (...args) => {
    try {
        if (game.settings?.get(MODULE_ID, 'debugMode')) {
            console.log(`${MODULE_NAME} |`, ...args)
        }
    } catch (e) {
        // Setting not yet registered, skip logging
    }
}
export const debug = (...args) => {
    try {
        if (game.settings?.get(MODULE_ID, 'debugMode')) {
            console.debug(`${MODULE_NAME} [DEBUG] |`, ...args)
        }
    } catch (e) {
        // Setting not yet registered, skip logging
    }
}
export const warn = (...args) => console.warn(`${MODULE_NAME} |`, ...args)
export const error = (...args) => console.error(`${MODULE_NAME} |`, ...args)

// Localization helper
export const i18n = (key, data = {}) => {
    return game.i18n.format(`${MODULE_ID}.${key}`, data)
}

// Patrol mode types
export const PATROL_MODES = {
    BLINK: 'blink',      // Teleporting waypoint patrol
    WALK: 'walk',        // Traditional walking patrol
    HYBRID: 'hybrid'     // Mix of both
}

// Patrol states
export const PATROL_STATES = {
    IDLE: 'idle',
    ACTIVE: 'active',
    PAUSED: 'paused',
    ALERT: 'alert',
    RETURNING: 'returning'
}

// Waypoint states
export const WAYPOINT_STATES = {
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    OCCUPIED: 'occupied'
}

// Pattern types for blink patrols
export const BLINK_PATTERNS = {
    SEQUENTIAL: 'sequential',   // Visit waypoints in order
    RANDOM: 'random',           // Random waypoint selection
    WEIGHTED: 'weighted',       // Some waypoints more likely
    PING_PONG: 'pingPong',     // Back and forth
    PRIORITY: 'priority'        // Based on conditions
}

// Alert states for detection system
export const ALERT_STATES = {
    IDLE: 'idle',
    ALERT: 'alert',
    COMBAT: 'combat',
    INVESTIGATING: 'investigating'
}

// Effect types for visual transitions
export const EFFECT_TYPES = {
    FADE: 'fade',
    FLASH: 'flash',
    PARTICLES: 'particles',
    GLITCH: 'glitch',
    SHADOW: 'shadow',
    ARCANE: 'arcane'
}

/**
 * Module API - exposed to game.rnkPatrol
 */
const moduleAPI = {
    // Version info
    version: '1.0.0',
    
    // Core classes (populated on ready)
    Patrol: null,
    Waypoint: null,
    PatrolManager: null,
    PatrolEffects: null,
    PatrolDetection: null,
    PatrolSocket: null,
    
    // Active managers
    manager: null,
    
    // Quick reference to effects (for socket handler)
    get effects() { return this.PatrolEffects },
    
    // Constants
    PATROL_MODES,
    PATROL_STATES,
    WAYPOINT_STATES,
    BLINK_PATTERNS,
    ALERT_STATES,
    EFFECT_TYPES,
    
    /**
     * Create a new patrol
     * @param {Object} config - Patrol configuration
     * @returns {Promise<Patrol>}
     */
    async createPatrol(config) {
        if (!game.user.isGM) {
            throw new Error('Only GMs can create patrols')
        }
        return this.manager.createPatrol(config)
    },
    
    /**
     * Get all patrols on current scene
     * @returns {Patrol[]}
     */
    getPatrols() {
        return this.manager?.getPatrols() ?? []
    },
    
    /**
     * Get patrol by ID
     * @param {string} id 
     * @returns {Patrol|null}
     */
    getPatrol(id) {
        return this.manager?.getPatrol(id) ?? null
    },
    
    /**
     * Start all patrols
     */
    async startAll() {
        return this.manager?.startAll()
    },
    
    /**
     * Stop all patrols
     */
    async stopAll() {
        return this.manager?.stopAll()
    },
    
    /**
     * Pause all patrols
     */
    async pauseAll() {
        return this.manager?.pauseAll()
    }
}

/**
 * Initialize module on Foundry init
 */
Hooks.once('init', async () => {
    log('Initializing RNK Patrol')
    
    // Register settings
    const { registerSettings } = await import('./settings.js')
    registerSettings()
    
    // Store API globally
    game.rnkPatrol = moduleAPI
    
    log('Init complete')
})

/**
 * Setup module - prepare for socket communication
 * Note: Actual socket handlers are initialized in PatrolSocket.initialize()
 */
Hooks.on('setup', async () => {
    log('Setting up module')
    // Socket initialization happens in the 'ready' hook after all modules are loaded
})

/**
 * Module ready - load all systems
 */
Hooks.once('ready', async () => {
    log('Module ready - loading systems')
    
    try {
        // Load core classes one by one with logging
        log('Loading Waypoint...')
        const { Waypoint } = await import('./Waypoint.js')
        
        log('Loading Patrol...')
        const { Patrol } = await import('./Patrol.js')
        
        log('Loading PatrolManager...')
        const { PatrolManager } = await import('./PatrolManager.js')
        
        log('Loading PatrolEffects...')
        const { PatrolEffects } = await import('./PatrolEffects.js')
        
        log('Loading PatrolDetection...')
        const { PatrolDetection } = await import('./PatrolDetection.js')
        
        log('Loading PatrolSocket...')
        const { PatrolSocket } = await import('./PatrolSocket.js')
        
        log('Loading GMHubApp...')
        const { GMHubApp } = await import('./apps/GMHubApp.js')
        
        // Load new feature systems
        log('Loading CaptureSystem...')
        const { captureSystem, CAPTURE_OUTCOMES } = await import('./CaptureSystem.js')
        
        log('Loading BarkSystem...')
        const { barkSystem, BARK_TYPES } = await import('./BarkSystem.js')
        
        log('Loading TelegraphSystem...')
        const { telegraphSystem, TELEGRAPH_TYPES } = await import('./TelegraphSystem.js')
        
        log('Loading JailSystem...')
        const { jailSystem, JAIL_CONFIGS } = await import('./JailSystem.js')
        
        log('Loading ReinforcementSystem...')
        const { ReinforcementSystem } = await import('./ReinforcementSystem.js')
        log('Loading AI service...')
        const { default: AIService } = await import('./AI.js')
        
        log('Loading ConflictDetector...')
        const { ConflictDetector, initConflictDetection } = await import('./ConflictDetector.js')
        
        // Load system adapters and expose them for QA
        const { getAdapter, adapters } = await import('./systemAdapters/index.js')
        
        log('All imports successful!')
        
        // Store in API
        moduleAPI.Waypoint = Waypoint
        moduleAPI.Patrol = Patrol
        moduleAPI.PatrolManager = PatrolManager
        moduleAPI.PatrolEffects = PatrolEffects
        moduleAPI.PatrolDetection = PatrolDetection
        moduleAPI.PatrolSocket = PatrolSocket
        moduleAPI.GMHubApp = GMHubApp
        
        // Store new systems (with both naming conventions)
        moduleAPI.capture = captureSystem
        moduleAPI.barks = barkSystem
        moduleAPI.telegraph = telegraphSystem
        moduleAPI.jail = jailSystem
        
        // Aliases for GM Hub compatibility
        moduleAPI.captureSystem = captureSystem
        moduleAPI.barkSystem = barkSystem
        moduleAPI.telegraphSystem = telegraphSystem
        moduleAPI.jailSystem = jailSystem
        
        // Store constants
        moduleAPI.CAPTURE_OUTCOMES = CAPTURE_OUTCOMES
        moduleAPI.BARK_TYPES = BARK_TYPES
        moduleAPI.TELEGRAPH_TYPES = TELEGRAPH_TYPES
        moduleAPI.JAIL_CONFIGS = JAIL_CONFIGS
        
        // Create reinforcement system instance
        const reinforcementSystem = new ReinforcementSystem()
        moduleAPI.reinforcements = reinforcementSystem
        moduleAPI.reinforcementSystem = reinforcementSystem
        moduleAPI.aiService = AIService
        moduleAPI.systemAdapters = { getAdapter, adapters }
        
        // Register the hub opener
        moduleAPI.openHub = () => GMHubApp.open()
        
        // Initialize manager
        moduleAPI.manager = new PatrolManager()
        await moduleAPI.manager.initialize()
        
        // Initialize new systems
        captureSystem.initialize()
        barkSystem.initialize()
        telegraphSystem.initialize()
        jailSystem.initialize()
        reinforcementSystem.initialize()
        try {
            if (moduleAPI.aiService && typeof moduleAPI.aiService.initialize === 'function') moduleAPI.aiService.initialize()
        } catch (err) {}
        
        // Initialize conflict detection
        initConflictDetection()
        
        // Initialize socket handler with manager reference
        PatrolSocket.initialize(moduleAPI.manager)
        
        // Request sync from GM if we're a player
        if (!game.user.isGM) {
            PatrolSocket.requestSync()
        }
        
        log('All systems loaded successfully')
        
        // Notify that module is fully ready
        Hooks.callAll('rnkPatrolReady', moduleAPI)
        
    } catch (err) {
        error('Failed to load systems:', err)
    }
})

/**
 * Save scene patrol state before leaving
 * This captures runtime state like token positions and active status
 */
Hooks.on('preUpdateScene', async (scene, changes) => {
    // Only care about navigation changes (switching to another scene)
    if (!changes.active) return
    if (!game.user.isGM || !game.rnkPatrol?.manager) return
    
    const currentSceneId = canvas.scene?.id
    if (!currentSceneId || currentSceneId === scene.id) return
    
    debug('Saving scene state before leaving:', canvas.scene?.name)
    
    try {
        await game.rnkPatrol.manager.saveSceneState(currentSceneId)
    } catch (err) {
        error('Failed to save scene state:', err)
    }
})

/**
 * Canvas ready - reload patrols and waypoints for the current scene
 * This hook fires when the canvas is ready (initial load or scene switch)
 */
Hooks.on('canvasReady', async () => {
    if (!game.rnkPatrol?.manager) return
    
    log('Canvas ready - loading patrols for scene:', canvas.scene?.name)
    
    try {
        await game.rnkPatrol.manager.loadScenePatrols(canvas.scene.id)
        
        // Check if we have saved state to restore
        if (game.user.isGM) {
            const savedState = game.rnkPatrol.manager.getSavedSceneState(canvas.scene.id)
            if (savedState) {
                await game.rnkPatrol.manager.promptRestoreState(savedState)
            }
        }
    } catch (err) {
        error('Failed to load patrols on canvas ready:', err)
    }
})

// Register handlebar helper for formatting date (used by GM Hub)
try { Handlebars.registerHelper('formatDate', (ts) => new Date(ts).toLocaleString()) } catch (e) {}

// Expose QA methods on ready
Hooks.once('ready', () => {
    // Expose a small QA method to simulate guard spawn for a scene
    game.rnkPatrol.simulateGuardSpawn = async function(sceneId, options = {}) {
        return await game.rnkPatrol.jailSystem?.simulateGuardSpawn(sceneId, options)
    }
    // Expose QA methods for AI decisions
    game.rnkPatrol.simulateAiDecision = async function(type, payload) {
        try {
            if (type === 'bribery') {
                return await moduleAPI.aiService.decideBribery(payload)
            } else if (type === 'captureOutcome') {
                return await moduleAPI.aiService.decideCaptureOutcome(payload)
            } else if (type === 'combatAction') {
                return await moduleAPI.aiService.decideCombatAction(payload)
            }
            return null
        } catch (err) { return null }
    }
    // AI logging helper
    moduleAPI.logAiDecision = async function(entry) {
        try {
            if (!entry || typeof entry !== 'object') return false
            const key = 'aiLog'
            const maxEntries = game.settings.get(MODULE_ID, 'aiLogMaxEntries') || 200
            const current = game.settings.get(MODULE_ID, key) || []
            const item = Object.assign({ timestamp: Date.now() }, entry)
            current.unshift(item)
            // Keep capped
            const trimmed = current.slice(0, maxEntries)
            await game.settings.set(MODULE_ID, key, trimmed)
            return item
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to log AI decision`, err)
            return false
        }
    }
    moduleAPI.updateAiLogEntry = async function(timestamp, updates) {
        const key = 'aiLog'
        const current = game.settings.get(MODULE_ID, key) || []
        const idx = current.findIndex(e => e.timestamp === timestamp)
        if (idx === -1) return false
        const item = current[idx]
        const newItem = Object.assign({}, item, updates)
        current[idx] = newItem
        await game.settings.set(MODULE_ID, key, current)
        return true
    }
    moduleAPI.getAiLog = () => game.settings.get(MODULE_ID, 'aiLog') || []
    // Perform an undo for a given AI log entry using adapter helpers; attempts to restore items/gold/hp/tokens and returns result
    moduleAPI.undoAiLogEntry = async function(entry) {
        if (!entry || !entry.undo) return { success: false, errors: ['No undo payload'] }
        const errors = []
        const actions = Array.isArray(entry.undo.actions) ? entry.undo.actions : [entry.undo]
        const revertActions = []
        for (const a of actions) {
            try {
                if (a.action === 'restoreToken' && a.tokenDoc) {
                    const tokenDoc = a.tokenDoc
                    const { _id, ...clean } = tokenDoc
                    const created = await canvas.scene.createEmbeddedDocuments('Token', [clean])
                    if (Array.isArray(created) && created[0]) {
                        // push a revert so we can delete the created token if later steps fail
                        revertActions.push({ type: 'token', tokenId: created[0].id })
                    }
                    continue
                }
                if (a.action === 'unhideToken' && a.tokenDoc) {
                    const tokenId = a.tokenDoc._id
                    const token = canvas.tokens.get(tokenId)
                    if (token) await token.document.update({ hidden: false })
                    continue
                }
                if (a.action === 'restoreGold' && a.actorId) {
                    const actor = game.actors.get(a.actorId)
                    revertActions.push({ type: 'gold', actorId: a.actorId, prev: a.before })
                    if (actor) {
                        const adapter = moduleAPI.systemAdapters?.getAdapter?.(actor.system?.id || game.system.id)
                        if (adapter && typeof adapter.setActorGold === 'function') {
                            await adapter.setActorGold(actor, Number(a.before || 0))
                        } else if (moduleAPI.captureSystem && moduleAPI.captureSystem._getActorGold) {
                            const current = moduleAPI.captureSystem._getActorGold(actor)
                            const delta = Number(a.before || 0) - Number(current || 0)
                            if (delta > 0 && moduleAPI.captureSystem._addGold) await moduleAPI.captureSystem._addGold(actor, delta)
                            else if (delta < 0 && moduleAPI.captureSystem._removeGold) await moduleAPI.captureSystem._removeGold(actor, Math.abs(delta))
                        } else {
                            if (actor.system?.currency?.gp !== undefined) await actor.update({ 'system.currency.gp': a.before })
                            else if (actor.system?.details?.wealth?.value !== undefined) await actor.update({ 'system.details.wealth.value': a.before })
                            else if (actor.system?.gold !== undefined) await actor.update({ 'system.gold': a.before })
                        }
                    }
                    continue
                }
                if (a.action === 'releasePrisoner' && a.actorId) {
                    if (moduleAPI.jailSystem) await moduleAPI.jailSystem.releasePrisoner(a.actorId, { returnToOriginal: true, clearRecord: true })
                    continue
                }
                if (a.action === 'restoreItem' && a.actorId && a.itemData) {
                    const adapter = moduleAPI.systemAdapters?.getAdapter?.(game.actors.get(a.actorId)?.system?.id || game.system.id)
                    revertActions.push({ type: 'item', actorId: a.actorId, itemId: a.itemData._id, prev: a.itemData })
                    if (adapter && typeof adapter.restoreItemToActor === 'function') {
                        const actor = game.actors.get(a.actorId)
                        await adapter.restoreItemToActor(actor, a.itemData)
                    } else if (moduleAPI.captureSystem && moduleAPI.captureSystem._restoreItem) {
                        await moduleAPI.captureSystem._restoreItem(a.actorId, a.itemData)
                    } else {
                        const actor = game.actors.get(a.actorId)
                        if (actor && a.itemData?.itemData) await actor.createEmbeddedDocuments('Item', [a.itemData.itemData])
                    }
                    continue
                }
                if (a.actorId && (a.before !== undefined || a.after !== undefined)) {
                    const actor = game.actors.get(a.actorId)
                    revertActions.push({ type: 'hp', actorId: a.actorId, prev: a.before })
                    if (actor) {
                        const adapter = moduleAPI.systemAdapters?.getAdapter?.(actor.system?.id || game.system.id)
                        const targetHp = a.before !== undefined ? Number(a.before) : Number(a.after || 0)
                        if (adapter && typeof adapter.restoreDamage === 'function') {
                            await adapter.restoreDamage(actor, a)
                        } else if (adapter && typeof adapter.setActorHp === 'function') {
                            await adapter.setActorHp(actor, targetHp)
                        } else if (a.hpPath) {
                            await actor.update({ [a.hpPath]: a.before })
                        }
                    }
                    continue
                }
                errors.push(`Unknown undo action: ${JSON.stringify(a)}`)
            } catch (err) {
                errors.push(err.message || String(err))
                // Attempt to revert previous actions
                for (let k = revertActions.length - 1; k >= 0; k--) {
                    const ra = revertActions[k]
                    try {
                        if (ra.type === 'gold' && ra.actorId) {
                            const aAct = game.actors.get(ra.actorId)
                            const adapter = moduleAPI.systemAdapters?.getAdapter?.(aAct.system?.id || game.system.id)
                            if (adapter && typeof adapter.setActorGold === 'function') {
                                await adapter.setActorGold(aAct, ra.prev)
                            } else if (moduleAPI.captureSystem && moduleAPI.captureSystem._setActorGold) {
                                await moduleAPI.captureSystem._setActorGold(aAct, ra.prev)
                            }
                        }
                        if (ra.type === 'hp' && ra.actorId) {
                            const aAct = game.actors.get(ra.actorId)
                            const adapter = moduleAPI.systemAdapters?.getAdapter?.(aAct.system?.id || game.system.id)
                            if (adapter && typeof adapter.setActorHp === 'function') {
                                await adapter.setActorHp(aAct, ra.prev)
                            }
                        }
                        if (ra.type === 'item' && ra.actorId) {
                            const aAct = game.actors.get(ra.actorId)
                            const adapter = moduleAPI.systemAdapters?.getAdapter?.(aAct.system?.id || game.system.id)
                            if (adapter && typeof adapter.removeItemFromActor === 'function') {
                                try { await adapter.removeItemFromActor(aAct, ra.itemId) } catch(e) {}
                            }
                        }
                        if (ra.type === 'token') {
                            try {
                                if (ra.tokenDoc) await canvas.scene.createEmbeddedDocuments('Token', [ra.tokenDoc])
                                if (ra.tokenId) await canvas.scene.deleteEmbeddedDocuments('Token', [ra.tokenId])
                            } catch (e) {}
                        }
                    } catch (e) { /* best-effort revert; ignore errors */ }
                }
            }
        }
        return { success: errors.length === 0, errors }
    }
    moduleAPI.pushPendingAction = async function(entry) {
        const key = 'aiPending'
        const maxEntries = game.settings.get(MODULE_ID, 'aiPendingMaxEntries') || 100
        const current = game.settings.get(MODULE_ID, key) || []
        const item = Object.assign({ timestamp: Date.now() }, entry)
        current.unshift(item)
        const trimmed = current.slice(0, maxEntries)
        await game.settings.set(MODULE_ID, key, trimmed)
        return true
    }
    moduleAPI.getPendingActions = () => game.settings.get(MODULE_ID, 'aiPending') || []
    moduleAPI.popPendingAction = async function(index) {
        const key = 'aiPending'
        const current = game.settings.get(MODULE_ID, key) || []
        if (index === undefined || index === null) index = 0
        const entry = current[index]
        const newArr = current.filter((_, i) => i !== index)
        await game.settings.set(MODULE_ID, key, newArr)
        return entry
    }
    // QA helper: simulate pushing and popping a pending action
    game.rnkPatrol.simulatePendingFlow = async function() {
        const testEntry = { type: 'test', message: 'test pending', payload: { foo: 'bar' }, timestamp: Date.now() }
        await game.rnkPatrol.pushPendingAction(testEntry)
        const pending = moduleAPI.getPendingActions()
        const popped = await moduleAPI.popPendingAction(0)
        return { pushed: pending.length > 0, popped }
    }
    game.rnkPatrol.simulateBribeFlow = async function(actorId, bribeAmount, patrolId) {
        const actor = game.actors.get(actorId)
        if (!actor) return null
        const patrol = moduleAPI.manager.getPatrol(patrolId)
        const playerToken = canvas.tokens.placeables.find(t => t.actor?.id === actorId)
        const accepted = await moduleAPI.aiService.decideBribery({ bribeAmount, playerGold: moduleAPI.captureSystem._getActorGold(actor), baseCost: getSetting('briberyBaseCost', 50), patrolScale: 1, aggressiveness: patrol?.aggressiveness })
        const requiresApproval = (patrol?.automateRequireApproval === true) || (patrol?.automateRequireApproval === null && getSetting('automateRequireApproval', false))
        if (requiresApproval) {
            await moduleAPI.pushPendingAction({ type: 'bribery', message: `AI suggests ${accepted ? 'accept' : 'reject'} bribe for ${actor.name}`, payload: { accepted, bribeAmount, playerId: playerToken?.id || null, patrolId: patrol?.id || null }, timestamp: Date.now() })
            return { queued: true }
        }
        return { accepted }
    }
    game.rnkPatrol.simulateUndoEntry = async function(actorId, amount) {
        const entry = { type: 'theft', message: 'Simulated theft', payload: { actorId, amount }, timestamp: Date.now(), provider: 'local', undo: { actions: [{ action: 'restoreGold', actorId, before: 0, after: amount }] } }
        await moduleAPI.logAiDecision(entry)
        return entry
    }
    game.rnkPatrol.simulateTheftUndoFlow = async function(actorId, amount) {
        const entry = { type: 'theft', message: 'Simulated theft', payload: { actorId, amount }, timestamp: Date.now(), provider: 'local', undo: { actions: [{ action: 'restoreGold', actorId, before: 0, after: amount }] } }
        await moduleAPI.logAiDecision(entry)
        // Immediately call undo via GMHub undo handler if present
        return entry
    }
    // Centralized test runner by ID
    moduleAPI.runTestById = async function(testId) {
        try {
            switch (testId) {
                case 'simulatePending': {
                    return await moduleAPI.simulatePendingFlow()
                }
                case 'simulateBribe': {
                    // Use a selected token if available
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0];
                    if (!token) return { error: 'No token selected' }
                    return await moduleAPI.simulateBribeFlow(token.actor.id, getSetting('briberyBaseCost', 50), moduleAPI.manager.getPatrolForToken(token.id)?.id)
                }
                case 'simulateUndo': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0];
                    if (!token) return { error: 'No token selected' }
                    return await moduleAPI.simulateUndoEntry(token.actor.id, 10)
                }
                case 'adapterTest': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0];
                    if (!token) return { error: 'No token selected' }
                    const adapter = moduleAPI.systemAdapters.getAdapter(token.actor?.system?.id || game.system.id)
                    const hp = adapter?.getActorHp?.(token)
                    const maxHp = adapter?.getActorMaxHp?.(token)
                    const ac = adapter?.getActorAc?.(token.actor)
                    const items = adapter?.getAttackItems?.(token.actor) || []
                    const est = await adapter?.estimateBestAttackForToken?.(token)
                    return { hp, maxHp, ac, items: items.length, est }
                }
                case 'simulateMultiUndo': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
                    if (!token) return { error: 'No token selected' }
                    const actor = token.actor
                    const adapter = moduleAPI.systemAdapters.getAdapter(actor?.system?.id || game.system.id)
                    const beforeGold = adapter.getActorGold?.(actor) ?? moduleAPI.captureSystem?._getActorGold?.(actor) ?? 0
                    const stealAmount = Math.max(1, Math.floor((beforeGold || 10) * 0.1))
                    // steal gold
                    if (adapter.removeActorGold) await adapter.removeActorGold(actor, stealAmount)
                    else if (moduleAPI.captureSystem && moduleAPI.captureSystem._removeGold) await moduleAPI.captureSystem._removeGold(actor, stealAmount)
                    // optionally remove an item
                    let removedItemData = null
                    const item = actor.items?.find(i => i.type === 'weapon' || i.type === 'equipment' || i.type === 'item')
                    if (item) {
                        removedItemData = item.toObject()
                        if (typeof adapter.removeItemFromActor === 'function') await adapter.removeItemFromActor(actor, item.id)
                        else await actor.deleteEmbeddedDocuments('Item', [item.id])
                    }
                    const afterGold = adapter.getActorGold?.(actor) ?? moduleAPI.captureSystem?._getActorGold?.(actor) ?? 0
                    const undoActions = [{ action: 'restoreGold', actorId: actor.id, before: beforeGold, after: afterGold }]
                    if (removedItemData) undoActions.push({ action: 'restoreItem', actorId: actor.id, itemData: removedItemData })
                    const entry = { type: 'theft', message: `Simulated theft of ${stealAmount} gold${removedItemData ? ' + item' : ''}`, payload: { actorId: actor.id, amount: stealAmount }, timestamp: Date.now(), provider: 'local', undo: { actions: undoActions } }
                    await moduleAPI.logAiDecision(entry)
                    // perform undo
                    const res = await moduleAPI.undoAiLogEntry(entry)
                    return { res, beforeGold, afterGold, finalGold: adapter.getActorGold?.(actor) }
                }
                case 'midiTest': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0];
                    const target = canvas.tokens.placeables.find(t => t.id !== token?.id)
                    if (!token || !target) return { error: 'Select attacker and ensure a target exists' }
                    const adapter = moduleAPI.systemAdapters.getAdapter(token.actor?.system?.id || game.system.id)
                    const items = adapter?.getAttackItems?.(token.actor) || []
                    if (!items.length) return { error: 'No attack items found' }
                    const workflow = await adapter.rollItemUse(items[0], token, [target])
                    return { workflow: !!workflow }
                }
                case 'autoResolve': {
                    const selected = canvas.tokens.controlled || []
                    if (selected.length < 2) return { error: 'Select at least 2 tokens' }
                    const combat = await Combat.create({ scene: canvas.scene.id, active: true })
                    await combat.createEmbeddedDocuments('Combatant', selected.slice(0,2).map(t => ({ tokenId: t.id, actorId: t.actor?.id })))
                    await moduleAPI.aiService.autoResolveCombat(combat)
                    return { success: true }
                }
                default: return { error: 'Unknown test' }
            }
        } catch (err) { return { error: err?.message || String(err) } }
    }
    moduleAPI.runAllTests = async function() { 
        const tests = [ 'simulatePending', 'simulateBribe', 'simulateUndo', 'simulateMultiUndo', 'adapterTest', 'midiTest', 'autoResolve' ]
        const results = {}
        for (const t of tests) results[t] = await moduleAPI.runTestById(t)
        return results
    }
})

/**
 * Handle canvas ready - restore patrols for scene
 */
Hooks.on('canvasReady', async () => {
    if (!moduleAPI.manager) return
    
    debug('Canvas ready - loading scene patrols')
    await moduleAPI.manager.loadScenePatrols(canvas.scene.id)
})

/**
 * Handle canvas teardown - cleanup
 */
Hooks.on('canvasTearDown', () => {
    if (!moduleAPI.manager) return
    
    debug('Canvas teardown - cleaning up')
    moduleAPI.manager.cleanup()
})

/**
 * Inject GM Hub button into hotbar slot 5
 */
Hooks.on('renderHotbar', (hotbar, html) => {
    if (!game.user.isGM) return
    
    // Find slot 5 in the hotbar
    const slot5 = html.querySelector ? 
        html.querySelector('[data-slot="5"]') : 
        html.find('[data-slot="5"]')[0]
    
    if (!slot5) return
    
    // Replace slot 5 with our custom GM Hub button
    slot5.classList.remove('open')
    slot5.classList.add('full', 'rnk-patrol-hub-slot')
    slot5.innerHTML = `
        <i class="fas fa-satellite-dish slot-icon" style="font-size: 24px; color: #e94560;"></i>
        <span class="key">5</span>
    `
    slot5.dataset.tooltip = 'RNK Patrol Command Hub'
    slot5.setAttribute('data-tooltip-text', 'RNK Patrol Command Hub')
    
    // Remove default click handler and add our own
    const newSlot = slot5.cloneNode(true)
    slot5.parentNode.replaceChild(newSlot, slot5)
    
    newSlot.addEventListener('click', async (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        
        // Try to open the hub
        if (game.rnkPatrol?.openHub) {
            game.rnkPatrol.openHub()
        } else {
            // Fallback: load GMHubApp directly if not yet initialized
            try {
                const { GMHubApp } = await import('./apps/GMHubApp.js')
                GMHubApp.open()
            } catch (err) {
                console.error('RNK Patrol | Failed to open GM Hub:', err)
                ui.notifications.error('Failed to open Patrol Hub. Check console for details.')
            }
        }
    })
    
    // Style it distinctively
    newSlot.style.background = 'linear-gradient(145deg, #1a1a2e, #0f3460)'
    newSlot.style.borderColor = '#e94560'
    newSlot.style.boxShadow = '0 0 8px rgba(233, 69, 96, 0.4)'
})

/**
 * Add patrol controls to token layer
 */
Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return
    
    // Foundry V13: controls is a SceneControls instance with a .controls Map
    // Foundry V12 and earlier: controls is an array
    let tokenControls
    
    if (controls.controls instanceof Map) {
        // Foundry V13+: SceneControls object with .controls Map
        tokenControls = controls.controls.get('token')
    } else if (Array.isArray(controls)) {
        // Foundry V12 and earlier: direct array
        tokenControls = controls.find(c => c.name === 'token')
    } else if (typeof controls.get === 'function') {
        // Fallback: controls itself might be a Map
        tokenControls = controls.get('token')
    }
    
    if (!tokenControls) return
    
    // Define the tools
    const patrolHubTool = {
        name: 'patrol-hub',
        title: i18n('controls.hub'),
        icon: 'fas fa-satellite-dish',
        button: true,
        onClick: () => openPatrolManager()
    }
    const createWaypointTool = {
        name: 'create-waypoint',
        title: i18n('controls.createWaypoint'),
        icon: 'fas fa-map-pin',
        button: true,
        onClick: () => createWaypointAtCursor()
    }
    
    // Add tools based on the structure
    if (tokenControls.tools instanceof Map) {
        // Foundry V13: tools is a Map
        tokenControls.tools.set('patrol-hub', patrolHubTool)
        tokenControls.tools.set('create-waypoint', createWaypointTool)
    } else if (Array.isArray(tokenControls.tools)) {
        // Foundry V12: tools is an array
        tokenControls.tools.push(patrolHubTool, createWaypointTool)
    }
})

/**
 * Token right-click context menu
 */
Hooks.on('getTokenContextOptions', (html, options) => {
    if (!game.user.isGM) return
    
    options.push(
        {
            name: i18n('context.assignPatrol'),
            icon: '<i class="fas fa-route"></i>',
            condition: () => true,
            callback: (li) => {
                const token = canvas.tokens.get(li.data('tokenId'))
                if (token) openPatrolAssignment(token)
            }
        },
        {
            name: i18n('context.createPatrolHere'),
            icon: '<i class="fas fa-plus-circle"></i>',
            condition: () => true,
            callback: (li) => {
                const token = canvas.tokens.get(li.data('tokenId'))
                if (token) createPatrolFromToken(token)
            }
        }
    )
})

// ============================================
// Socket Event Handlers
// ============================================

async function handlePatrolUpdate(data) {
    const patrol = moduleAPI.manager?.getPatrol(data.patrolId)
    if (patrol) {
        patrol.syncFromRemote(data)
    }
}

async function handleWaypointTrigger(data) {
    const patrol = moduleAPI.manager?.getPatrol(data.patrolId)
    if (patrol) {
        await patrol.handleWaypointTrigger(data.waypointId, data.remote)
    }
}

async function handleTokenAppear(data) {
    const { PatrolEffects } = moduleAPI
    if (PatrolEffects && canvas.ready) {
        await PatrolEffects.playAppearEffect(data)
    }
}

async function handleTokenDisappear(data) {
    const { PatrolEffects } = moduleAPI
    if (PatrolEffects && canvas.ready) {
        await PatrolEffects.playDisappearEffect(data)
    }
}

async function handleAlertTriggered(data) {
    const patrol = moduleAPI.manager?.getPatrol(data.patrolId)
    if (patrol) {
        await patrol.handleAlert(data)
    }
}

// ============================================
// UI Helper Functions
// ============================================

async function openPatrolManager() {
    const { GMHubApp } = await import('./apps/GMHubApp.js')
    GMHubApp.open()
}

async function createWaypointAtCursor() {
    if (!canvas.ready) return
    
    const pos = canvas.mousePosition
    const { Waypoint } = moduleAPI
    
    if (Waypoint) {
        const waypoint = await Waypoint.create({
            x: pos.x,
            y: pos.y,
            sceneId: canvas.scene.id
        })
        debug('Created waypoint:', waypoint)
    }
}

async function openPatrolAssignment(token) {
    const { PatrolAssignmentApp } = await import('./apps/PatrolAssignmentApp.js')
    new PatrolAssignmentApp(token).render(true)
}

async function createPatrolFromToken(token) {
    const { PatrolCreatorApp } = await import('./apps/PatrolCreatorApp.js')
    new PatrolCreatorApp({ token }).render(true)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all active GMs sorted by ID
 * @returns {User[]}
 */
export function getActiveGMs() {
    return [...game.users.values()]
        .filter(u => u.active && u.isGM)
        .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Check if current user is the primary GM (first in sorted list)
 * @returns {boolean}
 */
export function isPrimaryGM() {
    const gms = getActiveGMs()
    return gms.length > 0 && gms[0].id === game.user.id
}

/**
 * Emit socket event to all clients
 * @param {string} eventName 
 * @param {Object} data 
 */
export function emitSocket(eventName, data) {
    game.socket.emit(`module.${MODULE_ID}`, { 
        type: eventName, 
        payload: data,
        userId: game.user.id 
    })
}

/**
 * Emit socket event and handle locally if primary GM
 * @param {string} eventName 
 * @param {Object} data 
 * @param {Function} handler 
 */
export async function emitAndHandle(eventName, data, handler) {
    emitSocket(eventName, data)
    if (isPrimaryGM() && handler) {
        await handler(data)
    }
}
