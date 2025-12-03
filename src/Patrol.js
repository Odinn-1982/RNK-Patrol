/**
 * RNK Patrol - Patrol Class
 *
 * Represents a single patrol route with associated token and waypoints.
 * Handles the core patrol logic including blink teleportation and walking.
 *
 * @module Patrol
 */

import {
    MODULE_ID,
    MODULE_NAME,
    debug,
    warn,
    error,
    emitSocket,
    isPrimaryGM,
    PATROL_MODES,
    PATROL_STATES,
    BLINK_PATTERNS,
    WAYPOINT_STATES
} from './main.js'
import { getSetting } from './settings.js'
import { Waypoint } from './Waypoint.js'

/**
 * Patrol class - manages a single patrol route
 */
export class Patrol {

    /**
     * @param {Object} data - Patrol configuration data
     */
    constructor(data = {}) {
        /**
         * Unique identifier
         * @type {string}
         */
        this.id = data.id || foundry.utils.randomID()

        /**
         * Display name
         * @type {string}
         */
        this.name = data.name || `Patrol ${this.id.slice(0, 4)}`

        /**
         * Scene ID this patrol operates in
         * @type {string}
         */
        this.sceneId = data.sceneId || canvas.scene?.id

        /**
         * Token ID of the patrolling guard
         * @type {string|null}
         */
        this.tokenId = data.tokenId || null

        /**
         * Current patrol state
         * @type {string}
         */
        this.state = data.state || PATROL_STATES.IDLE

        /**
         * Patrol mode (blink, walk, hybrid)
         * @type {string}
         */
        this.mode = data.mode || getSetting('defaultPatrolMode', PATROL_MODES.BLINK)

        /**
         * Pattern for blink patrols
         * @type {string}
         */
        this.blinkPattern = data.blinkPattern || getSetting('defaultBlinkPattern', BLINK_PATTERNS.RANDOM)

        /**
         * Waypoint IDs in order
         * @type {string[]}
         */
        this.waypointIds = data.waypointIds || []

        /**
         * Current waypoint index
         * @type {number}
         */
        this.currentWaypointIndex = data.currentWaypointIndex || 0

        /**
         * Direction for ping-pong pattern
         * @type {number}
         */
        this._patrolDirection = 1

        /**
         * Time visible at waypoint (seconds)
         * @type {number}
         */
        this.appearDuration = data.appearDuration ?? getSetting('defaultAppearDuration', 3)

        /**
         * Time invisible between waypoints (seconds)
         * @type {number}
         */
        this.disappearDuration = data.disappearDuration ?? getSetting('defaultDisappearDuration', 2)

        /**
         * Timing variance percentage (0-100)
         * @type {number}
         */
        this.timingVariance = data.timingVariance ?? getSetting('timingVariance', 25)

        /**
         * Detection enabled
         * @type {boolean}
         */
        this.detectEnabled = data.detectEnabled ?? getSetting('enableDetection', true)

        /**
         * What to do on detection
         * @type {string}
         */
        this.detectionAction = data.detectionAction || getSetting('detectionTrigger', 'notify')

        /**
         * Custom macro to run on detection
         * @type {string|null}
         */
        this.detectionMacro = data.detectionMacro || null

        /**
         * Effect type for appear/disappear
         * @type {string}
         */
        this.effectType = data.effectType || getSetting('defaultEffectType', 'fade')

        /**
         * Custom color for effects
         * @type {string|null}
         */
        this.color = data.color || Patrol._generatePatrolColor()

        /**
         * Tags for organization
         * @type {string[]}
         */
        this.tags = data.tags || []

        /**
         * Notes/description
         * @type {string}
         */
        this.notes = data.notes || ''

        /**
         * Disabled flag
         * @type {boolean}
         */
        this.disabled = data.disabled || false

        /**
         * Alert level (0 = normal, higher = more alert)
         * @type {number}
         */
        this.alertLevel = data.alertLevel || 0

        /**
         * Guard actor ID (optional override for spawning)
         * @type {string|null}
         */
        this.guardActorId = data.guardActorId || null

        /**
         * Automate combat for this patrol
         * @type {boolean}
         */
        this.automateCombat = data.automateCombat ?? false

        /**
         * Automate bribe/capture decisions for this patrol
         * @type {boolean}
         */
        this.automateDecisions = data.automateDecisions ?? false

        /**
         * Require GM approval for AI actions (null = inherit from global)
         * @type {boolean|null}
         */
        this.automateRequireApproval = data.automateRequireApproval ?? null

        /**
         * Aggressiveness level (conservative, normal, aggressive)
         * @type {string}
         */
        this.aggressiveness = data.aggressiveness || 'normal'

        /**
         * Detected tokens (IDs)
         * @type {Set<string>}
         */
        this._detectedTokens = new Set()

        /**
         * Interval handle for patrol loop
         * @type {number|null}
         */
        this._loopInterval = null

        /**
         * Timeout handle for current phase
         * @type {number|null}
         */
        this._phaseTimeout = null

        /**
         * Current phase ('appear', 'visible', 'disappear', 'invisible')
         * @type {string}
         */
        this._currentPhase = 'invisible'

        /**
         * Waypoint cache
         * @type {Map<string, Waypoint>}
         */
        this._waypointCache = new Map()

        /**
         * Manager reference
         * @type {PatrolManager|null}
         */
        this._manager = null
    }

