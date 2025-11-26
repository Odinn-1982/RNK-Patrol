/**
 * RNK Patrol - Waypoint Class
 * 
 * Represents a single patrol waypoint where guards can appear/disappear.
 * Waypoints are stored as flags on the scene and visualized as markers.
 * 
 * @module Waypoint
 */

import { MODULE_ID, debug, warn, WAYPOINT_STATES } from './main.js'
import { getSetting } from './settings.js'

/**
 * Waypoint class - represents a patrol checkpoint
 */
export class Waypoint {
    
    /**
     * @param {Object} data - Waypoint data
     */
    constructor(data = {}) {
        /**
         * Unique identifier
         * @type {string}
         */
        this.id = data.id || foundry.utils.randomID()
        
        /**
         * Scene ID this waypoint belongs to
         * @type {string}
         */
        this.sceneId = data.sceneId || canvas.scene?.id
        
        /**
         * X coordinate (center)
         * @type {number}
         */
        this.x = data.x || 0
        
        /**
         * Y coordinate (center)
         * @type {number}
         */
        this.y = data.y || 0
        
        /**
         * Display name
         * @type {string}
         */
        this.name = data.name || `Waypoint ${this.id.slice(0, 4)}`
        
        /**
         * Current state
         * @type {string}
         */
        this.state = data.state || WAYPOINT_STATES.INACTIVE
        
        /**
         * Detection radius in grid units
         * @type {number}
         */
        this.detectionRange = data.detectionRange ?? getSetting('defaultDetectionRange', 5)
        
        /**
         * How long token stays visible (seconds)
         * @type {number}
         */
        this.appearDuration = data.appearDuration ?? getSetting('defaultAppearDuration', 3)
        
        /**
         * Weight for random selection (higher = more likely)
         * @type {number}
         */
        this.weight = data.weight ?? 1
        
        /**
         * Priority level (for priority-based patterns)
         * @type {number}
         */
        this.priority = data.priority ?? 0
        
        /**
         * Custom effect override
         * @type {string|null}
         */
        this.effectType = data.effectType || null
        
        /**
         * Custom color override
         * @type {string|null}
         */
        this.color = data.color || null
        
        /**
         * Vision cone direction (degrees, 0 = north)
         * @type {number}
         */
        this.facingDirection = data.facingDirection ?? 0
        
        /**
         * Vision cone angle (degrees)
         * @type {number}
         */
        this.visionAngle = data.visionAngle ?? 360
        
        /**
         * Conditions for when this waypoint is active
         * @type {Object}
         */
        this.conditions = data.conditions || {}
        
        /**
         * Tags for grouping/filtering
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
         * Currently occupied by token ID
         * @type {string|null}
         */
        this.occupiedBy = data.occupiedBy || null
        
        /**
         * PIXI container for visualization
         * @type {PIXI.Container|null}
         */
        this._visual = null
        
        /**
         * Parent patrol reference
         * @type {Patrol|null}
         */
        this._patrol = null
    }
    
    // ==========================================
    // Static Methods
    // ==========================================
    
    /**
     * Create a new waypoint and save it
     * @param {Object} data 
     * @returns {Promise<Waypoint>}
     */
    static async create(data) {
        const waypoint = new Waypoint(data)
        await waypoint.save()
        return waypoint
    }
    
    /**
     * Load waypoint from stored data
     * @param {Object} data 
     * @returns {Waypoint}
     */
    static fromData(data) {
        return new Waypoint(data)
    }
    
    /**
     * Get all waypoints for a scene
     * @param {string} sceneId 
     * @returns {Waypoint[]}
     */
    static getSceneWaypoints(sceneId) {
        const scene = game.scenes.get(sceneId)
        if (!scene) return []
        
        const waypointsData = scene.getFlag(MODULE_ID, 'waypoints') || []
        return waypointsData.map(data => Waypoint.fromData(data))
    }
    
    // ==========================================
    // Properties
    // ==========================================
    
    /**
     * Get the scene this waypoint belongs to
     * @returns {Scene|null}
     */
    get scene() {
        return game.scenes.get(this.sceneId)
    }
    
    /**
     * Check if waypoint is currently active
     * @returns {boolean}
     */
    get isActive() {
        return this.state === WAYPOINT_STATES.ACTIVE && !this.disabled
    }
    
