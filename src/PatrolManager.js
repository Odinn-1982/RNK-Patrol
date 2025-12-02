/**
 * RNK Patrol - Patrol Manager
 * 
 * Central manager for all patrols in the current scene.
 * Handles loading, saving, and coordinating multiple patrols.
 * 
 * @module PatrolManager
 */

import { MODULE_ID, debug, warn, error, isPrimaryGM } from './main.js'
import { getSetting } from './settings.js'
import { Patrol } from './Patrol.js'
import { Waypoint } from './Waypoint.js'

/**
 * PatrolManager - manages all patrols in the scene
 */
export class PatrolManager {
    
    constructor() {
        /**
         * Active patrols map (id -> Patrol)
         * @type {Map<string, Patrol>}
         */
        this._patrols = new Map()
        
        /**
         * Current scene ID
         * @type {string|null}
         */
        this._currentSceneId = null
        
        /**
         * Initialization state
         * @type {boolean}
         */
        this._initialized = false
        
        /**
         * Update loop interval
         * @type {number|null}
         */
        this._updateInterval = null
    }
    
    // ==========================================
    // Initialization
    // ==========================================
    
    /**
     * Initialize the manager
     */
    async initialize() {
        if (this._initialized) return
        
        debug('Initializing PatrolManager')
        
        // Load patrols for current scene
        if (canvas.ready) {
            await this.loadScenePatrols(canvas.scene.id)
        }
        
        // Start update loop
        this._startUpdateLoop()
        
        // Register hooks
        this._registerHooks()
        
        this._initialized = true
        debug('PatrolManager initialized')
    }
    
    /**
     * Register Foundry hooks
     */
    _registerHooks() {
        // Token deletion - remove from patrols
        Hooks.on('deleteToken', (tokenDoc) => {
            this._handleTokenDelete(tokenDoc)
        })
        
        // Token update - track movement
        Hooks.on('updateToken', (tokenDoc, changes) => {
            this._handleTokenUpdate(tokenDoc, changes)
        })
        
        // Scene update - refresh waypoints
        Hooks.on('updateScene', (scene, changes) => {
            if (scene.id === this._currentSceneId && changes.flags?.[MODULE_ID]) {
                this._refreshWaypoints()
            }
        })
    }
    
    /**
     * Start the manager update loop
     */
    _startUpdateLoop() {
        const interval = getSetting('updateInterval', 500)
        
        this._updateInterval = setInterval(() => {
            this._update()
        }, interval)
    }
    