    // ==========================================
    // Static Methods
    // ==========================================

    /**
     * Color palette for patrols - distinct, easily distinguishable colors
     * @type {string[]}
     */
    static PATROL_COLORS = [
        '#FF6B6B',  // Red
        '#4ECDC4',  // Teal
        '#45B7D1',  // Sky Blue
        '#96CEB4',  // Sage Green
        '#FFEAA7',  // Yellow
        '#DDA0DD',  // Plum
        '#98D8C8',  // Mint
        '#F7DC6F',  // Gold
        '#BB8FCE',  // Lavender
        '#85C1E9',  // Light Blue
        '#F8B500',  // Amber
        '#58D68D',  // Green
        '#EC7063',  // Coral
        '#5DADE2',  // Cyan
        '#AF7AC5',  // Purple
        '#48C9B0',  // Turquoise
    ]

    /**
     * Track which color index to use next
     * @type {number}
     */
    static _colorIndex = 0

    /**
     * Generate a distinct color for a new patrol
     * Cycles through the color palette
     * @returns {string}
     */
    static _generatePatrolColor() {
        const color = Patrol.PATROL_COLORS[Patrol._colorIndex % Patrol.PATROL_COLORS.length]
        Patrol._colorIndex++
        return color
    }

    /**
     * Create a new patrol and save it
     * @param {Object} data
     * @returns {Promise<Patrol>}
     */
    static async create(data) {
        const patrol = new Patrol(data)
        await patrol.save()
        return patrol
    }

    /**
     * Load patrol from stored data
     * @param {Object} data
     * @returns {Patrol}
     */
    static fromData(data) {
        return new Patrol(data)
    }

    // ==========================================
    // Properties
    // ==========================================

    /**
     * Get the scene
     * @returns {Scene|null}
     */
    get scene() {
        return game.scenes.get(this.sceneId)
    }

    /**
     * Get the patrol token
     * @returns {Token|null}
     */
    get token() {
        if (!canvas.ready || !this.tokenId) return null
        return canvas.tokens.get(this.tokenId)
    }

    /**
     * Get the token document
     * @returns {TokenDocument|null}
     */
    get tokenDocument() {
        const scene = this.scene
        if (!scene || !this.tokenId) return null
        return scene.tokens.get(this.tokenId)
    }

    /**
     * Get all waypoints
     * @returns {Waypoint[]}
     */
    get waypoints() {
        return this.waypointIds
            .map(id => this.getWaypoint(id))
            .filter(w => w !== null)
    }

    /**
     * Get current waypoint
     * @returns {Waypoint|null}
     */
    get currentWaypoint() {
        if (this.waypointIds.length === 0) return null
        const id = this.waypointIds[this.currentWaypointIndex]
        return this.getWaypoint(id)
    }

    /**
     * Check if patrol is active
     * @returns {boolean}
     */
    get isActive() {
        return this.state === PATROL_STATES.ACTIVE && !this.disabled
    }

    /**
     * Check if patrol is paused
     * @returns {boolean}
     */
    get isPaused() {
        return this.state === PATROL_STATES.PAUSED
    }

    /**
     * Check if token is currently visible
     * @returns {boolean}
     */
    get isTokenVisible() {
        return this._currentPhase === 'visible' || this._currentPhase === 'appear'
    }

    /**
     * Get effective appear duration with variance
     * @returns {number}
     */
    get effectiveAppearDuration() {
        return this._applyVariance(this.appearDuration)
    }

    /**
     * Get effective disappear duration with variance
     * @returns {number}
     */
    get effectiveDisappearDuration() {
        return this._applyVariance(this.disappearDuration)
    }

    // ==========================================
    // Waypoint Management
    // ==========================================