    /**
     * Check if waypoint is occupied
     * @returns {boolean}
     */
    get isOccupied() {
        return this.state === WAYPOINT_STATES.OCCUPIED
    }
    
    /**
     * Get center point
     * @returns {Point}
     */
    get center() {
        return { x: this.x, y: this.y }
    }
    
    /**
     * Get grid position
     * @returns {Object}
     */
    get gridPosition() {
        if (!canvas.ready) return { row: 0, col: 0 }
        return canvas.grid.getOffset({ x: this.x, y: this.y })
    }
    
    /**
     * Get snapped position (center of grid cell)
     * @returns {Point}
     */
    get snappedPosition() {
        if (!canvas.ready) return { x: this.x, y: this.y }
        return canvas.grid.getSnappedPoint({ x: this.x, y: this.y }, { mode: CONST.GRID_SNAPPING_MODES.CENTER })
    }
    
    /**
     * Get detection radius in pixels
     * @returns {number}
     */
    get detectionRadiusPixels() {
        if (!canvas.ready) return this.detectionRange * 50
        return this.detectionRange * canvas.grid.size
    }
    
    /**
     * Get effective color
     * @returns {string}
     */
    get effectiveColor() {
        return this.color || getSetting('waypointColor', '#7B68EE')
    }
    
    // ==========================================
    // State Management
    // ==========================================
    
    /**
     * Set waypoint state
     * @param {string} newState 
     */
    setState(newState) {
        const oldState = this.state
        this.state = newState
        
        if (oldState !== newState) {
            this.updateVisual()
            Hooks.callAll('rnkPatrol.waypointStateChange', this, oldState, newState)
        }
    }
    
    /**
     * Mark as occupied by a token
     * @param {string} tokenId 
     */
    occupy(tokenId) {
        this.occupiedBy = tokenId
        this.setState(WAYPOINT_STATES.OCCUPIED)
    }
    
    /**
     * Clear occupation
     */
    vacate() {
        this.occupiedBy = null
        this.setState(WAYPOINT_STATES.ACTIVE)
    }
    
    /**
     * Disable the waypoint
     */
    disable() {
        this.disabled = true
        this.updateVisual()
    }
    
    /**
     * Enable the waypoint
     */
    enable() {
        this.disabled = false
        this.updateVisual()
    }
    
    // ==========================================
    // Detection
    // ==========================================
    
    /**
     * Check if a point is within detection range
     * @param {Point} point 
     * @returns {boolean}
     */
    isInRange(point) {
        if (this.detectionRange <= 0) return false
        
        const dx = point.x - this.x
        const dy = point.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        return distance <= this.detectionRadiusPixels
    }
    
    /**
     * Check if a point is within vision cone
     * @param {Point} point 
     * @returns {boolean}
     */
    isInVisionCone(point) {
        // 360 degree vision means everything is visible
        if (this.visionAngle >= 360) return true
        
        // Calculate angle to point
        const dx = point.x - this.x
        const dy = point.y - this.y
        const angleToPoint = Math.atan2(dy, dx) * (180 / Math.PI) + 90 // Adjust for north=0
        
        // Normalize angles
        const normalizedAngle = ((angleToPoint % 360) + 360) % 360
        const normalizedFacing = ((this.facingDirection % 360) + 360) % 360
        
        // Calculate half cone
        const halfCone = this.visionAngle / 2
        
        // Check if within cone
        let diff = Math.abs(normalizedAngle - normalizedFacing)
        if (diff > 180) diff = 360 - diff
        
        return diff <= halfCone
    }
    
    /**
     * Get all tokens within detection range
     * @returns {Token[]}
     */
    getTokensInRange() {
        if (!canvas.ready || this.detectionRange <= 0) return []
        
        return canvas.tokens.placeables.filter(token => {
            const center = token.center
            return this.isInRange(center) && this.isInVisionCone(center)
        })
    }
    
    /**
     * Check for player tokens in range
     * @returns {Token[]}
     */
    detectPlayerTokens() {
        return this.getTokensInRange().filter(token => {
            const actor = token.actor
            if (!actor) return false
            
            // Check if player-controlled
            return actor.hasPlayerOwner || token.document.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY
        })
    }
    
    // ==========================================
    // Visualization
    // ==========================================
    