    /**
     * Stop the update loop
     */
    _stopUpdateLoop() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval)
            this._updateInterval = null
        }
    }
    
    /**
     * Main update tick
     */
    _update() {
        if (!canvas.ready || !isPrimaryGM()) return
        
        // Update all active patrols
        for (const patrol of this._patrols.values()) {
            if (patrol.isActive) {
                // Patrols manage their own timing, this is for coordination
            }
        }
    }
    
    // ==========================================
    // Scene Management
    // ==========================================
    
    /**
     * Load patrols for a scene
     * @param {string} sceneId 
     */
    async loadScenePatrols(sceneId) {
        debug(`Loading patrols for scene: ${sceneId}`)
        
        // Cleanup current patrols
        await this.cleanup()
        
        this._currentSceneId = sceneId
        
        // Load patrol data from settings
        const allPatrols = game.settings.get(MODULE_ID, 'scenePatrolData') || {}
        const scenePatrolData = allPatrols[sceneId] || []
        
        // Create patrol instances
        for (const data of scenePatrolData) {
            const patrol = Patrol.fromData(data)
            patrol._manager = this
            this._patrols.set(patrol.id, patrol)

            // If guard source is actors and patrol has no token assigned, auto-create a token
            try {
                const guardSource = getSetting('guardSource')
                if (!patrol.tokenId && guardSource === 'actors' && isPrimaryGM()) {
                    const jailSystem = game.rnkPatrol?.jailSystem
                    const actor = patrol.guardActorId ? game.actors.get(patrol.guardActorId) : jailSystem?.getRandomNpcActor(sceneId)
                    if (actor && canvas.scene) {
                        const targetLevel = patrol._lastTargetLevel || 5
                        const actorData = jailSystem._scaleActorData(actor.toObject(), targetLevel)
                        // Determine spawn position using first waypoint or center of canvas
                        let x = canvas.grid?.center?.x || 100
                        let y = canvas.grid?.center?.y || 100
                        const firstWp = patrol.getWaypoint?.(patrol.waypointIds?.[0])
                        if (firstWp) {
                            x = firstWp.x
                            y = firstWp.y
                        }
                        const tokenData = {
                            name: actor.name,
                            x,
                            y,
                            width: 1,
                            height: 1,
                            disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
                            actorData,
                            actorLink: false,
                            flags: {
                                [MODULE_ID]: {
                                    isPatrolToken: true,
                                    sourcePatrolId: patrol.id,
                                    guardActorId: actor.id
                                }
                            }
                        }
                        const [created] = await canvas.scene.createEmbeddedDocuments('Token', [tokenData])
                        if (created) {
                            patrol.tokenId = created.id
                            await patrol.save()
                        }
                    }
                }
            } catch (err) {
                // Non-fatal
            }
        }
        
        debug(`Loaded ${this._patrols.size} patrols`)
        
        // Load and display waypoints
        this._refreshWaypoints()
        
        // Auto-start patrols that were active
        if (isPrimaryGM()) {
            for (const patrol of this._patrols.values()) {
                if (patrol.state === 'active' && !patrol.disabled) {
                    await patrol.start()
                }
            }
        }
        
        Hooks.callAll('rnkPatrol.patrolsLoaded', this, sceneId)
    }
    
    /**
     * Refresh waypoint visualizations
     */
    _refreshWaypoints() {
        if (!canvas.ready) return
        
        const waypoints = Waypoint.getSceneWaypoints(this._currentSceneId)
        
        for (const waypoint of waypoints) {
            waypoint.updateVisual()
        }
    }
    
    /**
     * Cleanup - stop all patrols and clear state
     */
    async cleanup() {
        debug('Cleaning up PatrolManager')
        
        // Stop all patrols
        for (const patrol of this._patrols.values()) {
            await patrol.stop()
        }
        
        this._patrols.clear()
        
        // Remove waypoint visuals
        if (canvas.ready) {
            const waypoints = Waypoint.getSceneWaypoints(this._currentSceneId)
            for (const waypoint of waypoints) {
                waypoint.removeVisual()
            }
        }
    }
    
    // ==========================================
    // Patrol CRUD
    // ==========================================
    
    /**
     * Create a new patrol
     * @param {Object} config 
     * @returns {Promise<Patrol>}
     */
    async createPatrol(config) {
        if (!game.user.isGM) {
            throw new Error('Only GMs can create patrols')
        }
        
        // Check max patrol limit
        const maxPatrols = getSetting('maxActivePatrols', 20)
        if (this._patrols.size >= maxPatrols) {
            warn(`Maximum patrol limit reached (${maxPatrols})`)
            ui.notifications.warn(game.i18n.format(`${MODULE_ID}.notifications.maxPatrols`, { max: maxPatrols }))
            return null
        }
        
        // Create patrol
        const patrol = new Patrol({
            ...config,
            sceneId: this._currentSceneId
        })
        
        patrol._manager = this
        
        // Save and add to map
        await patrol.save()
        this._patrols.set(patrol.id, patrol)
        
        debug(`Created patrol: ${patrol.name}`)
        Hooks.callAll('rnkPatrol.patrolCreated', patrol)
        
        return patrol
    }
    
    /**
     * Get patrol by ID
     * @param {string} id 
     * @returns {Patrol|null}
     */
    getPatrol(id) {
        return this._patrols.get(id) || null
    }
    
    /**
     * Get all patrols
     * @returns {Patrol[]}
     */
    getPatrols() {
        return [...this._patrols.values()]
    }
    
    /**
     * Get patrols by tag
     * @param {string} tag 
     * @returns {Patrol[]}
     */
    getPatrolsByTag(tag) {
        return this.getPatrols().filter(p => p.tags.includes(tag))
    }
    
    /**
     * Get patrol for a specific token
     * @param {string} tokenId 
     * @returns {Patrol|null}
     */
    getPatrolForToken(tokenId) {
        for (const patrol of this._patrols.values()) {
            if (patrol.tokenId === tokenId) {
                return patrol
            }
        }
        return null
    }
    
    /**
     * Delete a patrol
     * @param {string} patrolId 
     */
    async deletePatrol(patrolId) {
        const patrol = this._patrols.get(patrolId)
        if (!patrol) return
        
        await patrol.delete()
        this._patrols.delete(patrolId)
    }
    
    // ==========================================
    // Waypoint Management
    // ==========================================
    
    /**
     * Create a new waypoint
     * @param {Object} config 
     * @returns {Promise<Waypoint>}
     */
    async createWaypoint(config) {
        if (!game.user.isGM) {
            throw new Error('Only GMs can create waypoints')
        }
        
        const waypoint = await Waypoint.create({
            ...config,
            sceneId: this._currentSceneId
        })
        
        waypoint.updateVisual()
        
        Hooks.callAll('rnkPatrol.waypointCreated', waypoint)
        
        return waypoint
    }
    
    /**
     * Get all waypoints for current scene
     * @returns {Waypoint[]}
     */
    getWaypoints() {
        return Waypoint.getSceneWaypoints(this._currentSceneId)
    }
    
    /**
     * Get unassigned waypoints (not in any patrol)
     * @returns {Waypoint[]}
     */
    getUnassignedWaypoints() {
        const allWaypoints = this.getWaypoints()
        const assignedIds = new Set()
        
        for (const patrol of this._patrols.values()) {
            patrol.waypointIds.forEach(id => assignedIds.add(id))
        }
        
        return allWaypoints.filter(w => !assignedIds.has(w.id))
    }
    
    /**
     * Delete a waypoint
     * @param {string} waypointId 
     */
    async deleteWaypoint(waypointId) {
        // Remove from all patrols first
        for (const patrol of this._patrols.values()) {
            patrol.removeWaypoint(waypointId)
            await patrol.save()
        }
        
        // Delete the waypoint
        const waypoint = this.getWaypoints().find(w => w.id === waypointId)
        if (waypoint) {
            await waypoint.delete()
        }
    }
    
    // ==========================================
    // Bulk Operations
    // ==========================================
    
    /**
     * Start all patrols
     */
    async startAll() {
        for (const patrol of this._patrols.values()) {
            if (!patrol.isActive && !patrol.disabled) {
                await patrol.start()
            }
        }
    }
    
    /**
     * Stop all patrols
     */
    async stopAll() {
        for (const patrol of this._patrols.values()) {
            await patrol.stop()
        }
    }
    
    /**
     * Pause all patrols
     */
    async pauseAll() {
        for (const patrol of this._patrols.values()) {
            if (patrol.isActive) {
                await patrol.pause()
            }
        }
    }
    
    /**
     * Resume all patrols
     */
    async resumeAll() {
        for (const patrol of this._patrols.values()) {
            if (patrol.isPaused) {
                await patrol.resume()
            }
        }
    }
    
    /**
     * Reset all alert levels
     */
    resetAllAlerts() {
        for (const patrol of this._patrols.values()) {
            patrol.resetAlert()
        }
    }
    
    // ==========================================
    // Event Handlers
    // ==========================================
    
    /**
     * Handle token deletion
     * @param {TokenDocument} tokenDoc 
     */
    _handleTokenDelete(tokenDoc) {
        const patrol = this.getPatrolForToken(tokenDoc.id)
        if (patrol) {
            warn(`Token deleted for patrol: ${patrol.name}`)
            patrol.stop()
            patrol.tokenId = null
            patrol.save()
        }
    }
    
    /**
     * Handle token update
     * @param {TokenDocument} tokenDoc 
     * @param {Object} changes 
     */
    _handleTokenUpdate(tokenDoc, changes) {
        // If token position changed manually, check if it's a patrol token
        if (changes.x !== undefined || changes.y !== undefined) {
            const patrol = this.getPatrolForToken(tokenDoc.id)
            if (patrol && patrol.isActive) {
                // Token was moved manually during patrol - could pause or warn
                debug(`Patrol token moved manually: ${patrol.name}`)
            }
        }
    }
    
    // ==========================================
    // Import/Export
    // ==========================================
    
    /**
     * Export all patrols for current scene
     * @returns {Object}
     */
    exportPatrols() {
        const patrols = this.getPatrols().map(p => p.toJSON())
        const waypoints = this.getWaypoints().map(w => w.toJSON())
        
        return {
            version: '1.0',
            sceneId: this._currentSceneId,
            sceneName: game.scenes.get(this._currentSceneId)?.name,
            exportDate: new Date().toISOString(),
            patrols,
            waypoints
        }
    }
    
    /**
     * Import patrols to current scene
     * @param {Object} data 
     * @param {Object} options 
     */
    async importPatrols(data, options = {}) {
        if (!game.user.isGM) {
            throw new Error('Only GMs can import patrols')
        }
        
        const { replace = false, importWaypoints = true } = options
        
        // Clear existing if replace mode
        if (replace) {
            await this.cleanup()
        }
        
        // Import waypoints first
        if (importWaypoints && data.waypoints) {
            const scene = game.scenes.get(this._currentSceneId)
            const existingWaypoints = scene.getFlag(MODULE_ID, 'waypoints') || []
            
            const idMap = new Map() // old ID -> new ID
            
            for (const wpData of data.waypoints) {
                const newId = foundry.utils.randomID()
                idMap.set(wpData.id, newId)
                
                const waypoint = new Waypoint({
                    ...wpData,
                    id: newId,
                    sceneId: this._currentSceneId
                })
                
                existingWaypoints.push(waypoint.toJSON())
            }
            
            await scene.setFlag(MODULE_ID, 'waypoints', existingWaypoints)
            
            // Update waypoint IDs in patrols
            for (const patrolData of data.patrols) {
                patrolData.waypointIds = patrolData.waypointIds.map(id => idMap.get(id) || id)
            }
        }
        
        // Import patrols
        for (const patrolData of data.patrols) {
            const patrol = await this.createPatrol({
                ...patrolData,
                id: foundry.utils.randomID(), // New ID
                tokenId: null, // Tokens need to be reassigned
                state: 'idle'
            })
            
            debug(`Imported patrol: ${patrol.name}`)
        }
        
        // Refresh visuals
        this._refreshWaypoints()
        
        ui.notifications.info(
            game.i18n.format(`${MODULE_ID}.notifications.imported`, {
                patrols: data.patrols.length,
                waypoints: data.waypoints?.length || 0
            })
        )
    }
    
    // ==========================================
    // Statistics
    // ==========================================
    
    /**
     * Get patrol statistics
     * @returns {Object}
     */
    getStatistics() {
        const patrols = this.getPatrols()
        const waypoints = this.getWaypoints()
        
        return {
            totalPatrols: patrols.length,
            activePatrols: patrols.filter(p => p.isActive).length,
            pausedPatrols: patrols.filter(p => p.isPaused).length,
            alertedPatrols: patrols.filter(p => p.alertLevel > 0).length,
            disabledPatrols: patrols.filter(p => p.disabled).length,
            totalWaypoints: waypoints.length,
            unassignedWaypoints: this.getUnassignedWaypoints().length,
            blinkPatrols: patrols.filter(p => p.mode === 'blink').length,
            walkPatrols: patrols.filter(p => p.mode === 'walk').length
        }
    }
}