    /**
     * Get waypoint by ID (with caching)
     * @param {string} id
     * @returns {Waypoint|null}
     */
    getWaypoint(id) {
        if (!id) {
            warn(`getWaypoint called with no id`)
            return null
        }

        if (this._waypointCache.has(id)) {
            return this._waypointCache.get(id)
        }

        const sceneWaypoints = Waypoint.getSceneWaypoints(this.sceneId)
        debug(`getWaypoint: Looking for ${id} in ${sceneWaypoints.length} scene waypoints`)

        const waypoint = sceneWaypoints.find(w => w.id === id)

        if (waypoint) {
            waypoint._patrol = this
            this._waypointCache.set(id, waypoint)
            debug(`getWaypoint: Found waypoint ${waypoint.name} at (${waypoint.x}, ${waypoint.y})`)
        } else {
            warn(`getWaypoint: Waypoint ${id} not found in scene ${this.sceneId}`)
        }

        return waypoint || null
    }

    /**
     * Add a waypoint to the patrol
     * @param {string|Waypoint} waypoint
     */
    addWaypoint(waypoint) {
        const id = typeof waypoint === 'string' ? waypoint : waypoint.id

        if (!this.waypointIds.includes(id)) {
            this.waypointIds.push(id)
        }
    }

    /**
     * Remove a waypoint from the patrol
     * @param {string} waypointId
     */
    removeWaypoint(waypointId) {
        const index = this.waypointIds.indexOf(waypointId)
        if (index >= 0) {
            this.waypointIds.splice(index, 1)
            this._waypointCache.delete(waypointId)

            // Adjust current index if needed
            if (this.currentWaypointIndex >= this.waypointIds.length) {
                this.currentWaypointIndex = Math.max(0, this.waypointIds.length - 1)
            }
        }
    }

    /**
     * Reorder waypoints
     * @param {string[]} newOrder
     */
    reorderWaypoints(newOrder) {
        this.waypointIds = newOrder.filter(id => this.waypointIds.includes(id))
    }

    /**
     * Clear waypoint cache
     */
    clearWaypointCache() {
        this._waypointCache.clear()
    }

    // ==========================================
    // Patrol Control
    // ==========================================

    /**
     * Start the patrol
     */
    async start() {
        if (this.disabled) {
            warn(`Cannot start patrol ${this.name}: disabled`)
            return
        }

        if (this.waypointIds.length === 0) {
            warn(`Cannot start patrol ${this.name}: no waypoints configured`)
            ui.notifications.warn(`Patrol "${this.name}" has no waypoints!`)
            return
        }

        if (!this.tokenId) {
            warn(`Cannot start patrol ${this.name}: no token assigned`)
            ui.notifications.warn(`Patrol "${this.name}" has no token!`)
            return
        }

        // Verify token exists
        const token = this.token
        if (!token) {
            warn(`Cannot start patrol ${this.name}: token ${this.tokenId} not found on canvas`)
            ui.notifications.warn(`Patrol "${this.name}" token not found on scene!`)
            return
        }

        debug(`Starting patrol: ${this.name} with ${this.waypointIds.length} waypoints, token: ${token.name}`)
        console.log(`RNK Patrol | Starting patrol "${this.name}" mode="${this.mode}" waypointIds=${JSON.stringify(this.waypointIds)}`)

        this.state = PATROL_STATES.ACTIVE
        this._currentPhase = 'invisible'

        // Save state
        await this.save()

        // Start patrol loop
        await this._startPatrolLoop()

        // Emit update
        this._emitUpdate()

        Hooks.callAll('rnkPatrol.patrolStarted', this)
    }

    /**
     * Stop the patrol
     */
    async stop() {
        debug(`Stopping patrol: ${this.name}`)

        this.state = PATROL_STATES.IDLE

        // Clear intervals/timeouts
        this._clearTimers()

        // Show token at last known position if hidden
        if (this._currentPhase === 'invisible' || this._currentPhase === 'disappear') {
            await this._showToken()
        }

        this._currentPhase = 'visible'

        // Save state
        await this.save()

        // Emit update
        this._emitUpdate()

        Hooks.callAll('rnkPatrol.patrolStopped', this)
    }

    /**
     * Pause the patrol
     */
    async pause() {
        if (this.state !== PATROL_STATES.ACTIVE) return

        debug(`Pausing patrol: ${this.name}`)

        this.state = PATROL_STATES.PAUSED
        this._clearTimers()

        this._emitUpdate()

        Hooks.callAll('rnkPatrol.patrolPaused', this)
    }

