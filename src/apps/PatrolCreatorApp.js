/**
 * RNK Patrol - Patrol Creator Application
 * 
 * UI for creating new patrols with multi-waypoint placement.
 * 
 * @module PatrolCreatorApp
 */

import { MODULE_ID, PATROL_MODES, BLINK_PATTERNS } from '../main.js'
import { getSetting } from '../settings.js'

/**
 * PatrolCreatorApp - Create new patrol UI with continuous waypoint placement
 */
export class PatrolCreatorApp extends FormApplication {
    
    constructor(options = {}) {
        super(options)
        
        this.initialToken = options.token || null
        
        /**
         * Waypoints created in this session (not yet saved to patrol)
         * @type {Array}
         */
        this.sessionWaypoints = []
        
        /**
         * Is placement mode active?
         * @type {boolean}
         */
        this.isPlacingWaypoints = false
        
        /**
         * Canvas click handler reference
         * @type {Function|null}
         */
        this._clickHandler = null
        
        /**
         * Keydown handler reference (for escape)
         * @type {Function|null}
         */
        this._keyHandler = null
        
        /**
         * Hook ID for waypoint click handler
         * @type {number|null}
         */
        this._waypointClickHook = null
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-patrol-creator',
            title: game.i18n.localize(`${MODULE_ID}.apps.creator.title`),
            template: `modules/${MODULE_ID}/templates/patrol-creator.hbs`,
            classes: ['rnk-patrol', 'patrol-creator'],
            width: 500,
            height: 'auto',
            closeOnSubmit: false, // Don't close on submit - we handle this manually
            submitOnChange: false
        })
    }
    
    /**
     * Get manager
     */
    get manager() {
        return game.rnkPatrol?.manager ?? null
    }
    
    /**
     * Check if patrol system is ready
     */
    get isSystemReady() {
        return !!game.rnkPatrol?.manager
    }
    
    /**
     * Called when rendered - set up waypoint click hook
     */
    render(force = false, options = {}) {
        // Check if system is ready before rendering
        if (!this.isSystemReady) {
            ui.notifications.warn('Patrol system is still initializing. Please wait a moment and try again.')
            return this
        }
        
        // Register waypoint click hook if not already
        if (!this._waypointClickHook) {
            this._waypointClickHook = Hooks.on('rnkPatrol.waypointClicked', (waypoint) => {
                this._onWaypointClicked(waypoint)
            })
        }
        
        // Preserve scroll position in content area across re-renders
        const content = this.element?.find('.content')[0];
        const scrollTop = content ? content.scrollTop : 0;

        const result = super.render(force, options)

        const newContent = this.element?.find('.content')[0];
        if (newContent) newContent.scrollTop = scrollTop;

        return result
    }
    
    /**
     * Handle waypoint clicked on canvas
     * @param {Waypoint} waypoint 
     */
    async _onWaypointClicked(waypoint) {
        // Only handle if this creator is rendered
        if (!this.rendered) return
        
        // Check if this waypoint is in our session
        const isSessionWaypoint = this.sessionWaypoints.some(w => w.id === waypoint.id)
        
        if (isSessionWaypoint) {
            // Confirm delete
            const confirm = await Dialog.confirm({
                title: 'Delete Waypoint',
                content: `<p>Delete <strong>${waypoint.name}</strong>?</p><p style="font-size:0.9em;color:#888;">Click OK to delete, Cancel to keep.</p>`
            })
            
            if (confirm) {
                await this._deleteSessionWaypoint(waypoint.id)
            }
        } else {
            // It's an existing waypoint - offer to add to selection or delete
            new Dialog({
                title: waypoint.name,
                content: `<p>What would you like to do with this waypoint?</p>`,
                buttons: {
                    delete: {
                        icon: '<i class="fas fa-trash"></i>',
                        label: 'Delete',
                        callback: async () => {
                            await this._deleteExistingWaypoint(waypoint.id)
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: 'Cancel'
                    }
                },
                default: 'cancel'
            }).render(true)
        }
    }
    
    /**
     * Prepare data
     */
    getData(options = {}) {
        const tokens = canvas.tokens.placeables
            .filter(t => !t.document.hidden) // Only visible tokens
            .map(t => ({
                id: t.id,
                name: t.name,
                img: t.document.texture?.src,
                selected: this.initialToken?.id === t.id
            }))
        
        // Combine existing waypoints with session waypoints
        const existingWaypoints = this.manager?.getWaypoints() ?? []
        const unassigned = this.manager?.getUnassignedWaypoints() ?? []
        
        return {
            name: game.i18n.localize(`${MODULE_ID}.apps.creator.defaultName`),
            tokens,
            // Session waypoints - ones created during this patrol creation
            sessionWaypoints: this.sessionWaypoints.map((w, index) => ({
                id: w.id,
                name: w.name || `Waypoint ${index + 1}`,
                x: Math.round(w.x),
                y: Math.round(w.y),
                index: index + 1
            })),
            // Existing waypoints from the scene
            existingWaypoints: existingWaypoints.map(w => ({
                id: w.id,
                name: w.name,
                unassigned: unassigned.some(u => u.id === w.id)
            })),
            hasSessionWaypoints: this.sessionWaypoints.length > 0,
            hasExistingWaypoints: existingWaypoints.length > 0,
            isPlacingWaypoints: this.isPlacingWaypoints,
            waypointCount: this.sessionWaypoints.length,
            canSave: this.sessionWaypoints.length >= 2,
            modes: Object.entries(PATROL_MODES).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.patrolModes.${value}`),
                selected: value === getSetting('defaultPatrolMode')
            })),
            patterns: Object.entries(BLINK_PATTERNS).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.blinkPatterns.${value}`),
                selected: value === getSetting('defaultBlinkPattern')
            })),
            effectTypes: [
                { value: 'fade', label: game.i18n.localize(`${MODULE_ID}.effectTypes.fade`) },
                { value: 'flash', label: game.i18n.localize(`${MODULE_ID}.effectTypes.flash`) },
                { value: 'smoke', label: game.i18n.localize(`${MODULE_ID}.effectTypes.smoke`) },
                { value: 'portal', label: game.i18n.localize(`${MODULE_ID}.effectTypes.portal`) },
                { value: 'shadow', label: game.i18n.localize(`${MODULE_ID}.effectTypes.shadow`) },
                { value: 'glitch', label: game.i18n.localize(`${MODULE_ID}.effectTypes.glitch`) },
                { value: 'none', label: game.i18n.localize(`${MODULE_ID}.effectTypes.none`) }
            ],
            appearDuration: getSetting('defaultAppearDuration'),
            disappearDuration: getSetting('defaultDisappearDuration'),
            timingVariance: getSetting('timingVariance')
        }
    }
    
    /**
     * Handle form submission - Create Patrol
     */
    async _updateObject(event, formData) {
        // Get waypoint IDs from session waypoints + any checked existing waypoints
        const waypointIds = [...this.sessionWaypoints.map(w => w.id)]
        
        // Add any selected existing waypoints
        const form = event?.target || this.element?.find('form')[0]
        if (form) {
            const existingCheckboxes = form.querySelectorAll('[name="existingWaypoints"]:checked')
            existingCheckboxes.forEach(cb => {
                if (!waypointIds.includes(cb.value)) {
                    waypointIds.push(cb.value)
                }
            })
        }
        
        if (waypointIds.length < 2) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.needWaypoints`))
            return false
        }
        
        if (!formData.tokenId) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.needToken`))
            return false
        }
        
        // Create patrol
        const patrol = await this.manager.createPatrol({
            name: formData.name || 'New Patrol',
            tokenId: formData.tokenId,
            mode: formData.mode,
            blinkPattern: formData.blinkPattern,
            waypointIds,
            appearDuration: parseFloat(formData.appearDuration) || 3,
            disappearDuration: parseFloat(formData.disappearDuration) || 2,
            timingVariance: parseFloat(formData.timingVariance) || 20,
            effectType: formData.effectType,
            detectEnabled: formData.detectEnabled !== false, // Default true if unchecked (not in form)
            detectionAction: formData.detectionAction || 'notify'
        })
        
        if (!patrol) return false
        
        ui.notifications.info(
            game.i18n.format(`${MODULE_ID}.notifications.patrolCreated`, { name: patrol.name })
        )
        
        // Clear session waypoints since they're now saved with the patrol
        this.sessionWaypoints = []
        
        // Offer to start immediately
        const start = await Dialog.confirm({
            title: game.i18n.localize(`${MODULE_ID}.apps.creator.startNow`),
            content: game.i18n.localize(`${MODULE_ID}.apps.creator.startNowContent`)
        })
        
        if (start) {
            await patrol.start()
        }
        
        // Now close
        this.close()
    }
    
    /**
     * Activate listeners
     */
    activateListeners(html) {
        super.activateListeners(html)
        
        // Mode change - show/hide pattern field
        html.find('[name="mode"]').change((event) => {
            const mode = event.target.value
            const patternGroup = html.find('.pattern-group')
            
            if (mode === PATROL_MODES.WALK) {
                patternGroup.hide()
            } else {
                patternGroup.show()
            }
        })
        
        // Range slider value displays
        html.find('input[type="range"]').each((i, input) => {
            const valueSpan = input.parentElement.querySelector('.range-value')
            if (valueSpan) {
                input.addEventListener('input', () => {
                    valueSpan.textContent = input.value + (input.name.includes('Variance') ? '%' : 's')
                })
            }
        })
        
        // Start Placing Waypoints button
        html.find('[data-action="start-placement"]').click(() => {
            this._startWaypointPlacement()
        })
        
        // Stop Placing Waypoints button
        html.find('[data-action="stop-placement"]').click(() => {
            this._stopWaypointPlacement()
        })
        
        // Delete waypoint buttons
        html.find('[data-action="delete-waypoint"]').click(async (event) => {
            const waypointId = event.currentTarget.dataset.waypointId
            await this._deleteSessionWaypoint(waypointId)
        })
        
        // Delete existing waypoint buttons
        html.find('[data-action="delete-existing-waypoint"]').click(async (event) => {
            const waypointId = event.currentTarget.dataset.waypointId
            await this._deleteExistingWaypoint(waypointId)
        })
        
        // Clear all waypoints button
        html.find('[data-action="clear-waypoints"]').click(async () => {
            await this._clearAllSessionWaypoints()
        })
        
        // Save & Start button
        html.find('[data-action="save-and-start"]').click(async (event) => {
            event.preventDefault()
            const form = html.find('form')[0] || this.element?.find('form')[0]
            
            if (!form) {
                console.error('RNK Patrol | Could not find form element')
                ui.notifications.error('Form not found. Please try again.')
                return
            }
            
            // Use native FormData instead of FormDataExtended
            const nativeFormData = new FormData(form)
            const formData = Object.fromEntries(nativeFormData.entries())
            
            // Validate and create
            const waypointIds = [...this.sessionWaypoints.map(w => w.id)]
            const existingCheckboxes = form.querySelectorAll('[name="existingWaypoints"]:checked') || []
            existingCheckboxes.forEach(cb => {
                if (!waypointIds.includes(cb.value)) {
                    waypointIds.push(cb.value)
                }
            })
            
            if (waypointIds.length < 2) {
                ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.needWaypoints`))
                return
            }
            
            if (!formData.tokenId) {
                ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.needToken`))
                return
            }
            
            // Create patrol
            const patrol = await this.manager.createPatrol({
                name: formData.name || 'New Patrol',
                tokenId: formData.tokenId,
                mode: formData.mode,
                blinkPattern: formData.blinkPattern,
                waypointIds,
                appearDuration: parseFloat(formData.appearDuration) || 3,
                disappearDuration: parseFloat(formData.disappearDuration) || 2,
                timingVariance: parseFloat(formData.timingVariance) || 20,
                effectType: formData.effectType,
                detectEnabled: formData.detectEnabled === 'on' || formData.detectEnabled === true,
                detectionAction: formData.detectionAction || 'notify'
            })
            
            if (!patrol) return
            
            ui.notifications.info(
                game.i18n.format(`${MODULE_ID}.notifications.patrolCreated`, { name: patrol.name })
            )
            
            // Start immediately
            await patrol.start()
            
            this.sessionWaypoints = []
            this.close()
        })
    }
    
    /**
     * Start waypoint placement mode
     */
    _startWaypointPlacement() {
        if (this.isPlacingWaypoints) return
        
        // Check manager exists
        if (!this.manager) {
            ui.notifications.error('Patrol system not initialized. Please wait for the game to fully load.')
            console.error('RNK Patrol | PatrolCreatorApp: manager is null - game.rnkPatrol.manager not initialized')
            return
        }
        
        this.isPlacingWaypoints = true
        
        // Notification
        ui.notifications.info('Click on the map to place waypoints. Press ESC or click "Done Placing" to finish.', { permanent: false })
        
        // Add cursor style
        document.body.classList.add('rnk-patrol-placing')
        
        // Store reference to this for closure
        const self = this
        
        // Canvas click handler - place waypoints
        this._clickHandler = async (event) => {
            // Only handle left clicks
            if (event.data.button !== 0) return
            
            // Double-check manager still exists
            if (!self.manager) {
                ui.notifications.error('Patrol manager not available')
                self._stopWaypointPlacement()
                return
            }
            
            const pos = event.data.getLocalPosition(canvas.stage)
            
            // Snap to grid center
            const snapped = canvas.grid.getSnappedPoint({ x: pos.x, y: pos.y }, { mode: CONST.GRID_SNAPPING_MODES.CENTER })
            
            try {
                // Create waypoint
                const waypoint = await self.manager.createWaypoint({
                    x: snapped.x,
                    y: snapped.y,
                    name: `Waypoint ${self.sessionWaypoints.length + 1}`
                })
                
                // Add to session
                self.sessionWaypoints.push(waypoint)
                
                // Refresh display (but stay in placement mode)
                self.render(false)
                
                // Flash notification
                ui.notifications.info(`Waypoint ${self.sessionWaypoints.length} placed! (${self.sessionWaypoints.length >= 2 ? 'Ready to save' : 'Need at least 2'})`)
            } catch (err) {
                console.error('RNK Patrol | Failed to create waypoint:', err)
                ui.notifications.error('Failed to create waypoint')
            }
        }
        
        // Escape key handler - stop placement
        this._keyHandler = (event) => {
            if (event.key === 'Escape') {
                this._stopWaypointPlacement()
            }
        }
        
        canvas.stage.on('pointerdown', this._clickHandler)
        document.addEventListener('keydown', this._keyHandler)
        
        // Re-render to show "Done Placing" button
        this.render(false)
    }
    
    /**
     * Stop waypoint placement mode
     */
    _stopWaypointPlacement() {
        if (!this.isPlacingWaypoints) return
        
        this.isPlacingWaypoints = false
        
        // Remove cursor style
        document.body.classList.remove('rnk-patrol-placing')
        
        // Remove handlers
        if (this._clickHandler) {
            canvas.stage.off('pointerdown', this._clickHandler)
            this._clickHandler = null
        }
        
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler)
            this._keyHandler = null
        }
        
        ui.notifications.info(`Placement complete. ${this.sessionWaypoints.length} waypoints ready.`)
        
        // Re-render
        this.render(false)
    }
    
    /**
     * Delete a session waypoint
     * @param {string} waypointId 
     */
    async _deleteSessionWaypoint(waypointId) {
        // Find in session
        const index = this.sessionWaypoints.findIndex(w => w.id === waypointId)
        if (index === -1) return
        
        // Delete from manager (removes visual and scene data)
        await this.manager.deleteWaypoint(waypointId)
        
        // Remove from session list
        this.sessionWaypoints.splice(index, 1)
        
        // Re-render
        this.render(false)
        
        ui.notifications.info('Waypoint deleted')
    }
    
    /**
     * Delete an existing waypoint (from scene, not session)
     * @param {string} waypointId 
     */
    async _deleteExistingWaypoint(waypointId) {
        const confirm = await Dialog.confirm({
            title: 'Delete Waypoint',
            content: 'Are you sure you want to delete this waypoint? It will be removed from any patrols using it.'
        })
        
        if (!confirm) return
        
        await this.manager.deleteWaypoint(waypointId)
        this.render(false)
        
        ui.notifications.info('Waypoint deleted')
    }
    
    /**
     * Clear all session waypoints
     */
    async _clearAllSessionWaypoints() {
        if (this.sessionWaypoints.length === 0) return
        
        const confirm = await Dialog.confirm({
            title: 'Clear All Waypoints',
            content: `Delete all ${this.sessionWaypoints.length} waypoints you've placed?`
        })
        
        if (!confirm) return
        
        // Delete all from manager
        for (const waypoint of this.sessionWaypoints) {
            await this.manager.deleteWaypoint(waypoint.id)
        }
        
        this.sessionWaypoints = []
        this.render(false)
        
        ui.notifications.info('All waypoints cleared')
    }
    
    /**
     * Clean up on close
     */
    async close(options = {}) {
        // Stop placement mode if active
        this._stopWaypointPlacement()
        
        // Remove waypoint click hook
        if (this._waypointClickHook) {
            Hooks.off('rnkPatrol.waypointClicked', this._waypointClickHook)
            this._waypointClickHook = null
        }
        
        return super.close(options)
    }
}
