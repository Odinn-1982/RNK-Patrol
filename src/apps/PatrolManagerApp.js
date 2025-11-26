/**
 * RNK Patrol - Patrol Manager Application
 * 
 * Main UI for managing all patrols in the scene.
 * 
 * @module PatrolManagerApp
 */

import { MODULE_ID, PATROL_MODES, PATROL_STATES, BLINK_PATTERNS } from '../main.js'

/**
 * PatrolManagerApp - Main patrol management UI
 */
export class PatrolManagerApp extends Application {
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-patrol-manager',
            title: game.i18n.localize(`${MODULE_ID}.apps.manager.title`),
            template: `modules/${MODULE_ID}/templates/patrol-manager.hbs`,
            classes: ['rnk-patrol', 'patrol-manager'],
            width: 500,
            height: 'auto',
            resizable: true,
            scrollY: ['.patrol-list']
        })
    }
    
    /**
     * Get manager instance
     */
    get manager() {
        return game.rnkPatrol?.manager
    }
    
    /**
     * Get current patrols
     */
    get patrols() {
        return this.manager?.getPatrols() ?? []
    }
    
    /**
     * Prepare data for template
     */
    getData(options = {}) {
        const patrols = this.patrols.map(p => ({
            ...p.toJSON(),
            stateName: game.i18n.localize(`${MODULE_ID}.states.${p.state}`),
            modeName: game.i18n.localize(`${MODULE_ID}.patrolModes.${p.mode}`),
            waypointCount: p.waypointIds.length,
            tokenName: p.token?.name ?? game.i18n.localize(`${MODULE_ID}.apps.manager.noToken`),
            isActive: p.isActive,
            isPaused: p.isPaused,
            hasAlert: p.alertLevel > 0
        }))
        
        const stats = this.manager?.getStatistics() ?? {}
        
        return {
            patrols,
            stats,
            hasPatrols: patrols.length > 0,
            modes: Object.entries(PATROL_MODES).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.patrolModes.${value}`)
            })),
            patterns: Object.entries(BLINK_PATTERNS).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.blinkPatterns.${value}`)
            }))
        }
    }
    
    /**
     * Activate listeners
     */
    activateListeners(html) {
        super.activateListeners(html)
        
        // Patrol actions
        html.find('[data-action="start"]').click(this._onStartPatrol.bind(this))
        html.find('[data-action="stop"]').click(this._onStopPatrol.bind(this))
        html.find('[data-action="pause"]').click(this._onPausePatrol.bind(this))
        html.find('[data-action="edit"]').click(this._onEditPatrol.bind(this))
        html.find('[data-action="delete"]').click(this._onDeletePatrol.bind(this))
        html.find('[data-action="select-token"]').click(this._onSelectToken.bind(this))
        
        // Bulk actions
        html.find('[data-action="start-all"]').click(this._onStartAll.bind(this))
        html.find('[data-action="stop-all"]').click(this._onStopAll.bind(this))
        html.find('[data-action="pause-all"]').click(this._onPauseAll.bind(this))
        
        // Create
        html.find('[data-action="create-patrol"]').click(this._onCreatePatrol.bind(this))
        html.find('[data-action="create-waypoint"]').click(this._onCreateWaypoint.bind(this))
        
        // Import/Export
        html.find('[data-action="export"]').click(this._onExport.bind(this))
        html.find('[data-action="import"]').click(this._onImport.bind(this))
        
        // Refresh
        html.find('[data-action="refresh"]').click(() => this.render())
    }
    
    // ==========================================
    // Event Handlers
    // ==========================================
    
    async _onStartPatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]').dataset.patrolId
        const patrol = this.manager.getPatrol(patrolId)
        
        if (patrol) {
            if (patrol.isPaused) {
                await patrol.resume()
            } else {
                await patrol.start()
            }
            this.render()
        }
    }
    
    async _onStopPatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]').dataset.patrolId
        const patrol = this.manager.getPatrol(patrolId)
        
        if (patrol) {
            await patrol.stop()
            this.render()
        }
    }
    
    async _onPausePatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]').dataset.patrolId
        const patrol = this.manager.getPatrol(patrolId)
        
        if (patrol) {
            await patrol.pause()
            this.render()
        }
    }
    
    async _onEditPatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]').dataset.patrolId
        const patrol = this.manager.getPatrol(patrolId)
        
        if (patrol) {
            const { PatrolConfigApp } = await import('./PatrolConfigApp.js')
            new PatrolConfigApp(patrol).render(true)
        }
    }
    
    async _onDeletePatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]').dataset.patrolId
        const patrol = this.manager.getPatrol(patrolId)
        
        if (!patrol) return
        
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(`${MODULE_ID}.apps.manager.confirmDelete`),
            content: game.i18n.format(`${MODULE_ID}.apps.manager.confirmDeleteContent`, { name: patrol.name })
        })
        
        if (confirmed) {
            await this.manager.deletePatrol(patrolId)
            this.render()
        }
    }
    
    async _onSelectToken(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]').dataset.patrolId
        const patrol = this.manager.getPatrol(patrolId)
        
        if (!patrol) return
        
        // Get available tokens
        const tokens = canvas.tokens.placeables.filter(t => !t.document.isLinked)
        
        if (tokens.length === 0) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.noTokens`))
            return
        }
        
        const options = tokens.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
        
        const content = `
            <form>
                <div class="form-group">
                    <label>${game.i18n.localize(`${MODULE_ID}.apps.manager.selectToken`)}</label>
                    <select name="tokenId">${options}</select>
                </div>
            </form>
        `
        
        new Dialog({
            title: game.i18n.localize(`${MODULE_ID}.apps.manager.assignToken`),
            content,
            buttons: {
                assign: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize(`${MODULE_ID}.buttons.assign`),
                    callback: async (html) => {
                        const tokenId = html.find('[name="tokenId"]').val()
                        patrol.tokenId = tokenId
                        await patrol.save()
                        this.render()
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize(`${MODULE_ID}.buttons.cancel`)
                }
            },
            default: 'assign'
        }).render(true)
    }
    
    async _onStartAll() {
        await this.manager?.startAll()
        this.render()
    }
    
    async _onStopAll() {
        await this.manager?.stopAll()
        this.render()
    }
    
    async _onPauseAll() {
        await this.manager?.pauseAll()
        this.render()
    }
    
    async _onCreatePatrol() {
        const { PatrolCreatorApp } = await import('./PatrolCreatorApp.js')
        new PatrolCreatorApp().render(true)
    }
    
    async _onCreateWaypoint() {
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.clickToPlace`))
        
        // Enter waypoint placement mode
        const handler = async (event) => {
            const pos = event.data.getLocalPosition(canvas.stage)
            
            await this.manager.createWaypoint({
                x: pos.x,
                y: pos.y
            })
            
            canvas.stage.off('pointerdown', handler)
            ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.waypointCreated`))
        }
        
        canvas.stage.on('pointerdown', handler)
    }
    
    async _onExport() {
        const data = this.manager.exportPatrols()
        const filename = `patrol-export-${canvas.scene.name}-${Date.now()}.json`
        
        saveDataToFile(JSON.stringify(data, null, 2), 'application/json', filename)
        
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.exported`))
    }
    
    async _onImport() {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        
        input.onchange = async (event) => {
            const file = event.target.files[0]
            if (!file) return
            
            const text = await file.text()
            
            try {
                const data = JSON.parse(text)
                
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize(`${MODULE_ID}.apps.manager.confirmImport`),
                    content: game.i18n.format(`${MODULE_ID}.apps.manager.confirmImportContent`, {
                        patrols: data.patrols?.length ?? 0,
                        waypoints: data.waypoints?.length ?? 0
                    })
                })
                
                if (confirmed) {
                    await this.manager.importPatrols(data)
                    this.render()
                }
            } catch (err) {
                ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.importError`))
                console.error(err)
            }
        }
        
        input.click()
    }
}