    /**
     * Resume the patrol
     */
    async resume() {
        if (this.state !== PATROL_STATES.PAUSED) return

        debug(`Resuming patrol: ${this.name}`)

        this.state = PATROL_STATES.ACTIVE
        await this._startPatrolLoop()

        this._emitUpdate()

        Hooks.callAll('rnkPatrol.patrolResumed', this)
    }

    /**
     * Engage in combat - pauses patrol and makes token visible
     * Call this when the patrol enters combat
     */
    async engageCombat() {
        debug(`Patrol ${this.name} engaging in combat`)

        // Pause the patrol loop
        if (this.isActive) {
            await this.pause()
        }

        // Clear any pending timers
        this._clearTimers()

        // Make sure token is visible
        await this._showToken()

        // Set alert level to max
        this.alertLevel = 'combat'

        this._emitUpdate()

        Hooks.callAll('rnkPatrol.patrolEngagedCombat', this)
    }

    /**
     * Toggle patrol state
     */
    async toggle() {
        if (this.isActive) {
            await this.pause()
        } else if (this.isPaused) {
            await this.resume()
        } else {
            await this.start()
        }
    }

    // ==========================================
    // Patrol Loop (Blink Mode)
    // ==========================================

    /**
     * Start the patrol loop
     */
    async _startPatrolLoop() {
        console.log(`RNK Patrol | _startPatrolLoop called for "${this.name}", mode: "${this.mode}", PATROL_MODES.WALK="${PATROL_MODES.WALK}"`)
        debug(`_startPatrolLoop called for ${this.name}, mode: ${this.mode}`)

        if (this.mode === PATROL_MODES.WALK || this.mode === 'walk') {
            console.log(`RNK Patrol | Starting WALK loop for "${this.name}"`)
            await this._startWalkLoop()
            return
        }

        console.log(`RNK Patrol | Starting BLINK cycle for "${this.name}"`)
        // Blink mode - start the appear/disappear cycle
        await this._executeBlinkCycle()
    }

    /**
     * Execute one blink cycle
     */
    async _executeBlinkCycle() {
        // Check if we should run
        const primaryGM = isPrimaryGM()
        debug(`_executeBlinkCycle: isActive=${this.isActive}, isPrimaryGM=${primaryGM}, waypoints=${this.waypointIds.length}`)

        if (!this.isActive) {
            debug(`Blink cycle aborted - patrol not active`)
            return
        }

        if (!primaryGM) {
            debug(`Blink cycle aborted - not primary GM (this is normal for non-GM clients)`)
            return
        }

        if (this.waypointIds.length === 0) {
            warn(`Blink cycle aborted - no waypoints configured for ${this.name}`)
            return
        }

        // First cycle notification
        if (this._currentPhase === 'invisible') {
            console.log(`${MODULE_NAME} | Patrol "${this.name}" starting blink cycle...`)
        }

        try {
            // Phase 1: Appear at current waypoint
            await this._phaseAppear()

            if (!this.isActive) return

            // Phase 2: Stay visible, run detection
            await this._phaseVisible()

            if (!this.isActive) return

            // Phase 3: Disappear
            await this._phaseDisappear()

            if (!this.isActive) return

            // Phase 4: Invisible, move to next waypoint
            await this._phaseInvisible()

            if (!this.isActive) return

            // Continue loop
            this._executeBlinkCycle()

        } catch (err) {
            error('Error in blink cycle:', err)
            this.stop()
        }
    }

    /**
     * Appear phase - show token at waypoint with effect
     */
    async _phaseAppear() {
        this._currentPhase = 'appear'

        const waypoint = this.currentWaypoint
        if (!waypoint) {
            warn(`_phaseAppear: No waypoint found! waypointIds=${JSON.stringify(this.waypointIds)}, currentIndex=${this.currentWaypointIndex}`)
            return
        }

        debug(`_phaseAppear at waypoint: ${waypoint.name} (${waypoint.x}, ${waypoint.y})`)

        // Mark waypoint as occupied
        waypoint.occupy(this.tokenId)

        // Move token to waypoint position while hidden (so players don't see teleport)
        await this._moveTokenToWaypoint(waypoint, false)

        // IMPORTANT: Show token (unhide) BEFORE playing effect so players can see the animation
        // The effect will handle fading in from alpha 0
        await this._showToken()

        // Set mesh alpha to 0 so the effect can animate it in
        const token = this.token
        if (token?.mesh) {
            token.mesh.alpha = 0
        }

        // Play appear effect (animates alpha from 0 to 1)
        const { PatrolEffects } = game.rnkPatrol
        if (PatrolEffects) {
            await PatrolEffects.playAppearEffect({
                x: waypoint.x,
                y: waypoint.y,
                effectType: this.effectType,
                color: this.color || waypoint.color,
                tokenId: this.tokenId
            })
        } else {
            // If no effects system, ensure token is visible
            if (token?.mesh) {
                token.mesh.alpha = 1
            }
        }

        // Update waypoint facing direction
        await this._updateTokenRotation(waypoint.facingDirection)
    }

