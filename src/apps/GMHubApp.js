            
/**
 * RNK Patrol - GM Hub
 * Central command center for all patrol operations
 */

import { MODULE_ID, MODULE_NAME, PATROL_MODES, PATROL_STATES, BLINK_PATTERNS, ALERT_STATES } from '../main.js';
import { getSetting, setSetting } from '../settings.js';

export class GMHubApp extends Application {
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rnk-patrol-gm-hub',
            title: game.i18n.localize(`${MODULE_ID}.apps.gmHub.title`),
            template: `modules/${MODULE_ID}/templates/gm-hub.hbs`,
            classes: ['rnk-patrol', 'gm-hub'],
            width: 1000,
            height: 700,
            resizable: true,
            scrollY: ['.panel-content', '.settings-form'],
            tabs: [{navSelector: '.nav-tabs', contentSelector: '.hub-main', initial: 'patrols'}]
        });
    }
    
    constructor(options = {}) {
        super(options);
        this.activeTab = 'patrols';
        this.selectedPatrolId = null;
        this.refreshInterval = null;
        this.isMinimized = false;
        // When true, auto-refresh will be suspended (e.g. while editing inputs)
        this._suspendAutoRefresh = false;
        // Timer used to debounce scroll interactions
        this._scrollTimer = null;
        // Timer for deferred rendering when updates occur during suspension
        this._deferredRenderTimer = null;
        
        // Bind methods
        this._onPatrolUpdate = this._onPatrolUpdate.bind(this);
    }

    /** @override */
    async getData(options = {}) {
        const manager = game.rnkPatrol?.manager;
        const patrols = manager?.getPatrols() ?? [];
        
        // Calculate statistics
        const stats = this._calculateStats(patrols);
        
        // Get scene tokens for quick patrol creation
        const sceneTokens = canvas.tokens?.placeables
            .filter(t => !t.document.hidden && t.actor)
            .map(t => ({
                id: t.id,
                name: t.name,
                img: t.document.texture.src,
                hasPatrol: patrols.some(p => p.tokenId === t.id)
            })) ?? [];

        // Format patrols for display
        const formattedPatrols = patrols.map(p => this._formatPatrolData(p));
        
        // Get recent activity log
        const activityLog = this._getActivityLog();
        
        // Get capture system settings
        const captureEnabled = getSetting('captureEnabled', true);
        const captureRange = getSetting('captureRange', 2);
        let outcomeWeights = getSetting('captureOutcomeWeights', {
            combat: 30, theft: 25, relocate: 20, disregard: 15, jail: 10
        });
        // Validate outcome weights total - if not 100%, reset to defaults
        const weightsTotal = Object.values(outcomeWeights).reduce((a, b) => a + b, 0);
        if (weightsTotal !== 100) {
            console.warn(`rnk-patrol | Outcome weights total ${weightsTotal}%, resetting to defaults`);
            outcomeWeights = { combat: 30, theft: 25, relocate: 20, disregard: 15, jail: 10 };
        }
        const outcomeWeightsTotal = Object.values(outcomeWeights).reduce((a, b) => a + b, 0);
        const briberyEnabled = getSetting('briberyEnabled', true);
        const briberyBaseCost = getSetting('briberyBaseCost', 50);
        const briberyChance = getSetting('briberyChance', 70);
        
        // Get bleed-out settings
        const bleedOutEnabled = getSetting('bleedOutEnabled', true);
        const bleedOutThreshold = getSetting('bleedOutThreshold', 25);
        const bleedOutBaseDC = getSetting('bleedOutBaseDC', 12);
        const bleedOutPlayerControl = getSetting('bleedOutPlayerControl', 'player') || 'player';
        
        // Get bark system settings
        const barksEnabled = getSetting('barksEnabled', true);
        const barkVolume = getSetting('barkVolume', 0.5);
        const barkCooldown = getSetting('barkCooldown', 2000);
        const customBarkPaths = getSetting('customBarkPaths', {});
        
        // Get telegraph settings
        const telegraphEnabled = getSetting('telegraphEnabled', true);
        const telegraphStyle = getSetting('telegraphStyle', 'ripple');
        const telegraphDuration = getSetting('telegraphDuration', 1500);
        const telegraphColor = getSetting('telegraphColor', '#ff4444');
        const telegraphGMOnly = getSetting('telegraphGMOnly', false);
        
        // Get jail settings
        const jailEnabled = getSetting('jailEnabled', true);
        const jailDefaultDuration = getSetting('jailDefaultDuration', 120);
        const jailEscapeEnabled = getSetting('jailEscapeEnabled', true);
        const jailEscapeDC = getSetting('jailEscapeDC', 15);
        const jailScenes = this._getJailScenes();
        // Get cached guard actor info for each jail scene
        const jailSystem = game.rnkPatrol?.jailSystem
        const jailSceneGuardInfo = jailScenes.filter(s => s.sceneId).map(s => {
            const actor = jailSystem?.getSceneGuardActor?.(s.sceneId)
            return {
                sceneId: s.sceneId || '',
                sceneName: s.sceneName || 'Unknown',
                prisonerCount: s.prisonerCount || 0,
                guardActorId: actor?.id || null,
                guardActorName: actor?.name || null,
                guardActorImg: actor?.img || null
                ,guardActorLocked: jailSystem?.isGuardActorLocked?.(s.sceneId) || false
            }
        })
        const prisoners = this._getPrisoners();
        // Sanitize aiLog entries to ensure all have required fields
        const rawAiLog = game.rnkPatrol?.getAiLog?.() || [];
        const aiLog = rawAiLog.map(entry => ({
            ...entry,
            type: entry.type || 'unknown',
            message: entry.message || '',
            timestamp: entry.timestamp || Date.now()
        }));
        const aiPending = game.rnkPatrol?.getPendingActions?.() || [];
        
        // Bark categories for UI
        const barkCategories = [
            { key: 'spawn', label: 'Spawn', icon: 'fas fa-plus-circle', path: customBarkPaths.spawn || '' },
            { key: 'despawn', label: 'Despawn', icon: 'fas fa-minus-circle', path: customBarkPaths.despawn || '' },
            { key: 'capture', label: 'Capture', icon: 'fas fa-handcuffs', path: customBarkPaths.capture || '' },
            { key: 'disregard', label: 'Disregard', icon: 'fas fa-hand-paper', path: customBarkPaths.disregard || '' },
            { key: 'theft', label: 'Theft', icon: 'fas fa-coins', path: customBarkPaths.theft || '' },
            { key: 'bribery_accept', label: 'Bribery Accept', icon: 'fas fa-check', path: customBarkPaths.bribery_accept || '' },
            { key: 'bribery_reject', label: 'Bribery Reject', icon: 'fas fa-times', path: customBarkPaths.bribery_reject || '' },
            { key: 'bribery_doublecross', label: 'Bribery Double-Cross', icon: 'fas fa-exclamation', path: customBarkPaths.bribery_doublecross || '' }
        ];
        
        // Jail templates (must match JAIL_CONFIGS keys in JailSystem.js)
        const jailTemplates = [
            { key: 'jail_1', name: 'Jail 1', icon: 'fas fa-dungeon', description: 'Castle dungeon with multiple cells' }
        ];

        return {
            stats,
            patrols: formattedPatrols,
            sceneTokens,
            activityLog,
            selectedPatrol: this.selectedPatrolId ? 
                formattedPatrols.find(p => p.id === this.selectedPatrolId) : null,
            modes: Object.entries(PATROL_MODES).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.modes.${value}`)
            })),
            patterns: Object.entries(BLINK_PATTERNS).map(([key, value]) => ({
                value,
                label: game.i18n.localize(`${MODULE_ID}.patterns.${value}`)
            })),
            hasPatrols: patrols.length > 0,
            isGM: game.user.isGM,
            selectedPatrolId: this.selectedPatrolId || '',
            
            // Capture settings
            captureEnabled,
            captureRange,
            outcomeWeights,
            outcomeWeightsTotal,
            briberyEnabled,
            briberyBaseCost,
            briberyChance,
            
            // Bleed-out settings
            bleedOutEnabled,
            bleedOutThreshold,
            bleedOutBaseDC,
            bleedOutPlayerControl,
            
            // Detection settings
            enableDetection: getSetting('enableDetection', true),
            defaultDetectionRange: getSetting('defaultDetectionRange', 5),
            detectionTrigger: getSetting('detectionTrigger', 'notify'),
            sightCheckMethod: getSetting('sightCheckMethod', 'ray'),
            detectHiddenPlayers: getSetting('detectHiddenPlayers', false),
            detectInvisible: getSetting('detectInvisible', false),
            maxActivePatrols: getSetting('maxActivePatrols', 20),
            updateInterval: getSetting('updateInterval', 500),
            
            // Bark settings
            barksEnabled,
            barkVolume,
            barkVolumePercent: Math.round(barkVolume * 100),
            barkCooldown,
            barkCategories,
            
            // Telegraph settings
            telegraphEnabled,
            telegraphStyle,
            telegraphDuration,
            telegraphColor,
            telegraphGMOnly,
            
            // Jail settings
            jailEnabled,
            jailDefaultDuration,
            jailEscapeEnabled,
            jailEscapeDC,
            jailScenes,
            jailSceneGuardInfo,
            jailTemplates,
            prisoners,
            defaultGuardActor: this._getDefaultGuardActor(),
            defaultInmateActor: this._getDefaultInmateActor(),
            aiLog,
            aiPending,
            adapters: (game.rnkPatrol?.systemAdapters?.adapters ? Object.entries(game.rnkPatrol.systemAdapters.adapters).map(([k, a]) => ({ systemId: k, name: a.constructor?.name || 'Adapter', capabilities: Object.keys(a).filter(x => typeof a[x] === 'function').join(', ') })) : []),
            tests: [
                { id: 'simulatePending', name: 'Simulate Pending', desc: 'Push & pop a pending AI action using helper' },
                { id: 'simulateBribe', name: 'Simulate Bribe', desc: 'Simulate a bribe flow using the module helper (prompts for actor/patrol if needed)' },
                { id: 'simulateUndo', name: 'Simulate Undo', desc: 'Simulate theft and create an undo AI log entry' },
                { id: 'simulateMultiUndo', name: 'Simulate Multi Undo', desc: 'Simulate theft removing gold and an item, then call central undo helper' },
                { id: 'adapterTest', name: 'Adapter Diagnostic', desc: 'Run the adapter test for the currently selected token' },
                { id: 'midiTest', name: 'MidiQOL Logging Test', desc: 'Run a MidiQOL item use test to validate AI log enrichment (requires MidiQOL & an attack item)' },
                { id: 'autoResolve', name: 'Auto Resolve Test', desc: 'Create a small combat and call autoResolveCombat for diagnostics' }
            ],
            // AI / Automation settings
            aiProvider: getSetting('aiProvider', 'system'),
            aiApiKey: getSetting('aiApiKey', ''),
            automateDecisions: getSetting('automateDecisions', false),
            automateCombat: getSetting('automateCombat', false),
            automateRequireApproval: getSetting('automateRequireApproval', false),
            aiPendingMaxEntries: getSetting('aiPendingMaxEntries', 100),
            combatAutomationLevel: getSetting('combatAutomationLevel', 'assisted'),
            autoResolveAffectsPlayers: getSetting('autoResolveAffectsPlayers', false),
            autoPerformSuggestions: getSetting('autoPerformSuggestions', false),
            midiQolLoggingLevel: getSetting('midiQolLoggingLevel', 'minimal'),
            
            // Scene info
            scene: canvas.scene ? { name: canvas.scene.name } : { name: 'No Scene' },
            version: game.modules.get(MODULE_ID)?.version || '1.0.0'
        };
    }
    
    /**
     * Get jail scenes (from JailSystem)
     */
    _getJailScenes() {
        // Get from JailSystem if available
        if (game.rnkPatrol?.jailSystem) {
            return game.rnkPatrol.jailSystem.getJailScenesWithInfo();
        }
        
        // Fallback: look for scenes with our jail flag
        const scenes = [];
        for (const scene of game.scenes) {
            if (scene.getFlag(MODULE_ID, 'isHardcodedJail')) {
                scenes.push({
                    sceneId: scene.id,
                    sceneName: scene.name,
                    configKey: scene.getFlag(MODULE_ID, 'jailConfigKey'),
                    prisonerCount: 0
                });
            }
        }
        
        return scenes;
    }
    
    /**
     * Get current prisoners
     */
    _getPrisoners() {
        const prisonerData = getSetting('prisonerData', {});
        const prisoners = [];
        
        for (const [actorId, data] of Object.entries(prisonerData)) {
            const actor = game.actors.get(actorId);
            if (actor && data.jailed) {
                const jailScene = game.scenes.get(data.sceneId);
                const timeRemaining = data.releaseTime ? 
                    Math.max(0, Math.ceil((data.releaseTime - Date.now()) / 1000)) : 'Indefinite';
                
                prisoners.push({
                    actorId,
                    name: actor.name,
                    img: actor.img,
                    jailName: jailScene?.name || 'Unknown Jail',
                    timeRemaining: typeof timeRemaining === 'number' ? `${timeRemaining}s` : timeRemaining
                });
            }
        }
        
        return prisoners;
    }

    /**
     * Get default guard actor info from settings
     */
    _getDefaultGuardActor() {
        const customizations = getSetting('jailCustomizations', {})
        const guardInfo = customizations.defaultGuardActor
        if (!guardInfo) return null
        
        // If it's a world actor, get current info
        if (guardInfo.actorId && !guardInfo.pack) {
            const actor = game.actors.get(guardInfo.actorId)
            if (actor) {
                return { actorId: actor.id, name: actor.name, img: actor.img }
            }
        }
        
        // Return compendium info as-is
        return guardInfo
    }

    /**
     * Get default inmate actor info from settings
     */
    _getDefaultInmateActor() {
        const customizations = getSetting('jailCustomizations', {})
        const inmateInfo = customizations.defaultInmateActor
        if (!inmateInfo) return null
        
        // If it's a world actor, get current info
        if (inmateInfo.actorId && !inmateInfo.pack) {
            const actor = game.actors.get(inmateInfo.actorId)
            if (actor) {
                return { actorId: actor.id, name: actor.name, img: actor.img }
            }
        }
        
        // Return compendium info as-is
        return inmateInfo
    }

    /**
     * Calculate patrol statistics
     */
    _calculateStats(patrols) {
        const total = patrols.length;
        const active = patrols.filter(p => p.state === PATROL_STATES.ACTIVE).length;
        const paused = patrols.filter(p => p.state === PATROL_STATES.PAUSED).length;
        const alert = patrols.filter(p => p.alertState !== ALERT_STATES.IDLE).length;
        const blink = patrols.filter(p => p.mode === PATROL_MODES.BLINK).length;
        const walk = patrols.filter(p => p.mode === PATROL_MODES.WALK).length;
        
        return {
            total,
            active,
            paused,
            stopped: total - active - paused,
            alert,
            blink,
            walk,
            hybrid: total - blink - walk,
            coverage: this._calculateCoverage(patrols)
        };
    }

    /**
     * Calculate map coverage percentage
     */
    _calculateCoverage(patrols) {
        if (!canvas.scene) return 0;
        
        const sceneArea = canvas.scene.width * canvas.scene.height;
        let coveredArea = 0;
        
        for (const patrol of patrols) {
            const waypoints = patrol.waypoints || [];
            for (const wp of waypoints) {
                const radius = (wp.detectionRadius || 3) * canvas.grid.size;
                coveredArea += Math.PI * radius * radius;
            }
        }
        
        // Cap at 100% and round
        return Math.min(100, Math.round((coveredArea / sceneArea) * 100));
    }

    /**
     * Format patrol data for display
     */
    _formatPatrolData(patrol) {
        const token = canvas.tokens?.get(patrol.tokenId);
        const guardActor = patrol.guardActorId ? game.actors.get(patrol.guardActorId) : null
        
        return {
            id: patrol.id,
            name: patrol.name,
            tokenId: patrol.tokenId,
            tokenName: token?.name || 'Unknown Token',
            tokenImg: token?.document.texture.src || 'icons/svg/mystery-man.svg',
            mode: patrol.mode,
            modeLabel: game.i18n.localize(`${MODULE_ID}.modes.${patrol.mode}`),
            modeIcon: this._getModeIcon(patrol.mode),
            state: patrol.state,
            stateLabel: game.i18n.localize(`${MODULE_ID}.status.${patrol.state}`),
            stateClass: this._getStateClass(patrol.state),
            alertState: patrol.alertState,
            alertLabel: game.i18n.localize(`${MODULE_ID}.alerts.${patrol.alertState}`),
            isAlert: patrol.alertState !== ALERT_STATES.IDLE,
            waypointCount: patrol.waypoints?.length || 0,
            currentWaypoint: patrol.currentWaypointIndex + 1,
            pattern: patrol.blinkPattern,
            patternLabel: game.i18n.localize(`${MODULE_ID}.patterns.${patrol.blinkPattern}`),
            isActive: patrol.state === PATROL_STATES.ACTIVE,
            isPaused: patrol.state === PATROL_STATES.PAUSED,
            isStopped: patrol.state === PATROL_STATES.IDLE,
            color: patrol.color || '#4a90d9'
            ,guardActorId: patrol.guardActorId || null
            ,guardActorName: guardActor?.name || null
            ,guardActorImg: guardActor?.img || null
            ,aggressiveness: patrol.aggressiveness || 'normal'
            ,automateCombat: patrol.automateCombat === true ? 'enabled' : (patrol.automateCombat === false ? 'disabled' : 'inherit')
            ,automateDecisions: patrol.automateDecisions === true ? 'enabled' : (patrol.automateDecisions === false ? 'disabled' : 'inherit')
            ,automateRequireApproval: patrol.automateRequireApproval === true ? 'enabled' : (patrol.automateRequireApproval === false ? 'disabled' : 'inherit')
        };
    }

    /**
     * Get icon for patrol mode
     */
    _getModeIcon(mode) {
        const icons = {
            [PATROL_MODES.BLINK]: 'fa-bolt',
            [PATROL_MODES.WALK]: 'fa-walking',
            [PATROL_MODES.HYBRID]: 'fa-random'
        };
        return icons[mode] || 'fa-route';
    }

    /**
     * Get CSS class for patrol state
     */
    _getStateClass(state) {
        const classes = {
            [PATROL_STATES.ACTIVE]: 'active',
            [PATROL_STATES.PAUSED]: 'paused',
            [PATROL_STATES.IDLE]: 'stopped',
            [PATROL_STATES.ALERT]: 'alert'
        };
        return classes[state] || 'stopped';
    }

    /**
     * Get recent activity log
     */
    _getActivityLog() {
        // This would pull from a stored activity log
        // For now, return placeholder
        return game.rnkPatrol?.activityLog || [];
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Restore active tab after render
        if (this.activeTab) {
            html.find('.nav-item').removeClass('active');
            html.find(`.nav-item[data-tab="${this.activeTab}"]`).addClass('active');
            html.find('.tab-panel').removeClass('active');
            html.find(`.tab-panel[data-tab="${this.activeTab}"]`).addClass('active');
        }

        // Tab navigation (custom handling for new layout)
        html.find('.nav-item').click(ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const tab = ev.currentTarget.dataset.tab;
            if (!tab) return;
            
            // Update nav active state
            html.find('.nav-item').removeClass('active');
            $(ev.currentTarget).addClass('active');
            
            // Show corresponding panel
            html.find('.tab-panel').removeClass('active');
            html.find(`.tab-panel[data-tab="${tab}"]`).addClass('active');
            
            this.activeTab = tab;
        });

        // Global controls
        html.find('[data-action="start-all"]').click(() => this._onStartAll());
        html.find('[data-action="stop-all"]').click(() => this._onStopAll());
        html.find('[data-action="pause-all"]').click(() => this._onPauseAll());
        html.find('[data-action="create-patrol"]').click(() => this._onCreatePatrol());
        html.find('[data-action="import-patrols"]').click(() => this._onImportPatrols());
        html.find('[data-action="export-patrols"]').click(() => this._onExportPatrols());
        html.find('[data-action="refresh"]').click(() => this.render(false));

        // Individual patrol controls
        html.find('[data-action="start-patrol"]').click(ev => this._onPatrolAction(ev, 'start'));
        html.find('[data-action="stop-patrol"]').click(ev => this._onPatrolAction(ev, 'stop'));
        html.find('[data-action="pause-patrol"]').click(ev => this._onPatrolAction(ev, 'pause'));
        html.find('[data-action="resume-patrol"]').click(ev => this._onPatrolAction(ev, 'resume'));
        html.find('[data-action="edit-patrol"]').click(ev => this._onEditPatrol(ev));
        html.find('[data-action="delete-patrol"]').click(ev => this._onDeletePatrol(ev));
        html.find('[data-action="assign-guard"]').click(ev => this._onAssignGuard(ev));
        html.find('[data-action="clear-patrol-guard"]').click(ev => this._onClearPatrolGuard(ev));
        html.find('[data-action="toggle-patrol-automation"]').click(ev => this._onTogglePatrolAutomation(ev));
        html.find('[data-action="toggle-patrol-decisions"]').click(ev => this._onTogglePatrolDecisions(ev));
        html.find('[data-action="toggle-patrol-approval"]').click(ev => this._onTogglePatrolApproval(ev));
        html.find('[data-action="cycle-patrol-aggressiveness"]').click(ev => this._onCyclePatrolAggressiveness(ev));
        html.find('[data-action="pan-to-patrol"]').click(ev => this._onPanToPatrol(ev));
        html.find('[data-action="select-patrol"]').click(ev => this._onSelectPatrol(ev));

        // Quick patrol creation from token
        html.find('[data-action="quick-patrol"]').click(ev => this._onQuickPatrol(ev));

        // Patrol card selection
        html.find('.patrol-card').click(ev => {
            const patrolId = ev.currentTarget.dataset.patrolId;
            this._selectPatrol(patrolId);
        });

        // Search and filter
        html.find('.patrol-search').on('input', ev => this._onSearch(ev));
        html.find('.filter-btn').click(ev => this._onFilter(ev));

        // ==================== Capture System ====================
        html.find('[data-action="save-capture-settings"]').click(() => this._saveCaptureSettings(html));
        
        // Update weight total on change
        html.find('[name^="weight-"]').on('input', (ev) => {
            // Update the individual range value display
            $(ev.currentTarget).siblings('.range-val').text(ev.currentTarget.value);
            this._updateWeightTotal(html);
        });
        
        // Reset weights button
        html.find('.reset-weights').click(() => {
            html.find('[name="weight-combat"]').val(30).siblings('.range-val').text('30');
            html.find('[name="weight-theft"]').val(25).siblings('.range-val').text('25');
            html.find('[name="weight-relocate"]').val(20).siblings('.range-val').text('20');
            html.find('[name="weight-disregard"]').val(15).siblings('.range-val').text('15');
            html.find('[name="weight-jail"]').val(10).siblings('.range-val').text('10');
            this._updateWeightTotal(html);
        });
        
        // Initialize weight total display
        this._updateWeightTotal(html);
        
        // Range slider value display
        html.find('input[type="range"]').on('input', (ev) => {
            const span = $(ev.currentTarget).siblings('.range-value');
            const val = ev.currentTarget.value;
            if (ev.currentTarget.name === 'briberyChance') {
                span.text(`${val}%`);
            } else if (ev.currentTarget.name === 'bleedOutThreshold') {
                span.text(`${val}%`);
            } else if (ev.currentTarget.name === 'barkVolume') {
                span.text(`${Math.round(val * 100)}%`);
            } else if (ev.currentTarget.name === 'telegraphDuration') {
                span.text(`${val}ms`);
            }
        });
        
        // Set bleedOutPlayerControl select value from data
        const bleedOutCtrl = this.object?.bleedOutPlayerControl || getSetting('bleedOutPlayerControl', 'player') || 'player';
        html.find('[name="bleedOutPlayerControl"]').val(bleedOutCtrl);

        // ==================== Detection Settings ====================
        html.find('[data-action="save-detection-settings"]').click(() => this._saveDetectionSettings(html));

        // ==================== Bark System ====================
        html.find('[data-action="save-bark-settings"]').click(() => this._saveBarkSettings(html));
        html.find('[data-action="test-bark"]').click(ev => this._testBark(ev));
        html.find('[data-action="browse-bark"]').click(ev => this._browseBarkFolder(ev));

        // ==================== Telegraph System ====================
        html.find('[data-action="save-telegraph-settings"]').click(() => this._saveTelegraphSettings(html));
        html.find('[data-action="preview-telegraph"]').click(() => this._previewTelegraph());

        // ==================== Jail System ====================
        html.find('[data-action="save-jail-settings"]').click(() => this._saveJailSettings(html));
        html.find('[data-action="create-jail"]').click(ev => this._createJailScene(ev));
        html.find('[data-action="visit-jail"]').click(ev => this._visitJail(ev));
        html.find('[data-action="reset-jail"]').click(ev => this._resetJail(ev));
        html.find('[data-action="delete-jail"]').click(ev => this._deleteJail(ev));
        html.find('[data-action="edit-jail"]').click(ev => this._editJailConfig(ev));
        html.find('[data-action="pick-random-guard"]').click(ev => this._onPickRandomGuard(ev));
        html.find('[data-action="clear-guard"]').click(ev => this._onClearGuard(ev));
        html.find('[data-action="toggle-guard-lock"]').click(ev => this._onToggleGuardLock(ev));
        html.find('[data-action="clear-all-scene-guards"]').click(ev => this._onClearAllSceneGuards(ev));
        html.find('[data-action="choose-guard"]').click(ev => this._onChooseGuard(ev));
        html.find('[data-action="release-prisoner"]').click(ev => this._releasePrisoner(ev));
        html.find('[data-action="visit-prisoner"]').click(ev => this._visitPrisoner(ev));
        html.find('[data-action="release-all-prisoners"]').click(() => this._releaseAllPrisoners());
        // Compendium token picker actions
        html.find('[data-action="pick-default-guard-compendium"]').click(() => this._openCompendiumPicker('guard'));
        html.find('[data-action="pick-default-guard-world"]').click(() => this._openWorldActorPicker('guard'));
        html.find('[data-action="pick-default-inmate-compendium"]').click(() => this._openCompendiumPicker('inmate'));
        html.find('[data-action="pick-default-inmate-world"]').click(() => this._openWorldActorPicker('inmate'));
        html.find('[data-action="clear-default-guard"]').click(() => this._clearDefaultActor('guard'));
        html.find('[data-action="clear-default-inmate"]').click(() => this._clearDefaultActor('inmate'));

        // ==================== AI / Automation ====================
        html.find('[data-action="save-ai-settings"]').click(() => this._saveAiSettings(html));
        html.find('[name="aiProvider"]').on('change', (ev) => {
            const val = $(ev.currentTarget).val();
            if (val === 'openai') {
                html.find('.ai-api-key').show();
            } else {
                html.find('.ai-api-key').hide();
            }
        });

        // ==================== Utilities ====================
        html.find('[data-action="clear-all-waypoints"]').click(() => this._clearAllWaypoints());
        html.find('[data-action="clear-ai-log"]').click(() => this._clearAiLog());
        html.find('[data-action="export-ai-log"]').click(() => this._exportAiLog());
        html.find('[data-action="undo-ai-log"]').click(ev => this._onUndoAiLogEntry(ev));
        html.find('[data-action="approve-ai-pending"]').click(ev => this._onApproveAiPending(ev));
        html.find('[data-action="reject-ai-pending"]').click(ev => this._onRejectAiPending(ev));
        html.find('[data-action="replay-ai-log"]').click(ev => this._onReplayAiLogEntry(ev));
        // Diagnostics & Tests
        html.find('[data-action="show-adapter-info"]').click(ev => this._onShowAdapterInfo(ev));
        html.find('[data-action="run-adapter-test"]').click(ev => this._onRunAdapterTest(ev));
        html.find('[data-action="copy-adapter-summary"]').click(ev => this._onCopyAdapterSummary(ev));
        html.find('[data-action="run-test"]').click(ev => this._onRunTest(ev));
        html.find('[data-action="run-all-tests"]').click(ev => this._onRunAllTests(ev));

        // Keyboard shortcuts
        html.on('keydown', ev => this._onKeydown(ev));

        // Suspend auto-refresh while the user is interacting with form fields
        html.find('input, textarea, select').on('focus', () => {
            this._suspendAutoRefresh = true;
        });
        html.find('input, textarea, select').on('blur', () => {
            // Delay clearing the suspend flag to avoid re-render while user is still working
            // Use a longer delay (1 second) to account for token spawns that might steal focus
            setTimeout(() => { 
                // Double-check that user isn't still editing
                const stillEditing = document.activeElement && 
                    this.element[0]?.contains(document.activeElement) &&
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
                if (!stillEditing) {
                    this._suspendAutoRefresh = false; 
                }
            }, 1000);
        });

        // Also suspend auto-refresh while the user is scrolling or hovering the hub
        const hubElement = html.find('.hub');
        if (hubElement && hubElement.length) {
            // On scroll: suspend and debounce a short period after scrolling stops
            hubElement.on('scroll', '*', () => {
                this._suspendAutoRefresh = true;
                if (this._scrollTimer) clearTimeout(this._scrollTimer);
                this._scrollTimer = setTimeout(() => {
                    this._suspendAutoRefresh = false;
                    this._scrollTimer = null;
                }, 2000); // Keep suspended for 2s after scroll ends
            });

            // On mouse enter, suspend; on leave, clear after short delay
            hubElement.on('mouseenter', () => {
                this._suspendAutoRefresh = true;
            });
            hubElement.on('mouseleave', () => {
                setTimeout(() => {
                    // Only clear if not actively focused in an input
                    if (!this.element.find('input:focus, textarea:focus, select:focus').length) {
                        this._suspendAutoRefresh = false;
                    }
                }, 2000); // Wait 2 seconds after mouse leaves
            });
        }

        // Register for patrol updates
        Hooks.on(`${MODULE_ID}.patrolUpdate`, this._onPatrolUpdate);

        // Start auto-refresh
        this._startAutoRefresh();
    }

    async _onTogglePatrolAutomation(event) {
        event.preventDefault()
        const card = $(event.currentTarget).closest('.patrol-card')
        const patrolId = card.data('patrol-id')
        if (!patrolId) return

        const manager = game.rnkPatrol?.manager
        const patrol = manager?.getPatrol(patrolId)
        if (!patrol) return

        // Toggle patch: if null -> enable (true), if true -> disable (false), if false -> set to null (inherit)
        let nextVal = null
        if (patrol.automateCombat === null) nextVal = true
        else if (patrol.automateCombat === true) nextVal = false
        else nextVal = null

        patrol.automateCombat = nextVal
        await patrol.save()
        this.render(false)
    }

    async _onTogglePatrolDecisions(event) {
        event.preventDefault()
        const card = $(event.currentTarget).closest('.patrol-card')
        const patrolId = card.data('patrol-id')
        if (!patrolId) return

        const manager = game.rnkPatrol?.manager
        const patrol = manager?.getPatrol(patrolId)
        if (!patrol) return

        // Toggle: null -> enabled(true) -> disabled(false) -> null
        let nextVal = null
        if (patrol.automateDecisions === null) nextVal = true
        else if (patrol.automateDecisions === true) nextVal = false
        else nextVal = null

        patrol.automateDecisions = nextVal
        await patrol.save()
        this.render(false)
    }

    async _onTogglePatrolApproval(event) {
        const btn = $(event.currentTarget)
        const card = btn.closest('.patrol-card')
        const id = card.data('patrol-id')
        const patrol = game.rnkPatrol?.manager?.getPatrol(id)
        if (!patrol) return
        // Provide explicit choice via Dialog: Inherit / Require Approval / Do Not Require
        const content = `
            <p>Choose approval behavior for <strong>${patrol.name}</strong>:</p>
            <div class="form-group">
                <label><input type="radio" name="choice" value="inherit" ${patrol.automateRequireApproval === null ? 'checked' : ''}/> Inherit</label>
            </div>
            <div class="form-group">
                <label><input type="radio" name="choice" value="enabled" ${patrol.automateRequireApproval === true ? 'checked' : ''}/> Require Approval</label>
            </div>
            <div class="form-group">
                <label><input type="radio" name="choice" value="disabled" ${patrol.automateRequireApproval === false ? 'checked' : ''}/> Do Not Require</label>
            </div>
        `
        const dlg = new Dialog({
            title: 'Set AI Approval for Patrol',
            content,
            buttons: {
                save: { icon: '<i class="fas fa-save"></i>', label: 'Save', callback: async (html) => {
                    const choice = html.find('input[name="choice"]:checked').val()
                    const newVal = choice === 'inherit' ? null : (choice === 'enabled')
                    patrol.automateRequireApproval = newVal
                    await patrol.save()
                    this.render(false)
                }},
                cancel: { icon: '<i class="fas fa-times"></i>', label: 'Cancel' }
            }
        })
        dlg.render(true)
    }

    async _onCyclePatrolAggressiveness(event) {
        event.preventDefault()
        const card = $(event.currentTarget).closest('.patrol-card')
        const patrolId = card.data('patrol-id')
        if (!patrolId) return

        const manager = game.rnkPatrol?.manager
        const patrol = manager?.getPatrol(patrolId)
        if (!patrol) return

        const order = ['conservative', 'normal', 'aggressive']
        const next = (cur) => {
            const i = order.indexOf(cur)
            return order[(i+1) % order.length]
        }

        patrol.aggressiveness = next(patrol.aggressiveness || 'normal')
        await patrol.save()
        this.render(false)
    }

    /**
     * Pick a random NPC actor to use as the guard for a scene
     */
    _onPickRandomGuard(ev) {
        const sceneId = ev.currentTarget.dataset.sceneId
        const jailSystem = game.rnkPatrol?.jailSystem
        if (!jailSystem) return
        const actor = jailSystem.getRandomNpcActor(sceneId)
        if (!actor) {
            ui.notifications.warn('No NPC actors available to assign as guards')
            return
        }
        jailSystem.setSceneGuardActor(sceneId, actor.id)
        ui.notifications.info(`Assigned ${actor.name} as guard for scene`) 
        this.render()
    }

    /**
     * Clear the chosen guard actor for a scene
     */
    _onClearGuard(ev) {
        const sceneId = ev.currentTarget.dataset.sceneId
        const jailSystem = game.rnkPatrol?.jailSystem
        if (!jailSystem) return
        jailSystem.clearSceneGuardActor(sceneId)
        ui.notifications.info('Cleared guard selection for scene')
        this.render()
    }

    _onToggleGuardLock(ev) {
        const sceneId = ev.currentTarget.dataset.sceneId
        const jailSystem = game.rnkPatrol?.jailSystem
        if (!jailSystem) return
        const checked = ev.currentTarget.checked
        // Persist per-scene flag on the scene itself so it persists
        const scene = game.scenes.get(sceneId)
        if (!scene) return
        scene.setFlag(MODULE_ID, 'guardActorLocked', checked)
        ui.notifications.info(checked ? 'Guard actor locked for scene' : 'Guard actor unlocked for scene')
        this.render()
    }

    _onClearAllSceneGuards(ev) {
        const jailSystem = game.rnkPatrol?.jailSystem
        if (!jailSystem) return
        const jailScenes = this._getJailScenes() || []
        const previousCache = new Map(jailSystem._sceneGuardActor)
        for (const s of jailScenes) {
            jailSystem.clearSceneGuardActor(s.sceneId)
        }
        ui.notifications.info('Cleared cached guard actor for all jail scenes. Undo?', {buttons: [{label: 'Undo'}]})
        // Provide a small undo mechanism with a notification button via Dialog
        const dialog = new Dialog({
            title: 'Guard Cache Cleared',
            content: '<p>Guard actor cache cleared for all jail scenes. Click Undo to restore.</p>',
            buttons: {
                undo: {
                    label: 'Undo',
                    callback: () => {
                        for (const [sceneId, actorId] of previousCache) {
                            jailSystem.setSceneGuardActor(sceneId, actorId)
                        }
                        ui.notifications.info('Restored guard actor cache for all jail scenes')
                        this.render()
                    }
                },
                ok: { label: 'OK' }
            },
            default: 'ok'
        })
        dialog.render(true)
        this.render()
    }

    async _onChooseGuard(ev) {
        const sceneId = ev.currentTarget.dataset.sceneId
        const jailSystem = game.rnkPatrol?.jailSystem
        if (!jailSystem) return
        // Prepare list of NPC actors
        const actors = game.actors.contents.filter(a => !a.hasPlayerOwner)
        const options = actors.reduce((acc, a) => acc + `<option value="${a.id}">${a.name}</option>`, '')
        const content = `
            <div style="padding:12px;">
                <label>Select Guard Actor</label>
                <select id="select-guard-actor" style="width:100%; padding:6px; margin-top:8px;">${options}</select>
            </div>
        `
        const dialog = new Dialog({
            title: 'Choose Guard Actor',
            content,
            buttons: {
                ok: {
                    label: 'Assign',
                    callback: (html) => {
                        const actorId = html.find('#select-guard-actor').val()
                        if (actorId) {
                            jailSystem.setSceneGuardActor(sceneId, actorId)
                            const actor = game.actors.get(actorId)
                            ui.notifications.info(`Assigned ${actor?.name} as guard for scene`)
                            this.render()
                        }
                    }
                },
                cancel: {
                    label: 'Cancel'
                }
            },
            default: 'ok'
        })
        dialog.render(true)
    }

    async _onAssignGuard(ev) {
        const patrolId = ev.currentTarget.closest('.patrol-card')?.dataset?.patrolId
        if (!patrolId) return
        const manager = game.rnkPatrol?.manager
        const patrol = manager?.getPatrols?.().find(p => p.id === patrolId)
        if (!patrol) return

        const actors = game.actors.contents.filter(a => !a.hasPlayerOwner)
        if (!actors.length) {
            ui.notifications.warn('No NPC actors available')
            return
        }
        const options = actors.reduce((acc, a) => acc + `<option value="${a.id}" ${a.id === patrol.guardActorId ? 'selected' : ''}>${a.name}</option>`, '')
        const content = `<div style="padding:12px;"><label>Select Guard Actor for ${patrol.name}</label><select id="select-patrol-guard" style="width:100%; padding:6px; margin-top:8px;"><option value="">-- Clear --</option>${options}</select></div>`
        const dialog = new Dialog({
            title: `Assign Guard Actor for ${patrol.name}`,
            content,
            buttons: {
                ok: {
                    label: 'Assign',
                    callback: async (html) => {
                        const actorId = html.find('#select-patrol-guard').val() || null
                        patrol.guardActorId = actorId || null
                        await patrol.save()
                        ui.notifications.info(`Assigned ${actorId ? game.actors.get(actorId)?.name : 'No Actor'} to patrol ${patrol.name}`)
                        this.render()
                    }
                },
                cancel: { label: 'Cancel' }
            },
            default: 'ok'
        })
        dialog.render(true)
    }

    async _onClearPatrolGuard(ev) {
        const patrolId = ev.currentTarget.closest('.patrol-card')?.dataset?.patrolId
        if (!patrolId) return
        const manager = game.rnkPatrol?.manager
        const patrol = manager?.getPatrols?.().find(p => p.id === patrolId)
        if (!patrol) return
        patrol.guardActorId = null
        await patrol.save()
        ui.notifications.info(`Cleared guard actor for patrol ${patrol.name}`)
        this.render()
    }

    /**
     * Open the compendium actor picker for guard or inmate selection
     * @param {string} mode - 'guard' or 'inmate'
     */
    async _openCompendiumPicker(mode) {
        // Dynamically import to avoid circular dependencies
        const { CompendiumActorPicker } = await import('./CompendiumActorPicker.js')
        
        const picker = new CompendiumActorPicker({
            mode,
            callback: async (result) => {
                await this._handleActorSelection(result)
            }
        })
        picker.render(true)
    }

    /**
     * Open a simple dialog to pick from world actors
     * @param {string} mode - 'guard' or 'inmate'
     */
    async _openWorldActorPicker(mode) {
        const actors = game.actors.filter(a => !a.hasPlayerOwner)
        if (!actors.length) {
            ui.notifications.warn('No NPC actors available in the world')
            return
        }

        const options = actors.map(a => 
            `<option value="${a.id}">${a.name}</option>`
        ).join('')

        const modeLabel = mode === 'guard' ? 'Guard' : 'Inmate'
        const content = `
            <div class="rnk-patrol" style="padding: 12px;">
                <p>Select a world actor to use as the default ${modeLabel.toLowerCase()} in jail scenes:</p>
                <div class="form-group">
                    <select id="world-actor-select" style="width: 100%; padding: 8px; margin-top: 8px;">
                        ${options}
                    </select>
                </div>
            </div>
        `

        const dialog = new Dialog({
            title: `Select ${modeLabel} Actor`,
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Select',
                    callback: async (html) => {
                        const actorId = html.find('#world-actor-select').val()
                        const actor = game.actors.get(actorId)
                        if (actor) {
                            await this._handleActorSelection({
                                mode,
                                actor: {
                                    actorId: actor.id,
                                    name: actor.name,
                                    img: actor.img,
                                    pack: null,
                                    uuid: actor.uuid
                                }
                            })
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            default: 'ok'
        }, { width: 400, classes: ['rnk-patrol'] })
        
        dialog.render(true)
    }

    /**
     * Handle the result of actor selection from picker dialogs
     * @param {Object} result - { mode, actor: { actorId, name, img, pack, uuid } }
     */
    async _handleActorSelection(result) {
        const { mode, actor } = result
        const customizations = getSetting('jailCustomizations') || {}

        if (mode === 'guard') {
            customizations.defaultGuardActor = actor
            ui.notifications.info(`Set default guard actor: ${actor?.name || 'None'}`)
        } else if (mode === 'inmate') {
            customizations.defaultInmateActor = actor
            ui.notifications.info(`Set default inmate actor: ${actor?.name || 'None'}`)
        }

        await setSetting('jailCustomizations', customizations)
        this.render()
    }

    /**
     * Clear the default guard or inmate actor
     * @param {string} mode - 'guard' or 'inmate'
     */
    async _clearDefaultActor(mode) {
        const customizations = getSetting('jailCustomizations') || {}

        if (mode === 'guard') {
            delete customizations.defaultGuardActor
            ui.notifications.info('Cleared default guard actor')
        } else if (mode === 'inmate') {
            delete customizations.defaultInmateActor
            ui.notifications.info('Cleared default inmate actor')
        }

        await setSetting('jailCustomizations', customizations)
        this.render()
    }

    /**
     * Open the jail configuration editor dialog
     */
    async _editJailConfig(ev) {
        const sceneId = ev.currentTarget.dataset.sceneId
        const configKey = ev.currentTarget.dataset.configKey
        const jailSystem = game.rnkPatrol?.jailSystem
        if (!jailSystem) return

        const scene = game.scenes.get(sceneId)
        if (!scene) {
            ui.notifications.error('Jail scene not found')
            return
        }

        const config = jailSystem.getMergedJailConfig(configKey) || {}
        const customizations = jailSystem.getJailCustomizations(configKey) || {}

        const content = `
            <div class="rnk-patrol jail-config-editor" style="padding: 12px;">
                <h3><i class="fas fa-dungeon"></i> ${scene.name}</h3>
                
                <div class="form-group">
                    <label>Captured Spawn Point</label>
                    <div class="coordinate-inputs">
                        <input type="number" name="capturedX" value="${config.capturedSpawnPoint?.x || 100}" placeholder="X">
                        <input type="number" name="capturedY" value="${config.capturedSpawnPoint?.y || 100}" placeholder="Y">
                    </div>
                </div>

                <div class="form-group">
                    <label>Group Spawn Point (Rescue Party)</label>
                    <div class="coordinate-inputs">
                        <input type="number" name="groupX" value="${config.groupSpawnPoint?.x || 500}" placeholder="X">
                        <input type="number" name="groupY" value="${config.groupSpawnPoint?.y || 500}" placeholder="Y">
                    </div>
                </div>

                <h4>Guard Spawn Points</h4>
                <div class="spawn-list guards-list">
                    ${(config.guardSpawns || []).map((g, i) => `
                        <div class="spawn-item">
                            <span class="spawn-name">${g.name || `Guard ${i+1}`}</span>
                            <input type="number" name="guardX${i}" value="${g.x}" placeholder="X">
                            <input type="number" name="guardY${i}" value="${g.y}" placeholder="Y">
                        </div>
                    `).join('')}
                </div>

                <h4>Inmate Spawn Points</h4>
                <div class="spawn-list inmates-list">
                    ${(config.inmateSpawns || []).map((im, i) => `
                        <div class="spawn-item">
                            <span class="spawn-name">${im.name || `Inmate ${i+1}`}</span>
                            <input type="number" name="inmateX${i}" value="${im.x}" placeholder="X">
                            <input type="number" name="inmateY${i}" value="${im.y}" placeholder="Y">
                        </div>
                    `).join('')}
                </div>
            </div>
        `

        const dialog = new Dialog({
            title: `Edit Jail Configuration`,
            content,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: 'Save',
                    callback: async (html) => {
                        const newCustomizations = {
                            capturedSpawnPoint: {
                                x: parseInt(html.find('[name="capturedX"]').val()) || 100,
                                y: parseInt(html.find('[name="capturedY"]').val()) || 100
                            },
                            groupSpawnPoint: {
                                x: parseInt(html.find('[name="groupX"]').val()) || 500,
                                y: parseInt(html.find('[name="groupY"]').val()) || 500
                            },
                            guardSpawns: (config.guardSpawns || []).map((g, i) => ({
                                ...g,
                                x: parseInt(html.find(`[name="guardX${i}"]`).val()) || g.x,
                                y: parseInt(html.find(`[name="guardY${i}"]`).val()) || g.y
                            })),
                            inmateSpawns: (config.inmateSpawns || []).map((im, i) => ({
                                ...im,
                                x: parseInt(html.find(`[name="inmateX${i}"]`).val()) || im.x,
                                y: parseInt(html.find(`[name="inmateY${i}"]`).val()) || im.y
                            }))
                        }

                        await jailSystem.saveJailCustomizations(configKey, newCustomizations)
                        ui.notifications.info(`Saved jail configuration for ${scene.name}`)
                        this.render()
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            default: 'save'
        }, { width: 500, classes: ['rnk-patrol'] })

        dialog.render(true)
    }
    
    /**
     * Update weight total display
     */
    _updateWeightTotal(html) {
        let total = 0;
        html.find('[name^="weight-"]').each((i, el) => {
            total += parseInt(el.value) || 0;
        });
        html.find('.total-value').text(total);
        html.find('.weight-total').toggleClass('error', total !== 100);
    }
    
    /**
     * Save capture system settings
     */
    async _saveCaptureSettings(html) {
        const captureEnabled = html.find('[name="captureEnabled"]').prop('checked');
        const captureRange = parseInt(html.find('[name="captureRange"]').val()) || 2;
        const briberyEnabled = html.find('[name="briberyEnabled"]').prop('checked');
        const briberyBaseCost = parseInt(html.find('[name="briberyBaseCost"]').val()) || 50;
        const briberyChance = parseInt(html.find('[name="briberyChance"]').val()) || 70;
        
        // Bleed-out settings
        const bleedOutEnabled = html.find('[name="bleedOutEnabled"]').prop('checked');
        const bleedOutThreshold = parseInt(html.find('[name="bleedOutThreshold"]').val()) || 25;
        const bleedOutBaseDC = parseInt(html.find('[name="bleedOutBaseDC"]').val()) || 12;
        const bleedOutPlayerControl = html.find('[name="bleedOutPlayerControl"]').val() || 'player';
        
        const outcomeWeights = {
            combat: parseInt(html.find('[name="weight-combat"]').val()) || 0,
            theft: parseInt(html.find('[name="weight-theft"]').val()) || 0,
            relocate: parseInt(html.find('[name="weight-relocate"]').val()) || 0,
            disregard: parseInt(html.find('[name="weight-disregard"]').val()) || 0,
            jail: parseInt(html.find('[name="weight-jail"]').val()) || 0
        };
        
        // Validate total
        const total = Object.values(outcomeWeights).reduce((a, b) => a + b, 0);
        if (total !== 100) {
            ui.notifications.warn(`Outcome weights must total 100% (currently ${total}%)`);
            return;
        }
        
        await setSetting('captureEnabled', captureEnabled);
        await setSetting('captureRange', captureRange);
        await setSetting('captureOutcomeWeights', outcomeWeights);
        await setSetting('briberyEnabled', briberyEnabled);
        await setSetting('briberyBaseCost', briberyBaseCost);
        await setSetting('briberyChance', briberyChance);
        
        // Save bleed-out settings
        await setSetting('bleedOutEnabled', bleedOutEnabled);
        await setSetting('bleedOutThreshold', bleedOutThreshold);
        await setSetting('bleedOutBaseDC', bleedOutBaseDC);
        await setSetting('bleedOutPlayerControl', bleedOutPlayerControl);
        
        // Update capture system if it exists
        if (game.rnkPatrol?.captureSystem) {
            game.rnkPatrol.captureSystem.updateSettings();
        }
        
        ui.notifications.info('Capture settings saved!');
    }
    
    /**
     * Save detection settings
     */
    async _saveDetectionSettings(html) {
        const enableDetection = html.find('[name="enableDetection"]').prop('checked');
        const defaultDetectionRange = parseInt(html.find('[name="defaultDetectionRange"]').val()) || 5;
        const detectionTrigger = html.find('[name="detectionTrigger"]').val() || 'notify';
        const sightCheckMethod = html.find('[name="sightCheckMethod"]').val() || 'ray';
        const detectHiddenPlayers = html.find('[name="detectHiddenPlayers"]').prop('checked');
        const detectInvisible = html.find('[name="detectInvisible"]').prop('checked');
        const maxActivePatrols = parseInt(html.find('[name="maxActivePatrols"]').val()) || 20;
        const updateInterval = parseInt(html.find('[name="updateInterval"]').val()) || 500;
        
        await setSetting('enableDetection', enableDetection);
        await setSetting('defaultDetectionRange', defaultDetectionRange);
        await setSetting('detectionTrigger', detectionTrigger);
        await setSetting('sightCheckMethod', sightCheckMethod);
        await setSetting('detectHiddenPlayers', detectHiddenPlayers);
        await setSetting('detectInvisible', detectInvisible);
        await setSetting('maxActivePatrols', maxActivePatrols);
        await setSetting('updateInterval', updateInterval);
        
        ui.notifications.info('Detection settings saved!');
    }
    
    /**
     * Save bark system settings
     */
    async _saveBarkSettings(html) {
        const barksEnabled = html.find('[name="barksEnabled"]').prop('checked');
        const barkVolume = parseFloat(html.find('[name="barkVolume"]').val()) || 0.5;
        const barkCooldown = parseInt(html.find('[name="barkCooldown"]').val()) || 2000;
        
        const customBarkPaths = {};
        html.find('[name^="bark-path-"]').each((i, el) => {
            const category = el.name.replace('bark-path-', '');
            if (el.value.trim()) {
                customBarkPaths[category] = el.value.trim();
            }
        });
        
        await setSetting('barksEnabled', barksEnabled);
        await setSetting('barkVolume', barkVolume);
        await setSetting('barkCooldown', barkCooldown);
        await setSetting('customBarkPaths', customBarkPaths);
        
        // Update bark system if it exists
        if (game.rnkPatrol?.barkSystem) {
            game.rnkPatrol.barkSystem.updateSettings();
        }
        
        ui.notifications.info('Bark settings saved!');
    }
    
    /**
     * Test a bark sound
     */
    async _testBark(event) {
        const category = event.currentTarget.dataset.category;
        if (game.rnkPatrol?.barkSystem) {
            await game.rnkPatrol.barkSystem.playBark(category, canvas.scene?.dimensions?.sceneX || 0, canvas.scene?.dimensions?.sceneY || 0);
        } else {
            ui.notifications.warn('Bark system not initialized');
        }
    }
    
    /**
     * Browse for bark folder
     */
    async _browseBarkFolder(event) {
        const category = event.currentTarget.dataset.category;
        const input = this.element.find(`[name="bark-path-${category}"]`);
        
        // Use V13+ namespaced FilePicker if available, fallback to global for V12
        const FilePickerClass = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
        
        // Default to root barks folder - subfolders don't exist
        const defaultPath = `modules/${MODULE_ID}/assets/audio/barks/`;
        let currentPath = input.val();
        
        // If the current path doesn't exist or is empty, use default
        if (!currentPath || currentPath.includes(`/barks/${category}/`)) {
            currentPath = defaultPath;
        }
        
        try {
            new FilePickerClass({
                type: 'folder',
                current: currentPath,
                callback: (path) => {
                    input.val(path);
                }
            }).render(true);
        } catch (err) {
            console.warn('RNK Patrol | FilePicker error, using default path:', err);
            new FilePickerClass({
                type: 'folder',
                current: defaultPath,
                callback: (path) => {
                    input.val(path);
                }
            }).render(true);
        }
    }
    
    /**
     * Save telegraph settings
     */
    async _saveTelegraphSettings(html) {
        const telegraphEnabled = html.find('[name="telegraphEnabled"]').prop('checked');
        const telegraphStyle = html.find('[name="telegraphStyle"]').val();
        const telegraphDuration = parseInt(html.find('[name="telegraphDuration"]').val()) || 1500;
        const telegraphColor = html.find('[name="telegraphColor"]').val() || '#ff4444';
        const telegraphGMOnly = html.find('[name="telegraphGMOnly"]').prop('checked');
        
        await setSetting('telegraphEnabled', telegraphEnabled);
        await setSetting('telegraphStyle', telegraphStyle);
        await setSetting('telegraphDuration', telegraphDuration);
        await setSetting('telegraphColor', telegraphColor);
        await setSetting('telegraphGMOnly', telegraphGMOnly);
        
        // Update telegraph system if it exists
        if (game.rnkPatrol?.telegraphSystem) {
            game.rnkPatrol.telegraphSystem.updateSettings();
        }
        
        ui.notifications.info('Telegraph settings saved!');
    }
    
    /**
     * Preview telegraph effect at center of viewport
     */
    async _previewTelegraph() {
        if (!canvas.scene) {
            ui.notifications.warn('No active scene');
            return;
        }
        
        // Get center of viewport
        const viewportCenter = canvas.scene.dimensions;
        const position = {
            x: viewportCenter.sceneX + (viewportCenter.sceneWidth / 2),
            y: viewportCenter.sceneY + (viewportCenter.sceneHeight / 2)
        };
        
        if (game.rnkPatrol?.telegraphSystem) {
            // Pass position as an object with x/y properties
            await game.rnkPatrol.telegraphSystem.showTelegraph(position);
            ui.notifications.info('Telegraph preview shown at scene center');
        } else {
            ui.notifications.warn('Telegraph system not initialized');
        }
    }
    
    /**
     * Save jail settings
     */
    async _saveJailSettings(html) {
        const jailEnabled = html.find('[name="jailEnabled"]').prop('checked');
        const jailDefaultDuration = parseInt(html.find('[name="jailDefaultDuration"]').val()) || 120;
        const jailEscapeEnabled = html.find('[name="jailEscapeEnabled"]').prop('checked');
        const jailEscapeDC = parseInt(html.find('[name="jailEscapeDC"]').val()) || 15;
        
        await setSetting('jailEnabled', jailEnabled);
        await setSetting('jailDefaultDuration', jailDefaultDuration);
        await setSetting('jailEscapeEnabled', jailEscapeEnabled);
        await setSetting('jailEscapeDC', jailEscapeDC);
        
        ui.notifications.info('Jail settings saved!');
    }

    /**
     * Save AI & Automation settings
     */
    async _saveAiSettings(html) {
        const aiProvider = html.find('[name="aiProvider"]').val();
        const aiApiKey = html.find('[name="aiApiKey"]').val()?.trim() || '';
        const automateDecisions = html.find('[name="automateDecisions"]').prop('checked');
        const automateCombat = html.find('[name="automateCombat"]').prop('checked');
        const autoResolveAffectsPlayers = html.find('[name="autoResolveAffectsPlayers"]').prop('checked');
        const autoPerformSuggestions = html.find('[name="autoPerformSuggestions"]').prop('checked');
        const automateRequireApproval = html.find('[name="automateRequireApproval"]').prop('checked');
        const aiPendingMaxEntries = parseInt(html.find('[name="aiPendingMaxEntries"]').val()) || 100
        const midiQolLoggingLevel = html.find('[name="midiQolLoggingLevel"]').val() || 'minimal'
        const combatAutomationLevel = html.find('[name="combatAutomationLevel"]').val();

        await setSetting('aiProvider', aiProvider);
        await setSetting('automateDecisions', automateDecisions);
        await setSetting('automateCombat', automateCombat);
        await setSetting('combatAutomationLevel', combatAutomationLevel);
        await setSetting('autoResolveAffectsPlayers', autoResolveAffectsPlayers);
        await setSetting('autoPerformSuggestions', autoPerformSuggestions);
        await setSetting('automateRequireApproval', automateRequireApproval);
        await setSetting('aiPendingMaxEntries', aiPendingMaxEntries);
        // aiApiKey is client-scope
        await game.settings.set(MODULE_ID, 'aiApiKey', aiApiKey);
        await setSetting('midiQolLoggingLevel', midiQolLoggingLevel);

        if (aiProvider === 'openai' && !aiApiKey) {
            ui.notifications.warn('OpenAI selected as AI provider, but no API key provided. Falling back to system heuristics.');
        }
        ui.notifications.info('AI & automation settings saved!');
    }
    
    /**
     * Create a jail scene from template (on-demand creation)
     */
    async _createJailScene(event) {
        const template = event.currentTarget.dataset.template;
        
        if (game.rnkPatrol?.jailSystem) {
            const scene = await game.rnkPatrol.jailSystem.createJailSceneFromConfig(template);
            if (scene) {
                ui.notifications.info(`Jail scene created: ${scene.name}`);
                this.render(false);
            }
        } else {
            ui.notifications.warn('Jail system not initialized');
        }
    }

    async _clearAiLog() {
        const confirmed = await Dialog.confirm({ title: 'Clear AI Log', content: 'Are you sure you want to clear the AI log?' })
        if (!confirmed) return
        await game.settings.set(MODULE_ID, 'aiLog', [])
        ui.notifications.info('AI log cleared')
        // re-render to clear UI
        this.render(false)
    }

    async _exportAiLog() {
        const entries = game.rnkPatrol?.getAiLog?.() || []
        const json = JSON.stringify(entries, null, 2)
        await navigator.clipboard.writeText(json)
        ui.notifications.info('AI log copied to clipboard (JSON)')
    }

    async _onUndoAiLogEntry(event) {
        const btn = $(event.currentTarget)
        const index = parseInt(btn.closest('.ai-log-item').data('log-index'))
        const log = game.rnkPatrol?.getAiLog?.() || []
        if (!log || !log[index]) return
        const entry = log[index]
        // Perform undo based on payload
        if (!entry.undo) {
            ui.notifications.warn('No undo available for this log entry')
            return
        }
        const undo = entry.undo
        try {
            // Use global undo helper
            const result = await game.rnkPatrol?.undoAiLogEntry?.(entry)
            if (result?.success) {
                ui.notifications.info('AI undo completed successfully')
                // Remove entry from log after undo success
                const newLog = log.filter((_, i) => i !== index)
                await game.settings.set(MODULE_ID, 'aiLog', newLog)
                this.render(false)
            } else {
                ui.notifications.warn('AI undo partially failed - check console and log')
                console.warn('AI undo errors:', result?.errors)
            }
        } catch (err) {
            console.error(`${MODULE_ID} | Undo AI Log entry failed`, err)
            ui.notifications.error('Failed to undo AI action')
        }
    }

    async _onReplayAiLogEntry(event) {
        const btn = $(event.currentTarget)
        const index = parseInt(btn.closest('.ai-log-item').data('log-index'))
        const log = game.rnkPatrol?.getAiLog?.() || []
        if (!log || !log[index]) return
        const entry = log[index]
        try {
            if (entry.type === 'performAction' && entry.payload) {
                // Attempt to find attacker/target tokens
                const attackerId = entry.payload.attackerId
                const targetId = entry.payload.targetId
                const attacker = canvas.tokens.placeables.find(t => t.actor?.id === attackerId)
                const target = canvas.tokens.placeables.find(t => t.actor?.id === targetId)
                if (!attacker || !target) {
                    ui.notifications.warn('Unable to find tokens to replay action')
                    return
                }
                // Re-run performAction with same intent
                await game.rnkPatrol.aiService.performAction({ combatant: { token: attacker.document }, action: 'attack', targetToken: target, combat: null })
                ui.notifications.info('Replayed AI performAction')
            } else {
                ui.notifications.warn('Replay not supported for this log type')
            }
        } catch (err) {
            console.error(`${MODULE_ID} | Replay AI Log entry failed`, err)
            ui.notifications.error('Failed to replay AI action')
        }
    }

    async _onApproveAiPending(event) {
        const btn = $(event.currentTarget)
        const index = parseInt(btn.data('index'))
        const entry = await game.rnkPatrol?.popPendingAction(index)
        if (!entry) {
            ui.notifications.warn('No pending entry found')
            return
        }
        try {
            // Attempt to perform the action
            if (entry.type === 'performAction' && entry.payload) {
                const attacker = canvas.tokens.placeables.find(t => t.actor?.id === entry.payload.attackerId)
                const target = canvas.tokens.placeables.find(t => t.actor?.id === entry.payload.targetId)
                const success = await game.rnkPatrol.aiService.performAction({ combatant: { token: attacker.document }, action: 'attack', targetToken: target, combat: null })
                if (success) ui.notifications.info('Approved and performed action')
                else ui.notifications.warn('Approval performed but action failed')
            } else if (entry.type === 'bribery' && entry.payload) {
                const playerToken = canvas.tokens.get(entry.payload.playerId)
                const patrol = game.rnkPatrol?.manager?.getPatrol(entry.payload.patrolId)
                if (playerToken && patrol) {
                    if (entry.payload.accepted) {
                        await game.rnkPatrol?.captureSystem._executeBriberyResult({ id: 'pending' }, patrol, playerToken, 'bribe_success', entry.payload.bribeAmount)
                        ui.notifications.info('Approved and performed bribe acceptance')
                    } else {
                        await game.rnkPatrol?.captureSystem._executeRandomOutcome({ id: 'pending' }, patrol, playerToken)
                        ui.notifications.info('Approved AI suggestion (rejected bribe) - proceeded with computed outcome')
                    }
                } else {
                    ui.notifications.warn('Unable to find player or patrol for bribery approval')
                }
            } else if (entry.type === 'captureOutcome' && entry.payload) {
                const playerToken = canvas.tokens.get(entry.payload.playerId)
                const patrol = game.rnkPatrol?.manager?.getPatrol(entry.payload.patrolId)
                if (playerToken && patrol) {
                    await game.rnkPatrol?.captureSystem._executeOutcome({ id: 'pending' }, patrol, playerToken, entry.payload.outcome)
                    ui.notifications.info('Approved and executed capture outcome')
                } else {
                    ui.notifications.warn('Unable to find player or patrol for capture outcome approval')
                }
            } else if (entry.type === 'autoResolveCombat' && entry.payload) {
                const combat = game.combats.get(entry.payload.combatId)
                if (combat) {
                    await game.rnkPatrol.aiService.autoResolveCombat(combat)
                    ui.notifications.info('Approved and performed auto-resolve')
                } else {
                    ui.notifications.warn('Unable to find combat for auto-resolve approval')
                }
            } else {
                ui.notifications.warn('Approval type not supported')
            }
        } catch (err) {
            console.error(`${MODULE_ID} | Approve AI pending failed`, err)
            ui.notifications.error('Failed to approve AI pending action')
        }
        this.render(false)
    }

    async _onRejectAiPending(event) {
        const btn = $(event.currentTarget)
        const index = parseInt(btn.data('index'))
        const entry = await game.rnkPatrol?.popPendingAction(index)
        if (!entry) {
            ui.notifications.warn('No pending entry found')
            return
        }
        // Log rejection
        game.rnkPatrol.logAiDecision({ type: 'pendingRejected', message: `GM rejected pending action: ${entry.type}`, payload: entry.payload, provider: 'local' })
        ui.notifications.info('Rejected AI pending action')
        this.render(false)
    }

    /**
     * Show adapter info dialog
     */
    async _onShowAdapterInfo(event) {
        const systemId = event.currentTarget.dataset.system
        const adapters = game.rnkPatrol?.systemAdapters?.adapters || {}
        const adapter = adapters[systemId]
        if (!adapter) return ui.notifications.warn('Adapter not found')
        const capabilities = Object.keys(adapter).filter(k => typeof adapter[k] === 'function')
        const content = `<div><strong>${adapter.constructor?.name || 'Adapter'}</strong><p>System: ${systemId}</p><p>Capabilities: ${capabilities.join(', ')}</p></div>`
        new Dialog({ title: 'Adapter Info', content, buttons: { ok: { label: 'Close' } } }).render(true)
    }

    async _onRunAdapterTest(event) {
        if (!game.user.isGM) return ui.notifications.warn('Only the GM can run adapter tests')
        const systemId = event.currentTarget.dataset.system
        const adapters = game.rnkPatrol?.systemAdapters?.adapters || {}
        const adapter = adapters[systemId]
        if (!adapter) {
            ui.notifications.warn('Adapter not found')
            return
        }
        // Use selected token if present, else fallback to first token
        const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
        if (!token) return ui.notifications.warn('Select a token in the scene to run adapter tests')
        try {
            const hp = adapter.getActorHp?.(token)
            const maxHp = adapter.getActorMaxHp?.(token)
            const ac = adapter.getActorAc?.(token.actor)
            const items = adapter.getAttackItems?.(token.actor) || []
            const est = await (adapter.estimateBestAttackForToken?.(token) || null)
            const msg = `Adapter ${systemId}: HP=${hp}/${maxHp} AC=${ac} Items=${items.length} Estimate=${JSON.stringify(est)}`
            this._appendTestOutput(msg, 'info')
            ui.notifications.info('Adapter test complete. See test output in the Tests tab.')
        } catch (err) {
            console.error('Adapter test failed', err)
            this._appendTestOutput(`Adapter ${systemId} test failed: ${err?.message || err}`, 'error')
        }
    }

    async _onCopyAdapterSummary(event) {
        const adapters = game.rnkPatrol?.systemAdapters?.adapters || {}
        const lines = Object.entries(adapters).map(([k, a]) => `${k}: ${a.constructor?.name || 'Adapter'}; capabilities=${Object.keys(a).filter(x => typeof a[x] === 'function').join(', ')}`)
        const payload = lines.join('\n')
        try {
            await navigator.clipboard.writeText(payload)
            ui.notifications.info('Adapter summary copied to clipboard')
        } catch (err) {
            console.error('Copy failed', err)
            ui.notifications.warn('Failed to copy adapter summary to clipboard')
        }
    }

    /**
     * Append a message to test output console in the UI
     */
    _appendTestOutput(text, level = 'info') {
        const preEl = this.element?.find?.('.log-output')?.[0] || (this.element?.querySelector ? this.element.querySelector('.log-output') : null)
        const pre = preEl
        if (!pre) return
        const now = new Date().toLocaleTimeString()
        pre.textContent = `${pre.textContent}\n[${now}] ${text}`
        pre.scrollTop = pre.scrollHeight
    }

    /**
     * Run an individual test based on the id
     */
    async _onRunTest(event) {
        if (!game.user.isGM) return ui.notifications.warn('Only the GM can run tests')
        const testId = event.currentTarget.dataset.testid
        try {
            switch (testId) {
                case 'simulatePending': {
                    const res = await game.rnkPatrol.simulatePendingFlow()
                    this._appendTestOutput(`simulatePending result: ${JSON.stringify(res)}`)
                    break
                }
                case 'simulateBribe': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
                    if (!token) return ui.notifications.warn('Select a token to run bribe simulation')
                    const actorId = token.actor?.id
                    const patrol = game.rnkPatrol.manager?.getPatrol(game.rnkPatrol.manager?.getPatrolForToken(token.id)?.id) || game.rnkPatrol.manager?.getPatrol([...game.rnkPatrol.manager._patrols.keys()][0])
                    const patrolId = patrol?.id
                    const res = await game.rnkPatrol.simulateBribeFlow(actorId, getSetting('briberyBaseCost', 50), patrolId)
                    this._appendTestOutput(`simulateBribe result: ${JSON.stringify(res)}`)
                    break
                }
                case 'simulateUndo': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
                    if (!token) return ui.notifications.warn('Select a token to run undo simulation')
                    const actorId = token.actor?.id
                    const amount = 10
                    const res = await game.rnkPatrol.simulateTheftUndoFlow(actorId, amount)
                    this._appendTestOutput(`simulateUndo result: ${JSON.stringify(res)}`)
                    break
                }
                case 'simulateMultiUndo': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
                    if (!token) return ui.notifications.warn('Select a token to run undo simulation')
                    const res = await game.rnkPatrol.runTestById('simulateMultiUndo')
                    this._appendTestOutput(`simulateMultiUndo result: ${JSON.stringify(res)}`)
                    break
                }
                case 'adapterTest': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
                    if (!token) return ui.notifications.warn('Select a token to run adapter test')
                    const adapter = game.rnkPatrol.systemAdapters.getAdapter(token.actor?.system?.id || game.system.id)
                    if (!adapter) return ui.notifications.warn('Adapter not available for this system')
                    const hp = adapter.getActorHp?.(token)
                    const maxHp = adapter.getActorMaxHp?.(token)
                    const ac = adapter.getActorAc?.(token.actor)
                    const items = adapter.getAttackItems?.(token.actor) || []
                    const est = await (adapter.estimateBestAttackForToken?.(token) || null)
                    const msg = `Adapter test: HP=${hp}/${maxHp} AC=${ac} Items=${items.length} Estimate=${JSON.stringify(est)}`
                    this._appendTestOutput(msg)
                    break
                }
                case 'midiTest': {
                    const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0]
                    const target = canvas.tokens.placeables.find(t => t.id !== token.id)
                    if (!token || !target) return ui.notifications.warn('Select an attacker token and ensure there is a target')
                    const adapter = game.rnkPatrol.systemAdapters.getAdapter(token.actor?.system?.id || game.system.id)
                    const items = adapter.getAttackItems?.(token.actor) || []
                    if (!items.length) return ui.notifications.warn('Selected actor has no attack items')
                    const workflow = await adapter.rollItemUse(items[0], token, [target])
                    this._appendTestOutput(`Midi test result: ${workflow ? JSON.stringify({ attackRoll: workflow?.attackRoll?.total, damage: workflow?.damageTotal || workflow?.damage?.total }) : 'no workflow returned'}`)
                    break
                }
                case 'autoResolve': {
                    const selected = canvas.tokens.controlled || []
                    if (selected.length < 2) return ui.notifications.warn('Select at least 2 tokens to run autoResolve')
                    const combat = await Combat.create({ scene: canvas.scene.id, active: true })
                    await combat.createEmbeddedDocuments('Combatant', selected.slice(0,2).map(t => ({ tokenId: t.id, actorId: t.actor?.id })))
                    await game.rnkPatrol.aiService.autoResolveCombat(combat)
                    this._appendTestOutput('autoResolve invoked on test combat')
                    break
                }
                default:
                    this._appendTestOutput(`Unknown test: ${testId}`, 'warn')
            }
        } catch (err) {
            console.error('Test failed', err)
            this._appendTestOutput(`Test ${testId} failed: ${err?.message || err}`, 'error')
        }
    }

    async _onRunAllTests() {
        const res = await game.rnkPatrol?.runAllTests?.()
        this._appendTestOutput('Run all tests: ' + JSON.stringify(res || {}))
    }
    
    /**
     * Visit a jail scene
     */
    async _visitJail(event) {
        const sceneId = event.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (scene) {
            await scene.view();
        }
    }
    
    /**
     * Reset a jail scene (remove guards so they respawn on next capture)
     */
    async _resetJail(event) {
        const sceneId = event.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (!scene) return;
        
        const confirmed = await Dialog.confirm({
            title: 'Reset Jail Scene',
            content: `<p>Reset jail scene "${scene.name}"? This will remove all guards. They will respawn (scaled to party level) on the next capture.</p>`
        });
        
        if (confirmed && game.rnkPatrol?.jailSystem) {
            await game.rnkPatrol.jailSystem.resetJailScene(sceneId);
            this.render(false);
        }
    }
    
    /**
     * Delete a jail scene
     */
    async _deleteJail(event) {
        const sceneId = event.currentTarget.dataset.sceneId;
        const scene = game.scenes.get(sceneId);
        if (!scene) return;
        
        const confirmed = await Dialog.confirm({
            title: 'Delete Jail Scene',
            content: `<p>Delete jail scene "${scene.name}"? Any prisoners will be released.</p>`
        });
        
        if (confirmed) {
            if (game.rnkPatrol?.jailSystem) {
                await game.rnkPatrol.jailSystem.deleteJailScene(sceneId);
            }
            await scene.delete();
            this.render(false);
        }
    }
    
    /**
     * Release a prisoner
     */
    async _releasePrisoner(event) {
        const actorId = event.currentTarget.dataset.actorId;
        
        if (game.rnkPatrol?.jailSystem) {
            await game.rnkPatrol.jailSystem.releasePrisoner(actorId);
            ui.notifications.info('Prisoner released!');
            this.render(false);
        }
    }
    
    /**
     * Visit prisoner location
     */
    async _visitPrisoner(event) {
        const actorId = event.currentTarget.dataset.actorId;
        const prisonerData = getSetting('prisonerData', {});
        const data = prisonerData[actorId];
        
        if (data?.sceneId) {
            const scene = game.scenes.get(data.sceneId);
            if (scene) {
                await scene.view();
            }
        }
    }
    
    /**
     * Release all prisoners
     */
    async _releaseAllPrisoners() {
        const confirmed = await Dialog.confirm({
            title: 'Release All Prisoners',
            content: '<p>Are you sure you want to release all prisoners?</p>'
        });
        
        if (confirmed && game.rnkPatrol?.jailSystem) {
            await game.rnkPatrol.jailSystem.releaseAllPrisoners();
            ui.notifications.info('All prisoners released!');
            this.render(false);
        }
    }
    
    /**
     * Clear all waypoint graphics from the canvas
     * This removes ALL patrols and waypoints from the current scene
     */
    async _clearAllWaypoints() {
        const result = await Dialog.wait({
            title: 'Clear Waypoints',
            content: `<p>Choose an option:</p>
                      <p><strong>Clear Graphics Only:</strong> Removes visual markers but keeps patrol data (waypoints will return on refresh)</p>
                      <p><strong>Delete All Patrols:</strong> Permanently deletes ALL patrols and their waypoints from this scene</p>`,
            buttons: {
                graphics: {
                    icon: '<i class="fas fa-eye-slash"></i>',
                    label: 'Clear Graphics Only',
                    callback: () => 'graphics'
                },
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: 'Delete All Patrols',
                    callback: () => 'delete'
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel',
                    callback: () => 'cancel'
                }
            },
            default: 'cancel'
        });
        
        if (result === 'cancel') return;
        
        let removed = 0;
        const manager = game.rnkPatrol?.manager;
        
        if (result === 'delete') {
            // Delete all patrols from this scene permanently
            if (manager) {
                const patrols = [...manager.getPatrols()]; // Copy array since we're modifying it
                for (const patrol of patrols) {
                    await manager.deletePatrol(patrol.id);
                    removed++;
                }
            }
            // Also clear any stored waypoints for this scene so deleted waypoints don't return
            try {
                if (canvas.scene) {
                    await canvas.scene.setFlag(MODULE_ID, 'waypoints', []);

                    // Remove any lingering waypoint visuals from the canvas
                    if (canvas.controls?.children) {
                        const toRemove = [];
                        for (const child of canvas.controls.children) {
                            // Best-effort detection for waypoint visuals created by this module
                            if (child instanceof PIXI.Container && child.bg instanceof PIXI.Graphics && child.icon instanceof PIXI.Text) {
                                toRemove.push(child);
                            }
                        }
                        for (const container of toRemove) {
                            if (!container.destroyed) container.destroy({ children: true });
                        }
                    }
                }
            } catch (err) {
                console.error('Error clearing waypoints after deleting patrols', err);
            }

            ui.notifications.info(`Deleted ${removed} patrols and their waypoints from this scene.`);
        } else {
            // Just clear graphics
            // Method 1: Clear through patrol manager if available
            if (manager) {
                const patrols = manager.getPatrols();
                for (const patrol of patrols) {
                    if (patrol.waypoints) {
                        for (const waypoint of patrol.waypoints) {
                            if (waypoint._visual) {
                                waypoint.hideVisual();
                                removed++;
                            }
                        }
                    }
                }
            }
            
            // Method 2: Scan canvas.controls for orphaned waypoint containers
            if (canvas.controls?.children) {
                const toRemove = [];
                for (const child of canvas.controls.children) {
                    // Check if this looks like a waypoint visual (has bg, range, icon children)
                    if (child instanceof PIXI.Container && 
                        child.bg instanceof PIXI.Graphics && 
                        child.icon instanceof PIXI.Text) {
                        toRemove.push(child);
                    }
                }
                
                for (const container of toRemove) {
                    container.destroy({ children: true });
                    removed++;
                }
            }
            
            // Method 3: Also clear any waypoint-related layers/containers by name
            if (canvas.controls?.children) {
                const toRemove = [];
                for (const child of canvas.controls.children) {
                    if (child.label?.text?.includes('WP') || child.label?.text?.includes('Waypoint')) {
                        toRemove.push(child);
                    }
                }
                
                for (const container of toRemove) {
                    if (!container.destroyed) {
                        container.destroy({ children: true });
                        removed++;
                    }
                }
            }
            
            ui.notifications.info(`Cleared ${removed} waypoint graphics (will return on refresh if patrol data exists).`);
        }
        
        this.render(false);
    }

    /** @override */
    close(options = {}) {
        // Cleanup
        Hooks.off(`${MODULE_ID}.patrolUpdate`, this._onPatrolUpdate);
        this._stopAutoRefresh();
        if (this._deferredRenderTimer) {
            clearTimeout(this._deferredRenderTimer);
            this._deferredRenderTimer = null;
        }
        return super.close(options);
    }

    /**
     * Start auto-refresh interval
     */
    _startAutoRefresh() {
        this._stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            // Don't auto-refresh while minimized, not rendered, or when editing fields
            if (this.rendered && !this.isMinimized && !this._suspendAutoRefresh) {
                this.render(false);
            }
        }, 15000); // Refresh every 15 seconds (reduced frequency)
    }

    /**
     * Stop auto-refresh
     */
    _stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Handle patrol update event
     */
    _onPatrolUpdate(patrol) {
        if (!this.rendered) return;

        // Check if user is actively editing
        const isEditing = this.element?.length && document.activeElement && 
            this.element[0]?.contains(document.activeElement) &&
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

        // If auto-refresh is suspended or user is editing, defer the render
        if (this._suspendAutoRefresh || isEditing) {
            if (this._deferredRenderTimer) clearTimeout(this._deferredRenderTimer);
            // Attempt to re-render after user stops editing
            this._deferredRenderTimer = setTimeout(() => {
                const stillEditing = this.element?.length && document.activeElement && 
                    this.element[0]?.contains(document.activeElement) &&
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
                if (!this._suspendAutoRefresh && !stillEditing && this.rendered && !this.isMinimized) {
                    this.render(false);
                }
                this._deferredRenderTimer = null;
            }, 1500);
            return;
        }

        this.render(false);
    }

    // ==================== Action Handlers ====================

    async _onStartAll() {
        const manager = game.rnkPatrol?.manager;
        if (!manager) return;

        await manager.startAll();
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.allStarted`));
        this.render(false);
    }

    async _onStopAll() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(`${MODULE_ID}.dialogs.stopConfirm.title`),
            content: game.i18n.localize(`${MODULE_ID}.dialogs.stopConfirm.content`)
        });

        if (!confirmed) return;

        const manager = game.rnkPatrol?.manager;
        if (!manager) return;

        await manager.stopAll();
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.allStopped`));
        this.render(false);
    }

    async _onPauseAll() {
        const manager = game.rnkPatrol?.manager;
        if (!manager) return;

        await manager.pauseAll();
        this.render(false);
    }

    async _onCreatePatrol() {
        // Check if system is ready
        if (!game.rnkPatrol?.manager) {
            ui.notifications.warn('Patrol system is still initializing. Please wait a moment and try again.');
            return;
        }
        
        const { PatrolCreatorApp } = await import('./PatrolCreatorApp.js');
        new PatrolCreatorApp().render(true);
    }

    async _onPatrolAction(event, action) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        if (!patrolId) return;

        const manager = game.rnkPatrol?.manager;
        const patrol = manager?.getPatrol(patrolId);
        if (!patrol) return;

        switch (action) {
            case 'start':
                await patrol.start();
                break;
            case 'stop':
                await patrol.stop();
                break;
            case 'pause':
                await patrol.pause();
                break;
            case 'resume':
                await patrol.resume();
                break;
        }

        this.render(false);
    }

    async _onEditPatrol(event) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        if (!patrolId) return;

        const { PatrolConfigApp } = await import('./PatrolConfigApp.js');
        new PatrolConfigApp(patrolId).render(true);
    }

    async _onDeletePatrol(event) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        const manager = game.rnkPatrol?.manager;
        const patrol = manager?.getPatrol(patrolId);
        if (!patrol) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(`${MODULE_ID}.dialogs.deleteConfirm.title`),
            content: game.i18n.format(`${MODULE_ID}.dialogs.deleteConfirm.content`, { name: patrol.name })
        });

        if (!confirmed) return;

        await manager.deletePatrol(patrolId);
        this.selectedPatrolId = null;
        this.render(false);
    }

    async _onPanToPatrol(event) {
        event.preventDefault();
        event.stopPropagation();

        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        const manager = game.rnkPatrol?.manager;
        const patrol = manager?.getPatrol(patrolId);
        if (!patrol) return;

        const token = canvas.tokens?.get(patrol.tokenId);
        if (token) {
            canvas.animatePan({ x: token.center.x, y: token.center.y, scale: 1.5 });
        }
    }

    _onSelectPatrol(event) {
        const patrolId = event.currentTarget.closest('[data-patrol-id]')?.dataset.patrolId;
        this._selectPatrol(patrolId);
    }

    _selectPatrol(patrolId) {
        this.selectedPatrolId = patrolId === this.selectedPatrolId ? null : patrolId;
        this.render(false);
    }

    async _onQuickPatrol(event) {
        const tokenId = event.currentTarget.dataset.tokenId;
        const token = canvas.tokens?.get(tokenId);
        if (!token) return;

        const { PatrolCreatorApp } = await import('./PatrolCreatorApp.js');
        new PatrolCreatorApp({ token }).render(true);
    }

    _onSearch(event) {
        const query = event.currentTarget.value.toLowerCase();
        const cards = this.element.find('.patrol-card');

        cards.each((i, card) => {
            const name = card.dataset.patrolName?.toLowerCase() || '';
            const tokenName = card.querySelector('.token-name')?.textContent?.toLowerCase() || '';
            const matches = name.includes(query) || tokenName.includes(query);
            card.style.display = matches ? '' : 'none';
        });
    }

    _onFilter(event) {
        const filter = event.currentTarget.dataset.filter;
        const buttons = this.element.find('.filter-btn');
        buttons.removeClass('active');
        event.currentTarget.classList.add('active');

        const cards = this.element.find('.patrol-card');
        cards.each((i, card) => {
            let show = true;
            const state = card.dataset.state;

            switch (filter) {
                case 'active':
                    show = state === 'active';
                    break;
                case 'paused':
                    show = state === 'paused';
                    break;
                case 'stopped':
                    show = state === 'idle' || state === 'stopped';
                    break;
                case 'alert':
                    show = card.classList.contains('is-alert');
                    break;
            }

            card.style.display = show ? '' : 'none';
        });
    }

    _onKeydown(event) {
        // Keyboard shortcuts
        if (event.key === 'Escape') {
            this.selectedPatrolId = null;
            this.render(false);
        }
    }

    async _onImportPatrols() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                const manager = game.rnkPatrol?.manager;
                if (manager && data.patrols) {
                    for (const patrolData of data.patrols) {
                        await manager.createPatrol(patrolData);
                    }
                    ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.importSuccess`));
                    this.render(false);
                }
            } catch (err) {
                console.error(err);
                ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.importFailed`));
            }
        };

        input.click();
    }

    async _onExportPatrols() {
        const manager = game.rnkPatrol?.manager;
        const patrols = manager?.getPatrols() ?? [];

        const exportData = {
            version: game.rnkPatrol?.version || '1.0.0',
            scene: canvas.scene?.name,
            exportedAt: new Date().toISOString(),
            patrols: patrols.map(p => p.toJSON())
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `rnk-patrol-export-${canvas.scene?.name || 'scene'}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.exportSuccess`));
    }

    // ==================== Static Methods ====================

    /**
     * Open the GM Hub
     */
    static open() {
        if (!game.user.isGM) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.gmOnly`));
            return;
        }

        // Check for existing instance
        const existing = Object.values(ui.windows).find(w => w.id === 'rnk-patrol-gm-hub');
        if (existing) {
            existing.bringToTop();
            return existing;
        }

        return new GMHubApp().render(true);
    }

    /** @override */
    async render(force = false, options = {}) {
        // Preserve scroll position in the main content area across re-renders
        const content = this.element?.find('.hub-content')[0];
        const scrollTop = content ? content.scrollTop : 0;

        await super.render(force, options);

        // Restore scroll position after render
        const newContent = this.element?.find('.hub-content')[0];
        if (newContent) newContent.scrollTop = scrollTop;

        return this;
    }
}

// Register the app opener as a global function
Hooks.once('ready', () => {
    game.rnkPatrol.openHub = GMHubApp.open;
});
