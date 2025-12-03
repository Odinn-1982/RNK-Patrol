/**
 * RNK Patrol - Patrol Config Application
 * 
 * UI for editing existing patrol configuration.
 * 
 * @module PatrolConfigApp
 */

import { MODULE_ID, PATROL_MODES, BLINK_PATTERNS } from '../main.js'

/**
 * PatrolConfigApp - Edit patrol configuration
 */
export class PatrolConfigApp extends FormApplication {
    
    constructor(patrolOrId, options = {}) {
        // Accept either a patrol object or a patrol ID string
        let patrol = patrolOrId
        if (typeof patrolOrId === 'string') {
            patrol = game.rnkPatrol?.manager?.getPatrol(patrolOrId)
        }
        super(patrol, options)
        this.patrol = patrol
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-patrol-config',
            title: game.i18n.localize(`${MODULE_ID}.apps.config.title`),
            template: `modules/${MODULE_ID}/templates/patrol-config.hbs`,
            classes: ['rnk-patrol', 'patrol-config'],
            width: 500,
            height: 'auto',
            tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'general' }],
            closeOnSubmit: false,
            submitOnChange: true
        })
    }
    
    /**
     * Get manager
     */
    get manager() {
        return game.rnkPatrol?.manager
    }
    
    /**
     * Prepare data
     */
    getData(options = {}) {
        const patrol = this.patrol
        
        // Safety check - if patrol not found, return minimal data
        if (!patrol || typeof patrol.toJSON !== 'function') {
            console.warn('PatrolConfigApp: Patrol not found or invalid')
            return { patrol: null, tokens: [], waypoints: [], modes: [], blinkPatterns: [], actors: [] }
        }
        
        const tokens = canvas.tokens.placeables.map(t => ({
            id: t.id,
            name: t.name,
            selected: patrol.tokenId === t.id
        }))
        
        const allWaypoints = this.manager?.getWaypoints() ?? []
        const patrolWaypointIds = new Set(patrol.waypointIds)
        
        const actors = game.actors.contents
            .filter(a => !a.hasPlayerOwner)
            .map(a => ({ id: a.id, name: a.name, img: a.img }))

        return {
            patrol: {
                ...patrol.toJSON(),
                tagsString: patrol.tags?.join(', ') || ''
            },
            tokens,
            waypoints: allWaypoints.map(w => ({
                id: w.id,
                name: w.name,
                selected: patrolWaypointIds.has(w.id),
                order: patrol.waypointIds.indexOf(w.id)
            })).sort((a, b) => {
                // Selected first, then by order
                if (a.selected && !b.selected) return -1
                if (!a.selected && b.selected) return 1
                if (a.selected && b.selected) return a.order - b.order
                return a.name.localeCompare(b.name)
            }),
            modes: Object.entries(PATROL_MODES).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.patrolModes.${value}`),
                selected: value === patrol.mode
            })),
            patterns: Object.entries(BLINK_PATTERNS).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.blinkPatterns.${value}`),
                selected: value === patrol.blinkPattern
            })),
            effectTypes: [
                { value: 'fade', label: game.i18n.localize(`${MODULE_ID}.effectTypes.fade`), selected: patrol.effectType === 'fade' },
                { value: 'flash', label: game.i18n.localize(`${MODULE_ID}.effectTypes.flash`), selected: patrol.effectType === 'flash' },
                { value: 'smoke', label: game.i18n.localize(`${MODULE_ID}.effectTypes.smoke`), selected: patrol.effectType === 'smoke' },
                { value: 'portal', label: game.i18n.localize(`${MODULE_ID}.effectTypes.portal`), selected: patrol.effectType === 'portal' },
                { value: 'shadow', label: game.i18n.localize(`${MODULE_ID}.effectTypes.shadow`), selected: patrol.effectType === 'shadow' },
                { value: 'glitch', label: game.i18n.localize(`${MODULE_ID}.effectTypes.glitch`), selected: patrol.effectType === 'glitch' },
                { value: 'none', label: game.i18n.localize(`${MODULE_ID}.effectTypes.none`), selected: patrol.effectType === 'none' }
            ],
            detectionActions: [
                { value: 'notify', label: game.i18n.localize(`${MODULE_ID}.detectionTriggers.notify`), selected: patrol.detectionAction === 'notify' },
                { value: 'alert', label: game.i18n.localize(`${MODULE_ID}.detectionTriggers.alert`), selected: patrol.detectionAction === 'alert' },
                { value: 'combat', label: game.i18n.localize(`${MODULE_ID}.detectionTriggers.combat`), selected: patrol.detectionAction === 'combat' },
                { value: 'macro', label: game.i18n.localize(`${MODULE_ID}.detectionTriggers.macro`), selected: patrol.detectionAction === 'macro' },
                { value: 'none', label: game.i18n.localize(`${MODULE_ID}.detectionTriggers.none`), selected: patrol.detectionAction === 'none' }
            ],
            macros: game.macros.contents.map(m => ({
                id: m.id,
                name: m.name,
                selected: patrol.detectionMacro === m.id
            })),
            isActive: patrol.isActive,
            isPaused: patrol.isPaused
        }
    }
    
    /**
     * Handle form submission
     */
    async _updateObject(event, formData) {
        // Get selected waypoints in order
        const waypointIds = []
        const form = event.target
        const waypointCheckboxes = form.querySelectorAll('[name="waypoints"]:checked')
        waypointCheckboxes.forEach(cb => waypointIds.push(cb.value))
        
        // Parse tags from comma-separated string
        const tags = (formData.tags || '')
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0)
        
        // Update patrol
        Object.assign(this.patrol, {
            name: formData.name,
            tokenId: formData.tokenId,
            guardActorId: formData.guardActorId || null,
            mode: formData.mode,
            blinkPattern: formData.blinkPattern,
            waypointIds,
            appearDuration: formData.appearDuration,
            disappearDuration: formData.disappearDuration,
            timingVariance: formData.timingVariance,
            effectType: formData.effectType,
            color: formData.color || null,
            detectEnabled: formData.detectEnabled ?? false,
            detectionAction: formData.detectionAction,
            detectionMacro: formData.detectionMacro || null,
            disabled: formData.disabled ?? false,
            notes: formData.notes || '',
            tags,
            automateCombat: formData.automateCombat === 'on' || formData.automateCombat === true,
            automateDecisions: formData.automateDecisions === 'on' || formData.automateDecisions === true,
            automateRequireApproval: (formData.automateRequireApproval === 'inherit') ? null : (formData.automateRequireApproval === 'enabled'),
            aggressiveness: formData.aggressiveness || 'normal'
        })
        
        await this.patrol.save()
        
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.patrolUpdated`))
    }
    
    /**
     * Activate listeners
     */
    activateListeners(html) {
        super.activateListeners(html)
        
        // Control buttons
        html.find('[data-action="start"]').click(async () => {
            await this.patrol.start()
            this.render()
        })
        
        html.find('[data-action="stop"]').click(async () => {
            await this.patrol.stop()
            this.render()
        })
        
        html.find('[data-action="pause"]').click(async () => {
            await this.patrol.pause()
            this.render()
        })
        
        html.find('[data-action="resume"]').click(async () => {
            await this.patrol.resume()
            this.render()
        })
        
        // Delete
        html.find('[data-action="delete"]').click(async () => {
            const confirmed = await Dialog.confirm({
                title: game.i18n.localize(`${MODULE_ID}.apps.config.confirmDelete`),
                content: game.i18n.format(`${MODULE_ID}.apps.config.confirmDeleteContent`, { name: this.patrol.name })
            })
            
            if (confirmed) {
                await this.manager.deletePatrol(this.patrol.id)
                this.close()
            }
        })
        
        // Waypoint reordering (drag & drop)
        const waypointList = html.find('.waypoint-list')
        if (waypointList.length) {
            this._initSortable(waypointList[0])
        }
        
        // Pan to token
        html.find('[data-action="pan-to-token"]').click(() => {
            const token = this.patrol.token
            if (token) {
                canvas.animatePan({ x: token.center.x, y: token.center.y })
            }
        })
        
        // Show detection action options
        html.find('[name="detectionAction"]').change((event) => {
            const macroGroup = html.find('.macro-group')
            if (event.target.value === 'macro') {
                macroGroup.show()
            } else {
                macroGroup.hide()
            }
        })
        
        // Add new waypoint
        html.find('[data-action="add-waypoint"]').click(async () => {
            await this._onAddWaypoint()
        })
        
        // Link existing waypoint
        html.find('[data-action="add-existing-waypoint"]').click(async () => {
            await this._onLinkExistingWaypoint()
        })
        
        // Pan to waypoint
        html.find('[data-action="pan-to-waypoint"]').click(async (event) => {
            const waypointId = event.currentTarget.dataset.waypointId
            await this._onPanToWaypoint(waypointId)
        })
    }
    
    /**
     * Add a new waypoint at a clicked position
     */
    async _onAddWaypoint() {
        ui.notifications.info('Click on the canvas to place a new waypoint. Press Escape to cancel.')
        
        // Minimize this window temporarily
        this.minimize()
        
        // Set up click handler
        const clickHandler = async (event) => {
            // Get canvas coordinates from the click
            const t = canvas.stage.worldTransform
            const x = (event.clientX - t.tx) / canvas.stage.scale.x
            const y = (event.clientY - t.ty) / canvas.stage.scale.y
            
            // Create waypoint
            const waypoint = await this.manager.createWaypoint({
                x,
                y,
                name: `${this.patrol.name} WP ${this.patrol.waypointIds.length + 1}`
            })
            
            // Add to patrol
            this.patrol.waypointIds.push(waypoint.id)
            await this.patrol.save()
            
            // Clean up and refresh
            canvas.stage.off('click', clickHandler)
            document.removeEventListener('keydown', escHandler)
            this.maximize()
            this.render()
            
            ui.notifications.info(`Waypoint added: ${waypoint.name}`)
        }
        
        const escHandler = (event) => {
            if (event.key === 'Escape') {
                canvas.stage.off('click', clickHandler)
                document.removeEventListener('keydown', escHandler)
                this.maximize()
                ui.notifications.info('Waypoint placement cancelled.')
            }
        }
        
        canvas.stage.on('click', clickHandler)
        document.addEventListener('keydown', escHandler)
    }
    
    /**
     * Link an existing unassigned waypoint
     */
    async _onLinkExistingWaypoint() {
        const allWaypoints = this.manager?.getWaypoints() ?? []
        const patrolWaypointIds = new Set(this.patrol.waypointIds)
        
        // Find waypoints not already in this patrol
        const availableWaypoints = allWaypoints.filter(w => !patrolWaypointIds.has(w.id))
        
        if (availableWaypoints.length === 0) {
            ui.notifications.warn('No available waypoints to link. Create a new waypoint instead.')
            return
        }
        
        const options = availableWaypoints.map(w => 
            `<option value="${w.id}">${w.name}</option>`
        ).join('')
        
        new Dialog({
            title: 'Link Existing Waypoint',
            content: `
                <form>
                    <div class="form-group">
                        <label>Select Waypoint</label>
                        <select name="waypointId" style="width: 100%;">
                            ${options}
                        </select>
                    </div>
                </form>
            `,
            buttons: {
                link: {
                    icon: '<i class="fas fa-link"></i>',
                    label: 'Link',
                    callback: async (html) => {
                        const waypointId = html.find('[name="waypointId"]').val()
                        if (waypointId) {
                            this.patrol.waypointIds.push(waypointId)
                            await this.patrol.save()
                            this.render()
                            ui.notifications.info('Waypoint linked to patrol.')
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            default: 'link'
        }).render(true)
    }
    
    /**
     * Pan canvas to a waypoint
     */
    async _onPanToWaypoint(waypointId) {
        const waypoint = this.manager?.getWaypoint(waypointId)
        if (waypoint) {
            canvas.animatePan({ x: waypoint.x, y: waypoint.y })
        }
    }
    
    /**
     * Initialize sortable for waypoint reordering
     */
    _initSortable(element) {
        // Simple drag-drop implementation
        let draggedItem = null
        
        element.querySelectorAll('.waypoint-item').forEach(item => {
            item.draggable = true
            
            item.addEventListener('dragstart', (e) => {
                draggedItem = item
                item.classList.add('dragging')
            })
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging')
                draggedItem = null
            })
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault()
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect()
                    const midY = rect.top + rect.height / 2
                    
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedItem, item)
                    } else {
                        item.parentNode.insertBefore(draggedItem, item.nextSibling)
                    }
                }
            })
        })
    }

    /** @override */
    async render(force = false, options = {}) {
        // Preserve scroll position in the tab content area across re-renders
        const content = this.element?.find('.content')[0];
        const scrollTop = content ? content.scrollTop : 0;

        await super.render(force, options);

        const newContent = this.element?.find('.content')[0];
        if (newContent) newContent.scrollTop = scrollTop;

        return this;
    }
}