    /**
     * Visible phase - token stays at waypoint, detection runs
     */
    async _phaseVisible() {
        this._currentPhase = 'visible'

        const duration = this.effectiveAppearDuration * 1000

        // Run detection during visible phase
        const detectionInterval = setInterval(() => {
            if (this.detectEnabled && this.isActive) {
                this._runDetection()
            }
        }, 500)

        await this._wait(duration)

        clearInterval(detectionInterval)
    }

    /**
     * Disappear phase - hide token with effect
     */
    async _phaseDisappear() {
        this._currentPhase = 'disappear'

        const waypoint = this.currentWaypoint
        if (!waypoint) return

        debug(`Disappear from waypoint: ${waypoint.name}`)

        // Play disappear effect (animates alpha from 1 to 0)
        // Token stays unhidden so players can see the animation
        const { PatrolEffects } = game.rnkPatrol
        if (PatrolEffects) {
            await PatrolEffects.playDisappearEffect({
                x: waypoint.x,
                y: waypoint.y,
                effectType: this.effectType,
                color: this.color || waypoint.color,
                tokenId: this.tokenId
            })
        }

        // Hide token (set hidden: true in database)
        await this._hideToken()

        // Vacate waypoint
        waypoint.vacate()
    }

    /**
     * Invisible phase - select next waypoint
     */
    async _phaseInvisible() {
        this._currentPhase = 'invisible'

        // Select next waypoint
        this._selectNextWaypoint()

        // Wait invisible duration
        const duration = this.effectiveDisappearDuration * 1000
        await this._wait(duration)
    }

    // ==========================================
    // Walk Mode
    // ==========================================

    /**
     * Start walk patrol loop
     */
    async _startWalkLoop() {
        if (!this.isActive || !isPrimaryGM()) return

        // Show token
        await this._showToken()

        // Walk to first waypoint
        await this._walkToCurrentWaypoint()
    }

    /**
     * Walk to current waypoint
     */
    async _walkToCurrentWaypoint() {
        if (!this.isActive) return

        const waypoint = this.currentWaypoint
        if (!waypoint) return

        const token = this.token
        if (!token) return

        debug(`Walking to waypoint: ${waypoint.name}`)

        // Calculate path and animate movement
        const path = [{ x: waypoint.x, y: waypoint.y }]

        // Use Foundry's built-in token movement
        await this.tokenDocument?.update({
            x: waypoint.x - (token.w / 2),
            y: waypoint.y - (token.h / 2)
        }, { animate: true })

        // Wait at waypoint
        await this._wait(this.effectiveAppearDuration * 1000)

        // Run detection
        if (this.detectEnabled) {
            this._runDetection()
        }

        // Move to next waypoint
        this._selectNextWaypoint()

        // Continue loop
        if (this.isActive) {
            this._walkToCurrentWaypoint()
        }
    }

    // ==========================================
    // Waypoint Selection
    // ==========================================

    /**
     * Select the next waypoint based on pattern
     */
    _selectNextWaypoint() {
        const count = this.waypointIds.length
        if (count === 0) return

        switch (this.blinkPattern) {
            case BLINK_PATTERNS.SEQUENTIAL:
                this.currentWaypointIndex = (this.currentWaypointIndex + 1) % count
                break

            case BLINK_PATTERNS.RANDOM:
                this.currentWaypointIndex = Math.floor(Math.random() * count)
                break

            case BLINK_PATTERNS.WEIGHTED:
                this.currentWaypointIndex = this._selectWeightedWaypoint()
                break

            case BLINK_PATTERNS.PING_PONG:
                this._selectPingPongWaypoint()
                break

            case BLINK_PATTERNS.PRIORITY:
                this.currentWaypointIndex = this._selectPriorityWaypoint()
                break
        }

        debug(`Next waypoint index: ${this.currentWaypointIndex}`)
    }

    /**
     * Select waypoint based on weights
     * @returns {number}
     */
    _selectWeightedWaypoint() {
        const waypoints = this.waypoints
        const totalWeight = waypoints.reduce((sum, w) => sum + (w.weight || 1), 0)

        let random = Math.random() * totalWeight

        for (let i = 0; i < waypoints.length; i++) {
            random -= waypoints[i].weight || 1
            if (random <= 0) return i
        }

        return 0
    }