    /**
     * Create/update visual representation
     * NOTE: Waypoints are ALWAYS GM-only visible for security
     */
    updateVisual() {
        if (!canvas.ready) return
        
        // IMPORTANT: Waypoints are ONLY visible to GMs - never to players
        // This is a security feature to prevent players from seeing patrol routes
        if (!game.user.isGM) {
            this.removeVisual()
            return
        }
        
        // Check visibility setting (GM-only)
        const visibility = getSetting('showWaypoints', 'gm')
        
        if (visibility === 'never') {
            this.removeVisual()
            return
        }
        
        // Create or update container
        if (!this._visual) {
            this._createVisual()
        }
        
        this._updateVisualState()
    }
    
    /**
     * Check if visual should be shown
     * @param {string} visibility 
     * @returns {boolean}
     * @deprecated - Waypoints are now always GM-only
     */
    _shouldShowVisual(visibility) {
        // Always require GM - this is a security feature
        return game.user.isGM && visibility !== 'never'
    }
    
    /**
     * Create visual container
     */
    _createVisual() {
        this._visual = new PIXI.Container()
        this._visual.eventMode = 'static'
        this._visual.cursor = 'pointer'
        
        // Background circle
        const bg = new PIXI.Graphics()
        this._visual.addChild(bg)
        this._visual.bg = bg
        
        // Detection range circle
        const range = new PIXI.Graphics()
        range.alpha = 0.15
        this._visual.addChild(range)
        this._visual.range = range
        
        // Vision cone (if not 360)
        const cone = new PIXI.Graphics()
        cone.alpha = 0.1
        this._visual.addChild(cone)
        this._visual.cone = cone
        
        // Center icon
        const icon = new PIXI.Text('◎', {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center'
        })
        icon.anchor.set(0.5)
        this._visual.addChild(icon)
        this._visual.icon = icon
        
        // Label
        const label = new PIXI.Text(this.name, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xFFFFFF,
            stroke: 0x000000,
            strokeThickness: 2,
            align: 'center'
        })
        label.anchor.set(0.5, 0)
        label.y = 20
        this._visual.addChild(label)
        this._visual.label = label
        
        // Position
        this._visual.x = this.x
        this._visual.y = this.y
        
        // Add to canvas
        canvas.controls.addChild(this._visual)
        
