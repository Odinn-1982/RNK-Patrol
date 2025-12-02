/**
 * RNK Patrol - Module Settings
 * @module settings
 */

import { MODULE_ID, MODULE_NAME, PATROL_MODES, BLINK_PATTERNS } from './main.js'

/**
 * Register all module settings
 */
export function registerSettings() {
    
    // ==========================================
    // General Settings
    // ==========================================
    
    game.settings.register(MODULE_ID, 'enabled', {
        name: `${MODULE_ID}.settings.enabled.name`,
        hint: `${MODULE_ID}.settings.enabled.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'debugMode', {
        name: `${MODULE_ID}.settings.debugMode.name`,
        hint: `${MODULE_ID}.settings.debugMode.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })
    
    // ==========================================
    // Patrol Defaults
    // ==========================================
    
    game.settings.register(MODULE_ID, 'defaultPatrolMode', {
        name: `${MODULE_ID}.settings.defaultPatrolMode.name`,
        hint: `${MODULE_ID}.settings.defaultPatrolMode.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            [PATROL_MODES.BLINK]: `${MODULE_ID}.patrolModes.blink`,
            [PATROL_MODES.WALK]: `${MODULE_ID}.patrolModes.walk`,
            [PATROL_MODES.HYBRID]: `${MODULE_ID}.patrolModes.hybrid`
        },
        default: PATROL_MODES.BLINK,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'defaultBlinkPattern', {
        name: `${MODULE_ID}.settings.defaultBlinkPattern.name`,
        hint: `${MODULE_ID}.settings.defaultBlinkPattern.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            [BLINK_PATTERNS.SEQUENTIAL]: `${MODULE_ID}.blinkPatterns.sequential`,
            [BLINK_PATTERNS.RANDOM]: `${MODULE_ID}.blinkPatterns.random`,
            [BLINK_PATTERNS.WEIGHTED]: `${MODULE_ID}.blinkPatterns.weighted`,
            [BLINK_PATTERNS.PING_PONG]: `${MODULE_ID}.blinkPatterns.pingPong`,
            [BLINK_PATTERNS.PRIORITY]: `${MODULE_ID}.blinkPatterns.priority`
        },
        default: BLINK_PATTERNS.RANDOM,
        requiresReload: false
    })
    
    // ==========================================
    // Timing Settings
    // ==========================================
    
    game.settings.register(MODULE_ID, 'defaultAppearDuration', {
        name: `${MODULE_ID}.settings.defaultAppearDuration.name`,
        hint: `${MODULE_ID}.settings.defaultAppearDuration.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 1,
            max: 30,
            step: 0.5
        },
        default: 3,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'defaultDisappearDuration', {
        name: `${MODULE_ID}.settings.defaultDisappearDuration.name`,
        hint: `${MODULE_ID}.settings.defaultDisappearDuration.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 0.5,
            max: 15,
            step: 0.5
        },
        default: 2,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'timingVariance', {
        name: `${MODULE_ID}.settings.timingVariance.name`,
        hint: `${MODULE_ID}.settings.timingVariance.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 100,
            step: 5
        },
        default: 25,
        requiresReload: false
    })
    
    // ==========================================
    // Visual Settings
    // ==========================================
    
    game.settings.register(MODULE_ID, 'enableEffects', {
        name: `${MODULE_ID}.settings.enableEffects.name`,
        hint: `${MODULE_ID}.settings.enableEffects.hint`,
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'defaultEffectType', {
        name: `${MODULE_ID}.settings.defaultEffectType.name`,
        hint: `${MODULE_ID}.settings.defaultEffectType.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'fade': `${MODULE_ID}.effectTypes.fade`,
            'flash': `${MODULE_ID}.effectTypes.flash`,
            'smoke': `${MODULE_ID}.effectTypes.smoke`,
            'portal': `${MODULE_ID}.effectTypes.portal`,
            'shadow': `${MODULE_ID}.effectTypes.shadow`,
            'glitch': `${MODULE_ID}.effectTypes.glitch`,
            'none': `${MODULE_ID}.effectTypes.none`
        },
        default: 'fade',
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'showWaypoints', {
        name: `${MODULE_ID}.settings.showWaypoints.name`,
        hint: `${MODULE_ID}.settings.showWaypoints.hint`,
        scope: 'client',
        config: true,
        type: String,
        choices: {
            'always': `${MODULE_ID}.waypointVisibility.always`,
            'gm': `${MODULE_ID}.waypointVisibility.gm`,
            'hover': `${MODULE_ID}.waypointVisibility.hover`,
            'never': `${MODULE_ID}.waypointVisibility.never`
        },
        default: 'gm',
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'waypointColor', {
        name: `${MODULE_ID}.settings.waypointColor.name`,
        hint: `${MODULE_ID}.settings.waypointColor.hint`,
        scope: 'world',
        config: true,
        type: String,
        default: '#7B68EE',
        requiresReload: false
    })
    
    // ==========================================
    // Detection Settings
    // ==========================================
    
    game.settings.register(MODULE_ID, 'enableDetection', {
        name: `${MODULE_ID}.settings.enableDetection.name`,
        hint: `${MODULE_ID}.settings.enableDetection.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'defaultDetectionRange', {
        name: `${MODULE_ID}.settings.defaultDetectionRange.name`,
        hint: `${MODULE_ID}.settings.defaultDetectionRange.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 50,
            step: 1
        },
        default: 5,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'detectionTrigger', {
        name: `${MODULE_ID}.settings.detectionTrigger.name`,
        hint: `${MODULE_ID}.settings.detectionTrigger.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'notify': `${MODULE_ID}.detectionTriggers.notify`,
            'alert': `${MODULE_ID}.detectionTriggers.alert`,
            'combat': `${MODULE_ID}.detectionTriggers.combat`,
            'macro': `${MODULE_ID}.detectionTriggers.macro`,
            'none': `${MODULE_ID}.detectionTriggers.none`
        },
        default: 'notify',
        requiresReload: false
    })
    
    // ==========================================
    // Audio Settings
    // ==========================================
    
    game.settings.register(MODULE_ID, 'enableSounds', {
        name: `${MODULE_ID}.settings.enableSounds.name`,
        hint: `${MODULE_ID}.settings.enableSounds.hint`,
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'soundVolume', {
        name: `${MODULE_ID}.settings.soundVolume.name`,
        hint: `${MODULE_ID}.settings.soundVolume.hint`,
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 1,
            step: 0.1
        },
        default: 0.5,
        requiresReload: false
    })
    
    // ==========================================
    // Performance Settings
    // ==========================================
    
    game.settings.register(MODULE_ID, 'maxActivePatrols', {
        name: `${MODULE_ID}.settings.maxActivePatrols.name`,
        hint: `${MODULE_ID}.settings.maxActivePatrols.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 1,
            max: 50,
            step: 1
        },
        default: 20,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'updateInterval', {
        name: `${MODULE_ID}.settings.updateInterval.name`,
        hint: `${MODULE_ID}.settings.updateInterval.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 100,
            max: 2000,
            step: 100
        },
        default: 500,
        requiresReload: false
    })

    // ==========================================
    // Guard Source (templates vs random NPC actor)
    // ==========================================
    game.settings.register(MODULE_ID, 'guardSource', {
        name: `${MODULE_ID}.settings.guardSource.name`,
        hint: `${MODULE_ID}.settings.guardSource.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'templates': `${MODULE_ID}.settings.guardSource.templates`,
            'actors': `${MODULE_ID}.settings.guardSource.actors`
        },
        default: 'templates',
        requiresReload: false
    })

    // Optional guard actor whitelist (comma-separated actor IDs)
    game.settings.register(MODULE_ID, 'guardActorWhitelist', {
        name: `${MODULE_ID}.settings.guardActorWhitelist.name`,
        hint: `${MODULE_ID}.settings.guardActorWhitelist.hint`,
        scope: 'world',
        config: true,
        type: String,
        default: '',
        requiresReload: false
    })

    // ==========================================
    // AI and Automation Settings
    // ==========================================
    game.settings.register(MODULE_ID, 'aiProvider', {
        name: `${MODULE_ID}.settings.aiProvider.name`,
        hint: `${MODULE_ID}.settings.aiProvider.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'none': `${MODULE_ID}.settings.aiProvider.none`,
            'system': `${MODULE_ID}.settings.aiProvider.system`,
            'openai': `${MODULE_ID}.settings.aiProvider.openai`
        },
        default: 'system',
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'aiApiKey', {
        name: `${MODULE_ID}.settings.aiApiKey.name`,
        hint: `${MODULE_ID}.settings.aiApiKey.hint`,
        scope: 'client',
        config: true,
        type: String,
        default: '',
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'automateCombat', {
        name: `${MODULE_ID}.settings.automateCombat.name`,
        hint: `${MODULE_ID}.settings.automateCombat.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'combatAutomationLevel', {
        name: `${MODULE_ID}.settings.combatAutomationLevel.name`,
        hint: `${MODULE_ID}.settings.combatAutomationLevel.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'assisted': `${MODULE_ID}.settings.combatAutomationLevel.assisted`,
            'autoResolve': `${MODULE_ID}.settings.combatAutomationLevel.autoResolve`,
            'none': `${MODULE_ID}.settings.combatAutomationLevel.none`
        },
        default: 'assisted',
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'automateDecisions', {
        name: `${MODULE_ID}.settings.automateDecisions.name`,
        hint: `${MODULE_ID}.settings.automateDecisions.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'autoResolveAffectsPlayers', {
        name: `${MODULE_ID}.settings.autoResolveAffectsPlayers.name`,
        hint: `${MODULE_ID}.settings.autoResolveAffectsPlayers.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })

    // AI Log settings
    game.settings.register(MODULE_ID, 'aiLogMaxEntries', {
        name: `${MODULE_ID}.settings.aiLogMaxEntries.name`,
        hint: `${MODULE_ID}.settings.aiLogMaxEntries.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 10, max: 1000, step: 10 },
        default: 200,
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'aiLog', {
        scope: 'world',
        config: false,
        type: Object,
        default: []
    })

    game.settings.register(MODULE_ID, 'autoPerformSuggestions', {
        name: `${MODULE_ID}.settings.autoPerformSuggestions.name`,
        hint: `${MODULE_ID}.settings.autoPerformSuggestions.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'automateRequireApproval', {
        name: `${MODULE_ID}.settings.automateRequireApproval.name`,
        hint: `${MODULE_ID}.settings.automateRequireApproval.hint`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'aiPendingMaxEntries', {
        name: `${MODULE_ID}.settings.aiPendingMaxEntries.name`,
        hint: `${MODULE_ID}.settings.aiPendingMaxEntries.hint`,
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 10, max: 1000, step: 10 },
        default: 100,
        requiresReload: false
    })

    game.settings.register(MODULE_ID, 'aiPending', {
        scope: 'world',
        config: false,
        type: Object,
        default: []
    })

    game.settings.register(MODULE_ID, 'midiQolLoggingLevel', {
        name: `${MODULE_ID}.settings.midiQolLoggingLevel.name`,
        hint: `${MODULE_ID}.settings.midiQolLoggingLevel.hint`,
        scope: 'world',
        config: true,
        type: String,
        choices: {
            none: 'none',
            minimal: 'minimal',
            verbose: 'verbose'
        },
        default: 'minimal',
        requiresReload: false
    })
    
    // ==========================================
    // CAPTURE SYSTEM SETTINGS
    // ==========================================
    
    game.settings.register(MODULE_ID, 'captureEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.CaptureEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.CaptureEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'captureRange', {
        name: game.i18n.localize('RNKPATROL.Settings.CaptureRange'),
        hint: game.i18n.localize('RNKPATROL.Settings.CaptureRangeHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 1,
            max: 10,
            step: 1
        },
        default: 2,
        requiresReload: false
    })
    
    // Capture Outcome Weights (stored as object)
    game.settings.register(MODULE_ID, 'captureOutcomeWeights', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            combat: 30,
            theft: 25,
            relocate: 20,
            disregard: 15,
            jail: 10
        }
    })
    
    game.settings.register(MODULE_ID, 'briberyEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.BriberyEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.BriberyEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'briberyBaseCost', {
        name: game.i18n.localize('RNKPATROL.Settings.BriberyBaseCost'),
        hint: game.i18n.localize('RNKPATROL.Settings.BriberyBaseCostHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 10,
            max: 1000,
            step: 10
        },
        default: 50,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'briberyChance', {
        name: game.i18n.localize('RNKPATROL.Settings.BriberyChance'),
        hint: game.i18n.localize('RNKPATROL.Settings.BriberyChanceHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 100,
            step: 5
        },
        default: 70,
        requiresReload: false
    })
    
    // ------------------------------------------
    // Bleed-Out Capture Settings
    // ------------------------------------------
    
    game.settings.register(MODULE_ID, 'bleedOutEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.BleedOutEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.BleedOutEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'bleedOutThreshold', {
        name: game.i18n.localize('RNKPATROL.Settings.BleedOutThreshold'),
        hint: game.i18n.localize('RNKPATROL.Settings.BleedOutThresholdHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 10,
            max: 50,
            step: 5
        },
        default: 25,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'bleedOutBaseDC', {
        name: game.i18n.localize('RNKPATROL.Settings.BleedOutBaseDC'),
        hint: game.i18n.localize('RNKPATROL.Settings.BleedOutBaseDCHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 5,
            max: 20,
            step: 1
        },
        default: 10,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'bleedOutPlayerControl', {
        name: game.i18n.localize('RNKPATROL.Settings.BleedOutPlayerControl'),
        hint: game.i18n.localize('RNKPATROL.Settings.BleedOutPlayerControlHint'),
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'player': 'RNKPATROL.Settings.BleedOutPlayerControlPlayer',
            'gm': 'RNKPATROL.Settings.BleedOutPlayerControlGM',
            'auto': 'RNKPATROL.Settings.BleedOutPlayerControlAuto'
        },
        default: 'player',
        requiresReload: false
    })
    
    // ------------------------------------------
    // Blindfold/Relocate Settings
    // ------------------------------------------
    
    game.settings.register(MODULE_ID, 'blindfoldMinDuration', {
        name: game.i18n.localize('RNKPATROL.Settings.BlindfoldMinDuration'),
        hint: game.i18n.localize('RNKPATROL.Settings.BlindfoldMinDurationHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 1,
            max: 30,
            step: 1
        },
        default: 5,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'blindfoldMaxDuration', {
        name: game.i18n.localize('RNKPATROL.Settings.BlindfoldMaxDuration'),
        hint: game.i18n.localize('RNKPATROL.Settings.BlindfoldMaxDurationHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 5,
            max: 60,
            step: 1
        },
        default: 10,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'blindfoldPlayAudio', {
        name: game.i18n.localize('RNKPATROL.Settings.BlindfoldPlayAudio'),
        hint: game.i18n.localize('RNKPATROL.Settings.BlindfoldPlayAudioHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'blindfoldFadeEffect', {
        name: game.i18n.localize('RNKPATROL.Settings.BlindfoldFadeEffect'),
        hint: game.i18n.localize('RNKPATROL.Settings.BlindfoldFadeEffectHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    // ------------------------------------------
    // Theft Settings
    // ------------------------------------------
    
    game.settings.register(MODULE_ID, 'theftTargetingWeights', {
        name: game.i18n.localize('RNKPATROL.Settings.TheftTargetingWeights'),
        hint: game.i18n.localize('RNKPATROL.Settings.TheftTargetingWeightsHint'),
        scope: 'world',
        config: false,
        type: Object,
        default: {
            currency: 70,
            equipment: 25,
            miscellaneous: 5
        },
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'theftMaxItems', {
        name: game.i18n.localize('RNKPATROL.Settings.TheftMaxItems'),
        hint: game.i18n.localize('RNKPATROL.Settings.TheftMaxItemsHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 1,
            max: 10,
            step: 1
        },
        default: 3,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'theftTransferToGuard', {
        name: game.i18n.localize('RNKPATROL.Settings.TheftTransferToGuard'),
        hint: game.i18n.localize('RNKPATROL.Settings.TheftTransferToGuardHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'theftNotifyPlayer', {
        name: game.i18n.localize('RNKPATROL.Settings.TheftNotifyPlayer'),
        hint: game.i18n.localize('RNKPATROL.Settings.TheftNotifyPlayerHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    // ==========================================
    // BARK SYSTEM SETTINGS
    // ==========================================
    
    game.settings.register(MODULE_ID, 'barksEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.BarksEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.BarksEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'barkVolume', {
        name: game.i18n.localize('RNKPATROL.Settings.BarkVolume'),
        hint: game.i18n.localize('RNKPATROL.Settings.BarkVolumeHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 1,
            step: 0.1
        },
        default: 0.5,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'barkCooldown', {
        name: game.i18n.localize('RNKPATROL.Settings.BarkCooldown'),
        hint: game.i18n.localize('RNKPATROL.Settings.BarkCooldownHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 10000,
            step: 500
        },
        default: 2000,
        requiresReload: false
    })
    
    // Custom bark paths (stored as object)
    game.settings.register(MODULE_ID, 'customBarkPaths', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    })
    
    // ==========================================
    // TELEGRAPH SYSTEM SETTINGS
    // ==========================================
    
    game.settings.register(MODULE_ID, 'telegraphEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.TelegraphEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.TelegraphEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'telegraphStyle', {
        name: game.i18n.localize('RNKPATROL.Settings.TelegraphStyle'),
        hint: game.i18n.localize('RNKPATROL.Settings.TelegraphStyleHint'),
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'ripple': 'RNKPATROL.Telegraph.Ripple',
            'runes': 'RNKPATROL.Telegraph.Runes',
            'glow': 'RNKPATROL.Telegraph.Glow',
            'portal': 'RNKPATROL.Telegraph.Portal'
        },
        default: 'ripple',
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'telegraphDuration', {
        name: game.i18n.localize('RNKPATROL.Settings.TelegraphDuration'),
        hint: game.i18n.localize('RNKPATROL.Settings.TelegraphDurationHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 500,
            max: 3000,
            step: 100
        },
        default: 1500,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'telegraphColor', {
        name: game.i18n.localize('RNKPATROL.Settings.TelegraphColor'),
        hint: game.i18n.localize('RNKPATROL.Settings.TelegraphColorHint'),
        scope: 'world',
        config: true,
        type: String,
        default: '#ff4444',
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'telegraphGMOnly', {
        name: game.i18n.localize('RNKPATROL.Settings.TelegraphGMOnly'),
        hint: game.i18n.localize('RNKPATROL.Settings.TelegraphGMOnlyHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    })
    
    // ==========================================
    // JAIL SYSTEM SETTINGS
    // ==========================================
    
    game.settings.register(MODULE_ID, 'jailEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.JailEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.JailEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'jailDefaultDuration', {
        name: game.i18n.localize('RNKPATROL.Settings.JailDefaultDuration'),
        hint: game.i18n.localize('RNKPATROL.Settings.JailDefaultDurationHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 30,
            max: 600,
            step: 30
        },
        default: 120,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'jailEscapeEnabled', {
        name: game.i18n.localize('RNKPATROL.Settings.JailEscapeEnabled'),
        hint: game.i18n.localize('RNKPATROL.Settings.JailEscapeEnabledHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    })
    
    game.settings.register(MODULE_ID, 'jailEscapeDC', {
        name: game.i18n.localize('RNKPATROL.Settings.JailEscapeDC'),
        hint: game.i18n.localize('RNKPATROL.Settings.JailEscapeDCHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: {
            min: 5,
            max: 30,
            step: 1
        },
        default: 15,
        requiresReload: false
    })
    
    // Jail scenes data (stored internally)
    game.settings.register(MODULE_ID, 'jailScenes', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    })
    
    // Prisoner tracking data (legacy - single prisoner data object)
    game.settings.register(MODULE_ID, 'prisonerData', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    })
    
    // Prisoner tracking data (array format used by JailSystem)
    game.settings.register(MODULE_ID, 'prisoners', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    })
    
    // Jail customizations (guard/inmate actor assignments, spawn point overrides)
    game.settings.register(MODULE_ID, 'jailCustomizations', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    })
    
    // ==========================================
    // Hidden/Internal Settings
    // ==========================================
    
    // Store patrol data per scene
    game.settings.register(MODULE_ID, 'scenePatrolData', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    })
    
    // Store global presets
    game.settings.register(MODULE_ID, 'patrolPresets', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    })
    
    // Client-side UI preferences
    game.settings.register(MODULE_ID, 'managerPosition', {
        scope: 'client',
        config: false,
        type: Object,
        default: { left: 100, top: 100 }
    })
}

/**
 * Get a setting value with fallback
 * @param {string} key 
 * @param {*} fallback 
 * @returns {*}
 */
export function getSetting(key, fallback = null) {
    try {
        return game.settings.get(MODULE_ID, key)
    } catch {
        return fallback
    }
}

/**
 * Set a setting value
 * @param {string} key 
 * @param {*} value 
 */
export async function setSetting(key, value) {
    await game.settings.set(MODULE_ID, key, value)
}
