/**
 * RNK Patrol - Patrol Assignment Application
 * 
 * Quick UI for assigning a token to an existing patrol.
 * 
 * @module PatrolAssignmentApp
 */

import { MODULE_ID } from '../main.js'

/**
 * PatrolAssignmentApp - Assign token to patrol
 */
export class PatrolAssignmentApp extends Application {
    
    constructor(token, options = {}) {
        super(options)
        this.token = token
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-patrol-assignment',
            title: game.i18n.localize(`${MODULE_ID}.apps.assignment.title`),
            template: `modules/${MODULE_ID}/templates/patrol-assignment.hbs`,
            classes: ['rnk-patrol', 'patrol-assignment'],
            width: 350,
            height: 'auto'
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
        const patrols = this.manager?.getPatrols() ?? []
        const currentPatrol = patrols.find(p => p.tokenId === this.token.id)
        
        return {
            tokenName: this.token.name,
            tokenId: this.token.id,
            currentPatrolId: currentPatrol?.id,
            currentPatrolName: currentPatrol?.name,
            patrols: patrols.map(p => ({
                id: p.id,
                name: p.name,
                hasToken: !!p.tokenId,
                tokenName: p.token?.name,
                isCurrent: p.tokenId === this.token.id
            }))
        }
    }
    
    /**
     * Activate listeners
     */
    activateListeners(html) {
        super.activateListeners(html)
        
        // Assign to patrol
        html.find('[data-action="assign"]').click(async (event) => {
            const patrolId = event.currentTarget.dataset.patrolId
            const patrol = this.manager.getPatrol(patrolId)
            
            if (patrol) {
                // Unassign from current patrol if any
                const currentPatrol = this.manager.getPatrolForToken(this.token.id)
                if (currentPatrol && currentPatrol.id !== patrolId) {
                    currentPatrol.tokenId = null
                    await currentPatrol.save()
                }
                
                // Assign to new patrol
                patrol.tokenId = this.token.id
                await patrol.save()
                
                ui.notifications.info(
                    game.i18n.format(`${MODULE_ID}.notifications.tokenAssigned`, {
                        token: this.token.name,
                        patrol: patrol.name
                    })
                )
                
                this.render()
            }
        })
        
        // Unassign
        html.find('[data-action="unassign"]').click(async () => {
            const currentPatrol = this.manager.getPatrolForToken(this.token.id)
            
            if (currentPatrol) {
                await currentPatrol.stop()
                currentPatrol.tokenId = null
                await currentPatrol.save()
                
                ui.notifications.info(
                    game.i18n.format(`${MODULE_ID}.notifications.tokenUnassigned`, {
                        token: this.token.name
                    })
                )
                
                this.render()
            }
        })
        
        // Create new patrol for this token
        html.find('[data-action="create-patrol"]').click(async () => {
            const { PatrolCreatorApp } = await import('./PatrolCreatorApp.js')
            new PatrolCreatorApp({ token: this.token }).render(true)
            this.close()
        })
    }
}