        // Interaction
        this._visual.on('pointerdown', () => this._onPointerDown())
        this._visual.on('pointerover', () => this._onPointerOver())
        this._visual.on('pointerout', () => this._onPointerOut())
    }
    
    /**
     * Update visual state based on current properties
     */
    _updateVisualState() {
        if (!this._visual) return
        
        const color = PIXI.Color.shared.setValue(this.effectiveColor).toNumber()
        const radius = 15
        
        // Update background
        this._visual.bg.clear()
        this._visual.bg.beginFill(color, this.disabled ? 0.3 : 0.8)
        this._visual.bg.drawCircle(0, 0, radius)
        this._visual.bg.endFill()
        
        // Occupied indicator
        if (this.isOccupied) {
            this._visual.bg.lineStyle(3, 0xFFFF00, 1)
            this._visual.bg.drawCircle(0, 0, radius + 2)
        }
        
        // Detection range
        this._visual.range.clear()
        if (this.detectionRange > 0 && game.user.isGM) {
            this._visual.range.beginFill(color, 1)
            this._visual.range.drawCircle(0, 0, this.detectionRadiusPixels)
            this._visual.range.endFill()
        }
        
        // Vision cone
        this._visual.cone.clear()
        if (this.visionAngle < 360 && this.detectionRange > 0 && game.user.isGM) {
            this._drawVisionCone()
        }
        
        // Update label
        this._visual.label.text = this.name
        
        // Disabled state
        this._visual.alpha = this.disabled ? 0.5 : 1
        
        // Position
        this._visual.x = this.x
        this._visual.y = this.y
    }
    
    /**
     * Draw vision cone graphic
     */
    _drawVisionCone() {
        const cone = this._visual.cone
        const color = PIXI.Color.shared.setValue(this.effectiveColor).toNumber()
        const radius = this.detectionRadiusPixels
        
        cone.beginFill(color, 1)
        cone.moveTo(0, 0)
        
        const startAngle = (this.facingDirection - this.visionAngle / 2 - 90) * Math.PI / 180
        const endAngle = (this.facingDirection + this.visionAngle / 2 - 90) * Math.PI / 180
        
        cone.arc(0, 0, radius, startAngle, endAngle)
        cone.lineTo(0, 0)
        cone.endFill()
    }
    
    /**
     * Remove visual from canvas
     */
    removeVisual() {
        if (this._visual) {
            this._visual.destroy({ children: true })
            this._visual = null
        }
    }
    
    // ==========================================
    // Interaction Handlers
    // ==========================================
    
    _onPointerDown() {
        if (!game.user.isGM) return
        
        // Visual feedback - flash the waypoint
        if (this._visual?.bg) {
            const originalAlpha = this._visual.alpha
            this._visual.alpha = 0.5
            setTimeout(() => {
                if (this._visual) this._visual.alpha = originalAlpha
            }, 100)
        }
        
        debug('Waypoint clicked:', this.id)
        Hooks.callAll('rnkPatrol.waypointClicked', this)
    }
    
    _onPointerOver() {
        if (!game.user.isGM) return
        
        if (this._visual) {
            // Scale up and brighten on hover
            this._visual.scale.set(1.2)
            if (this._visual.bg) {
                this._visual.bg.tint = 0xFFFFFF
            }
            // Change cursor
            this._visual.cursor = 'pointer'
        }
    }
    
    _onPointerOut() {
        if (!game.user.isGM) return
        
        if (this._visual) {
            // Reset scale
            this._visual.scale.set(1)
            if (this._visual.bg) {
                this._visual.bg.tint = 0xFFFFFF
            }
        }
    }
    
    // ==========================================
    // Persistence
    // ==========================================
    
    /**
     * Convert to plain object for storage
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            sceneId: this.sceneId,
            x: this.x,
            y: this.y,
            name: this.name,
            state: this.state,
            detectionRange: this.detectionRange,
            appearDuration: this.appearDuration,
            weight: this.weight,
            priority: this.priority,
            effectType: this.effectType,
            color: this.color,
            facingDirection: this.facingDirection,
            visionAngle: this.visionAngle,
            conditions: this.conditions,
            tags: this.tags,
            notes: this.notes,
            disabled: this.disabled
        }
    }
    
    /**
     * Save waypoint to scene flags
     * @returns {Promise}
     */
    async save() {
        const scene = this.scene
        if (!scene) {
            warn('Cannot save waypoint - scene not found')
            return
        }
        
        const waypoints = scene.getFlag(MODULE_ID, 'waypoints') || []
        const index = waypoints.findIndex(w => w.id === this.id)
        
        if (index >= 0) {
            waypoints[index] = this.toJSON()
        } else {
            waypoints.push(this.toJSON())
        }
        
        await scene.setFlag(MODULE_ID, 'waypoints', waypoints)
        debug('Waypoint saved:', this.id)
    }
    
    /**
     * Delete waypoint from scene flags
     * @returns {Promise}
     */
    async delete() {
        const scene = this.scene
        if (!scene) return
        
        const waypoints = scene.getFlag(MODULE_ID, 'waypoints') || []
        const filtered = waypoints.filter(w => w.id !== this.id)
        
        await scene.setFlag(MODULE_ID, 'waypoints', filtered)
        this.removeVisual()
        
        debug('Waypoint deleted:', this.id)
        Hooks.callAll('rnkPatrol.waypointDeleted', this)
    }
    
    // ==========================================
    // Utility
    // ==========================================
    
    /**
     * Calculate distance to another point
     * @param {Point} point 
     * @returns {number} Distance in pixels
     */
    distanceTo(point) {
        const dx = point.x - this.x
        const dy = point.y - this.y
        return Math.sqrt(dx * dx + dy * dy)
    }
    
    /**
     * Calculate distance in grid units
     * @param {Point} point 
     * @returns {number}
     */
    gridDistanceTo(point) {
        if (!canvas.ready) return this.distanceTo(point) / 50
        return this.distanceTo(point) / canvas.grid.size
    }
    
    /**
     * Clone this waypoint
     * @param {Object} overrides 
     * @returns {Waypoint}
     */
    clone(overrides = {}) {
        const data = { ...this.toJSON(), ...overrides }
        data.id = foundry.utils.randomID()
        return new Waypoint(data)
    }
}