    /**
     * Select waypoint in ping-pong pattern
     */
    _selectPingPongWaypoint() {
        const count = this.waypointIds.length

        this.currentWaypointIndex += this._patrolDirection

        if (this.currentWaypointIndex >= count - 1) {
            this.currentWaypointIndex = count - 1
            this._patrolDirection = -1
        } else if (this.currentWaypointIndex <= 0) {
            this.currentWaypointIndex = 0
            this._patrolDirection = 1
        }
    }

    /**
     * Select highest priority active waypoint
     * @returns {number}
     */
    _selectPriorityWaypoint() {
        const waypoints = this.waypoints
        let maxPriority = -Infinity
        let maxIndex = 0

        waypoints.forEach((w, i) => {
            if (!w.disabled && w.priority > maxPriority) {
                maxPriority = w.priority
                maxIndex = i
            }
        })

        return maxIndex
    }

    // ==========================================
    // Token Control
    // ==========================================

    /**
     * Find a valid position near the waypoint that doesn't collide with walls
     * @param {number} targetX - Target X coordinate (center)
     * @param {number} targetY - Target Y coordinate (center)
     * @param {number} tokenWidth - Token width in pixels
     * @param {number} tokenHeight - Token height in pixels
     * @returns {{x: number, y: number}} - Valid position (top-left corner)
     */
    _findValidPosition(targetX, targetY, tokenWidth, tokenHeight) {
        const offsetX = tokenWidth / 2
        const offsetY = tokenHeight / 2
        
        // Base position (top-left corner from center)
        let bestX = targetX - offsetX
        let bestY = targetY - offsetY
        
        // Check if we have wall collision detection available
        if (!canvas.walls?.checkCollision) {
            return { x: bestX, y: bestY }
        }
        
        // Test if the center point has collision
        const origin = { x: targetX, y: targetY }
        
        // Check collision from center to slightly offset positions
        // If there's a wall at the exact position, try nearby positions
        const gridSize = canvas.grid.size
        const searchOffsets = [
            { dx: 0, dy: 0 },           // Original position
            { dx: gridSize, dy: 0 },    // Right
            { dx: -gridSize, dy: 0 },   // Left
            { dx: 0, dy: gridSize },    // Down
            { dx: 0, dy: -gridSize },   // Up
            { dx: gridSize, dy: gridSize },    // Diagonal
            { dx: -gridSize, dy: gridSize },
            { dx: gridSize, dy: -gridSize },
            { dx: -gridSize, dy: -gridSize },
            { dx: gridSize * 2, dy: 0 },  // Further out
            { dx: -gridSize * 2, dy: 0 },
            { dx: 0, dy: gridSize * 2 },
            { dx: 0, dy: -gridSize * 2 }
        ]
        
        for (const offset of searchOffsets) {
            const testX = targetX + offset.dx
            const testY = targetY + offset.dy
            
            // Check collision using ray from a point slightly away
            const testOrigin = { x: testX - 1, y: testY - 1 }
            const testDest = { x: testX + 1, y: testY + 1 }
            
            try {
                const hasCollision = canvas.walls.checkCollision(
                    new Ray(testOrigin, testDest),
                    { type: 'move', mode: 'any' }
                )
                
                if (!hasCollision) {
                    return { 
                        x: testX - offsetX, 
                        y: testY - offsetY 
                    }
                }
            } catch (e) {
                // If collision check fails, just use this position
                return { 
                    x: testX - offsetX, 
                    y: testY - offsetY 
                }
            }
        }
        
        // If all positions have collision, use original
        return { x: bestX, y: bestY }
    }

    /**
     * Move token to waypoint position
     * @param {Waypoint} waypoint
     * @param {boolean} visible
     */
    async _moveTokenToWaypoint(waypoint, visible = true) {
        const tokenDoc = this.tokenDocument
        if (!tokenDoc) return

        // Calculate token dimensions
        const token = this.token
        const tokenWidth = token ? token.w : canvas.grid.size
        const tokenHeight = token ? token.h : canvas.grid.size

        // Find a valid position that doesn't collide with walls
        const validPos = this._findValidPosition(
            waypoint.x, 
            waypoint.y, 
            tokenWidth, 
            tokenHeight
        )

        await tokenDoc.update({
            x: validPos.x,
            y: validPos.y,
            hidden: !visible
        }, { animate: false })
    }

