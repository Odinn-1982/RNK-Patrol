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
export const log = (...args) => console.log(`${MODULE_NAME} |`, ...args)
export const debug = (...args) => {
    if (game.settings?.get(MODULE_ID, 'debugMode')) {
        console.debug(`${MODULE_NAME} [DEBUG] |`, ...args)
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
        <img class="slot-icon" src="icons/svg/radar.svg" alt="Patrol Hub">
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
    
    const tokenControls = controls.find(c => c.name === 'token')
    if (!tokenControls) return
    
    tokenControls.tools.push(
        {
            name: 'patrol-hub',
            title: i18n('controls.hub'),
            icon: 'fas fa-satellite-dish',
            button: true,
            onClick: () => openPatrolManager()
        },
        {
            name: 'create-waypoint',
            title: i18n('controls.createWaypoint'),
            icon: 'fas fa-map-pin',
            button: true,
            onClick: () => createWaypointAtCursor()
        }
    )
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
    game.socket.emit(`module.${MODULE_ID}`, { eventName, data })
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