    /**
     * Show the token
     */
    async _showToken() {
        const tokenDoc = this.tokenDocument
        if (!tokenDoc) return

        await tokenDoc.update({ hidden: false }, { animate: false })

        // Emit for visual sync
        emitSocket('tokenAppear', {
            tokenId: this.tokenId,
            x: tokenDoc.x,
            y: tokenDoc.y
        })
    }

    /**
     * Hide the token
     */
    async _hideToken() {
        const tokenDoc = this.tokenDocument
        if (!tokenDoc) return

        await tokenDoc.update({ hidden: true }, { animate: false })

        // Emit for visual sync
        emitSocket('tokenDisappear', {
            tokenId: this.tokenId,
            x: tokenDoc.x,
            y: tokenDoc.y
        })
    }

    /**
     * Update token rotation
     * @param {number} degrees
     */
    async _updateTokenRotation(degrees) {
        const tokenDoc = this.tokenDocument
        if (!tokenDoc) return

        await tokenDoc.update({ rotation: degrees }, { animate: false })
    }

    // ==========================================
    // Detection
    // ==========================================

    /**
     * Run detection check
     */
    _runDetection() {
        const waypoint = this.currentWaypoint
        if (!waypoint) return

        const detectedTokens = waypoint.detectPlayerTokens()

        for (const token of detectedTokens) {
            if (!this._detectedTokens.has(token.id)) {
                this._detectedTokens.add(token.id)
                this._handleDetection(token)
            }
        }

        // Clear tokens that are no longer detected
        const currentIds = new Set(detectedTokens.map(t => t.id))
        for (const id of this._detectedTokens) {
            if (!currentIds.has(id)) {
                this._detectedTokens.delete(id)
            }
        }
    }

    /**
     * Handle token detection
     * @param {Token} token
     */
    async _handleDetection(token) {
        debug(`Detection! ${this.name} spotted ${token.name}`)

        // Increase alert level
        this.alertLevel++

        // Execute detection action
        switch (this.detectionAction) {
            case 'notify':
                ui.notifications.warn(
                    game.i18n.format(`${MODULE_ID}.notifications.detected`, {
                        patrol: this.name,
                        token: token.name
                    })
                )
                break

            case 'alert':
                this.state = PATROL_STATES.ALERT
                // Could trigger faster patrol, change pattern, etc.
                break

            case 'combat':
                await this._initiateCombat(token)
                break

            case 'macro':
                await this._executeMacro(token)
                break
        }

        // Emit alert
        emitSocket('alertTriggered', {
            patrolId: this.id,
            patrolName: this.name,
            tokenId: token.id,
            tokenName: token.name,
            alertLevel: this.alertLevel
        })

        this._promptPlayerInteraction(token)

        Hooks.callAll('rnkPatrol.detection', this, token)
    }

    /**
     * Prompt the player owner(s) of the detected token with an interaction dialog
     * @param {Token} token
     */
    _promptPlayerInteraction(token) {
        if (!game.user.isGM) return
        if (!token.actor) return

        const ownerUsers = this._getPlayerOwnersForToken(token)
        if (!ownerUsers.length) return

        for (const owner of ownerUsers) {
            emitSocket('openInteractionWindow', {
                targetUserId: owner.id,
                patrolId: this.id,
                patrolName: this.name,
                tokenId: token.id,
                tokenName: token.name,
                alertLevel: this.alertLevel
            })
        }
    }

    /**
     * Get all non-GM owners for the token
     * @param {Token} token
     * @returns {User[]}
     */
    _getPlayerOwnersForToken(token) {
        const actor = token.actor
        if (!actor) return []

        return game.users.filter(user => {
            if (user.isGM) return false
            // Use string permission level for V13 compatibility
            return actor.testUserPermission(user, "OWNER")
        })
    }

    /**
     * Initiate combat with detected token
     * @param {Token} token
     */
    async _initiateCombat(token) {
        const combat = game.combat || await Combat.create({ scene: this.sceneId })

        // Add guard token
        if (this.tokenDocument) {
            await combat.createEmbeddedDocuments('Combatant', [{
                tokenId: this.tokenId,
                sceneId: this.sceneId
            }])
        }

        // Add detected token
        await combat.createEmbeddedDocuments('Combatant', [{
            tokenId: token.id,
            sceneId: this.sceneId
        }])

        // Start combat
        await combat.startCombat()
    }

    /**
     * Execute detection macro
     * @param {Token} token
     */
    async _executeMacro(token) {
        if (!this.detectionMacro) return

        const macro = game.macros.get(this.detectionMacro)
        if (!macro) {
            warn(`Detection macro not found: ${this.detectionMacro}`)
            return
        }

        // Execute with context
        await macro.execute({
            patrol: this,
            guardToken: this.token,
            detectedToken: token,
            waypoint: this.currentWaypoint
        })
    }

    // ==========================================
    // Alert Handling
    // ==========================================

    /**
     * Handle alert from remote
     * @param {Object} data
     */
    async handleAlert(data) {
        this.alertLevel = data.alertLevel

        if (this.state !== PATROL_STATES.ALERT) {
            this.state = PATROL_STATES.ALERT
        }

        Hooks.callAll('rnkPatrol.alertReceived', this, data)
    }

    /**
     * Reset alert level
     */
    resetAlert() {
        this.alertLevel = 0
        if (this.state === PATROL_STATES.ALERT) {
            this.state = PATROL_STATES.ACTIVE
        }
    }

    // ==========================================
    // Utility Methods
    // ==========================================

    /**
     * Apply timing variance
     * @param {number} base
     * @returns {number}
     */
    _applyVariance(base) {
        if (this.timingVariance <= 0) return base

        const variance = (this.timingVariance / 100) * base
        const adjustment = (Math.random() * 2 - 1) * variance

        return Math.max(0.1, base + adjustment)
    }

    /**
     * Wait for duration
     * @param {number} ms
     * @returns {Promise}
     */
    _wait(ms) {
        return new Promise(resolve => {
            this._phaseTimeout = setTimeout(resolve, ms)
        })
    }

    /**
     * Clear all timers
     */
    _clearTimers() {
        if (this._loopInterval) {
            clearInterval(this._loopInterval)
            this._loopInterval = null
        }
        if (this._phaseTimeout) {
            clearTimeout(this._phaseTimeout)
            this._phaseTimeout = null
        }
    }

    /**
     * Emit patrol update to other clients
     */
    _emitUpdate() {
        emitSocket('patrolUpdate', {
            patrolId: this.id,
            state: this.state,
            currentWaypointIndex: this.currentWaypointIndex,
            alertLevel: this.alertLevel,
            phase: this._currentPhase
        })
    }

    /**
     * Sync from remote update
     * @param {Object} data
     */
    syncFromRemote(data) {
        this.state = data.state
        this.currentWaypointIndex = data.currentWaypointIndex
        this.alertLevel = data.alertLevel
        this._currentPhase = data.phase
    }

    // ==========================================
    // Persistence
    // ==========================================

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            sceneId: this.sceneId,
            tokenId: this.tokenId,
            state: this.state,
            mode: this.mode,
            blinkPattern: this.blinkPattern,
            waypointIds: this.waypointIds,
            currentWaypointIndex: this.currentWaypointIndex,
            appearDuration: this.appearDuration,
            disappearDuration: this.disappearDuration,
            timingVariance: this.timingVariance,
            detectEnabled: this.detectEnabled,
            detectionAction: this.detectionAction,
            detectionMacro: this.detectionMacro,
            effectType: this.effectType,
            color: this.color,
            tags: this.tags,
            notes: this.notes,
            disabled: this.disabled,
            alertLevel: this.alertLevel,
            guardActorId: this.guardActorId,
            automateCombat: this.automateCombat,
            automateDecisions: this.automateDecisions,
            automateRequireApproval: this.automateRequireApproval,
            aggressiveness: this.aggressiveness
        }
    }

    /**
     * Save patrol to settings
     * @returns {Promise}
     */
    async save() {
        if (!game.user.isGM) return

        const allPatrols = game.settings.get(MODULE_ID, 'scenePatrolData') || {}
        const scenePatrols = allPatrols[this.sceneId] || []

        const index = scenePatrols.findIndex(p => p.id === this.id)
        if (index >= 0) {
            scenePatrols[index] = this.toJSON()
        } else {
            scenePatrols.push(this.toJSON())
        }

        allPatrols[this.sceneId] = scenePatrols
        await game.settings.set(MODULE_ID, 'scenePatrolData', allPatrols)

        debug('Patrol saved:', this.id)
    }

    /**
     * Delete patrol
     * @returns {Promise}
     */
    async delete() {
        await this.stop()

        if (!game.user.isGM) return

        const allPatrols = game.settings.get(MODULE_ID, 'scenePatrolData') || {}
        const scenePatrols = allPatrols[this.sceneId] || []

        allPatrols[this.sceneId] = scenePatrols.filter(p => p.id !== this.id)
        await game.settings.set(MODULE_ID, 'scenePatrolData', allPatrols)

        debug('Patrol deleted:', this.id)
        Hooks.callAll('rnkPatrol.patrolDeleted', this)
    }
}
