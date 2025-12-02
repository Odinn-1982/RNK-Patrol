/**
 * Simple AI Service abstraction
 * Provides system-based heuristics and optional OpenAI calls for decisions
 */
import { MODULE_ID, debug, error } from './main.js'
import { getSetting } from './settings.js'
import { getAdapter } from './systemAdapters/index.js'

export class AIService {
    static _midiPendingWorkflows = new Map();
    static _midiInit = false;

    static getProvider() {
        return getSetting('aiProvider', 'system')
    }

    // Decide whether a bribe is accepted; returns boolean
    static async decideBribery({ bribeAmount = 0, playerGold = 0, baseCost = 50, patrolScale = 1 }) {
        const provider = this.getProvider()
        if (provider === 'openai') {
            const result = await this._callOpenAi('bribery', { bribeAmount, playerGold, baseCost, patrolScale })
            const log = { type: 'bribery', message: `Bribery decision (openai): ${result}`, payload: { bribeAmount, playerGold, baseCost, patrolScale }, provider }
            game.rnkPatrol?.logAiDecision?.(log)
            if (typeof result === 'boolean') return result
        }
        // System heuristic: accept if bribe >= baseCost * 0.75 and player has gold, and a success chance
        let threshold = baseCost * 0.75 * patrolScale
        // adjust for aggressiveness if provided in arguments
        const aggr = arguments?.[0]?.aggressiveness || 'normal'
        if (aggr === 'aggressive') threshold *= 0.6
        if (aggr === 'conservative') threshold *= 1.1
        const briberyChance = getSetting('briberyChance', 70)
        if (!(playerGold >= bribeAmount && bribeAmount >= threshold)) return false
        const final = Math.random() * 100 <= briberyChance
        game.rnkPatrol?.logAiDecision?.({ type: 'bribery', message: `Bribery decision (system): ${final}`, payload: { bribeAmount, playerGold, baseCost, patrolScale, briberyChance }, provider })
        return final
    }

    // Decide capture outcome; returns 'combat','jail','theft','disregard'
    static async decideCaptureOutcome({ weights, context = {} }) {
        const provider = this.getProvider()
        if (provider === 'openai') {
            const result = await this._callOpenAi('captureOutcome', { weights, context })
            game.rnkPatrol?.logAiDecision?.({ type: 'captureOutcome', message: `OpenAI decision: ${result}`, payload: { weights, context }, provider })
            if (typeof result === 'string') return result
        }
        // System heuristic: adjust weights according to aggressiveness (if present)
        const aggr = context?.aggressiveness || 'normal'
        if (aggr === 'aggressive') {
            if (weights.combat) weights.combat = Math.max(0, Math.min(100, Math.round(weights.combat * 1.2)))
            if (weights.theft) weights.theft = Math.round(weights.theft * 0.8)
        } else if (aggr === 'conservative') {
            if (weights.combat) weights.combat = Math.round(weights.combat * 0.7)
            if (weights.theft) weights.theft = Math.round(weights.theft * 1.1)
        }
        // System heuristic: use weights directly - pick max weight
        const entries = Object.entries(weights || {})
        if (!entries.length) return 'combat'
        entries.sort((a, b) => b[1] - a[1])
        const outcome = entries[0][0]
        game.rnkPatrol?.logAiDecision?.({ type: 'captureOutcome', message: `System decision: ${outcome}`, payload: { weights, context }, provider })
        return outcome
    }

    // Decide a combat action given combatant state; return 'attack'|'defend'|'pursue'|'flee'
    static async decideCombatAction({ combatant, enemies, state = {} }) {
        const provider = this.getProvider()
        if (provider === 'openai') {
            const result = await this._callOpenAi('combatAction', { combatant, enemies, state })
            game.rnkPatrol?.logAiDecision?.({ type: 'combatAction', message: `OpenAI combat action: ${result}`, payload: { combatant: combatant?.name, enemies: enemies?.length, state }, provider })
            if (typeof result === 'string') return result
        }
        // System heuristic: simple logic based on HP ratio
        const hpRatio = (combatant?.actor?.system?.attributes?.hp?.value ?? 50) / (combatant?.actor?.system?.attributes?.hp?.max ?? 50)
        if (hpRatio < 0.2) return 'flee'
        if (hpRatio < 0.4 && enemies?.length > 2) return 'defend'
        return 'attack'
    }

    // Auto-resolve a combat based on heuristics
    static async autoResolveCombat(combat) {
        try {
            if (!combat) return
            const combatants = combat.combatants.contents
            if (!combatants.length) return

            // Group by disposition via tokens
            const groups = {}
            for (const c of combatants) {
                const token = c.token
                if (!token) continue
                const disp = token.document.disposition
                if (!groups[disp]) groups[disp] = []
                groups[disp].push({ combatant: c, token })
            }

            const groupKeys = Object.keys(groups)
            if (groupKeys.length < 2) return

            // Simplified simulation: compute total HP and DPR for each group
            const stats = {}
            for (const k of groupKeys) {
                let totalHp = 0, totalDpr = 0
                for (const e of groups[k]) {
                    const s = e.token.getFlag(MODULE_ID, 'scaledStats') || e.token.actor?.system?.attributes?.hp || {}
                    const tAdapter = getAdapter(e.token?.actor?.system?.id || game?.system?.id)
                    const hp = (tAdapter?.getActorMaxHp?.(e.token) ?? tAdapter?.getActorHp?.(e.token)) || getProperty(e.token, 'document.actorData.system.attributes.hp.max') || getProperty(e.token, 'document.actorData.system.attributes.hp.value') || getProperty(e.token, 'actor.system.attributes.hp.max') || getProperty(e.token, 'actor.system.attributes.hp.value') || s?.hp || 50
                    totalHp += hp

                    // Estimate DPR using attack info and target AC of the opposing group(s)
                    let tokenDpr = 0
                    try {
                        const attackInfo = await this._estimateAttackForToken(e.token)
                        if (attackInfo) {
                            // Estimate hit chance against average enemy AC (simple average)
                            const opponentKeys = groupKeys.filter(x => x !== k)
                            let oppAcTotal = 0, oppCount = 0
                            for (const ok of opponentKeys) {
                                for (const opp of groups[ok]) {
                                    const oppAdapter = getAdapter(opp?.actor?.system?.id || game?.system?.id)
                                    const ac = oppAdapter?.getActorAc?.(opp.actor) || getProperty(opp, 'actor.system.attributes.ac.value') || getProperty(opp, 'actor.system.attributes.ac') || 10
                                    oppAcTotal += (ac || 10)
                                    oppCount++
                                }
                            }
                            const avgOppAc = oppCount > 0 ? (oppAcTotal / oppCount) : 10
                            const hitChance = Math.max(0.05, Math.min(0.95, (21 - ((avgOppAc || 10) - (attackInfo.attackBonus || 0))) / 20))
                            tokenDpr = (attackInfo.avgDamage || 5) * hitChance
                        } else {
                            tokenDpr = await this._estimateDprForToken(e.token) || 5
                        }
                    } catch (err) {
                        tokenDpr = await this._estimateDprForToken(e.token) || 5
                    }
                    totalDpr += tokenDpr
                }
                stats[k] = { totalHp, totalDpr }
            }

            // Multi-round simulation (round-based expected DPS) to find a clear loser
            const MAX_ROUNDS = 6
            let simStats = {}
            for (const k of groupKeys) simStats[k] = { hp: stats[k].totalHp, dpr: stats[k].totalDpr }
            let loserKeys = null

            for (let r = 0; r < MAX_ROUNDS; r++) {
                // Apply damage: each group's HP reduced by the sum of all opponent DPR
                const newStats = {}
                for (const k of groupKeys) {
                    const opponentKeys = groupKeys.filter(x => x !== k)
                    let oppDpr = 0
                    for (const ok of opponentKeys) oppDpr += simStats[ok].dpr
                    const newHp = simStats[k].hp - oppDpr
                    newStats[k] = { hp: newHp, dpr: simStats[k].dpr }
                }
                simStats = newStats

                // Check if any group fully defeated
                const alive = groupKeys.filter(k => simStats[k].hp > 0)
                if (alive.length < groupKeys.length) {
                    // Find losers
                    loserKeys = groupKeys.filter(k => simStats[k].hp <= 0)
                    break
                }
            }

            if (!loserKeys) {
                // Fallback: fallback to time-to-kill estimate
                let best = null
                let bestTime = Infinity
                for (const k of groupKeys) {
                    const { totalHp, totalDpr } = stats[k]
                    const opponentKeys = groupKeys.filter(x => x !== k)
                    let oppDpr = 0
                    for (const ok of opponentKeys) oppDpr += stats[ok].totalDpr
                    const timeToDie = oppDpr > 0 ? (totalHp / oppDpr) : Infinity
                    if (timeToDie < bestTime) { best = k; bestTime = timeToDie }
                }
                loserKeys = groupKeys.filter(k => k !== best)
            }

            // Delete or hide all tokens in losing groups
            for (const lk of loserKeys) {
                for (const e of groups[lk]) {
                    try {
                        const targetIsPlayer = e.token.actor?.hasPlayerOwner
                        const applyToPlayers = game.settings.get(MODULE_ID, 'autoResolveAffectsPlayers')

                        // If token belongs to players and we are not configured to affect players - create a suggestion instead
                        if (targetIsPlayer && !applyToPlayers) {
                            const msg = `${e.token.name} would be defeated by auto-resolve. Manual action recommended.`
                            ChatMessage.create({ content: msg, whisper: game.users.filter(u => u.isGM).map(u => u.id) })
                            continue
                        }

                        // Non-player: apply defeat by setting HP to 0 if actor exists, or hide the token
                        if (!targetIsPlayer && e.token.actor) {
                            try {
                                // Save token document to log for undo
                                const tokenDocState = e.token.document.toObject()
                                const beforeHp = e.token.getFlag(MODULE_ID, 'scaledStats')?.hp ?? (e.token?.actor ? getAdapter(e.token.actor?.system?.id)?.getActorHp?.(e.token) : null) ?? getProperty(e.token, 'actor.system.attributes.hp.value') ?? getProperty(e.token, 'actor.system.hp')
                                const adapter3 = getAdapter(e.token?.actor?.system?.id || game?.system?.id)

                                // Use adapter tokenHideRemove helper if present
                                if (adapter3 && typeof adapter3.tokenHideRemove === 'function') {
                                    const undoPayload = await adapter3.tokenHideRemove(e.token, { applyToPlayers: applyToPlayers })
                                    const undoAction = undoPayload?.action || (undoPayload ? 'restoreToken' : 'unhideToken')
                                    game.rnkPatrol?.logAiDecision?.({ type: 'autoResolve', message: `NPC token ${e.token.name} defeated and removed`, payload: { tokenId: e.token.id }, provider: this.getProvider(), undo: { action: undoAction, tokenDoc: tokenDocState, actorId: e.token.actor?.id, beforeHp } })
                                } else {
                                    // Fallback to previous method
                                    if (adapter3 && typeof adapter3.applyDamage === 'function') {
                                        await adapter3.applyDamage(e.token.actor, adapter3.getActorHp(e.token.actor) || 0)
                                    } else if (adapter3 && typeof adapter3.setActorHp === 'function') {
                                        await adapter3.setActorHp(e.token.actor, 0)
                                    } else if (e.token.actor.system?.attributes?.hp !== undefined) {
                                        await e.token.actor.update({ 'system.attributes.hp.value': 0 })
                                    } else if (e.token.actor.system?.hp !== undefined) {
                                        await e.token.actor.update({ 'system.hp': 0 })
                                    }
                                    // Delete token for clarity
                                    await e.token.document.delete()
                                    game.rnkPatrol?.logAiDecision?.({ type: 'autoResolve', message: `NPC token ${e.token.name} defeated and removed`, payload: { tokenId: e.token.id }, provider: this.getProvider(), undo: { action: 'restoreToken', tokenDoc: tokenDocState, actorId: e.token.actor?.id, beforeHp } })
                                }
                            } catch (err) {
                                try { await e.token.document.update({ hidden: true }) } catch (err2) {}
                            }
                        } else {
                            try {
                                const tokenDocState = e.token.document.toObject()
                                await e.token.document.update({ hidden: true })
                                game.rnkPatrol?.logAiDecision?.({ type: 'autoResolve', message: `Token ${e.token.name} hidden/defeated by auto-resolve`, payload: { tokenId: e.token.id, combatId: combat.id }, provider: this.getProvider(), undo: { action: 'unhideToken', tokenDoc: tokenDocState } })
                            } catch (err) {}
                        }
                    } catch (err) {
                        error('Auto-resolve token handling failed', err)
                    }
                }
            }

            // Stop the combat
            try { await combat.delete() } catch (err) {}
            game.rnkPatrol?.logAiDecision?.({ type: 'autoResolve', message: `Combat auto-resolved by RNK Patrol`, payload: { combatId: combat.id }, provider: this.getProvider() })
            ui.notifications.info('Combat auto-resolved by RNK Patrol')
        } catch (err) {
            error('Auto-resolve combat failed', err)
        }
    }

    static async _estimateAttackForToken(token) {
        try {
            const adapter = getAdapter(game?.system?.id)
            if (!adapter) return null
            return await adapter.estimateBestAttackForToken(token)
        } catch (err) { return null }
    }

    static initialize() {
        if (this._midiInit) return
        this._midiInit = true
        try {
            if (typeof Hooks !== 'undefined' && typeof MidiQOL !== 'undefined') {
                // Listen for common Midi-QOL workflow events and capture details
                Hooks.on('midi-qol.RollComplete', (workflow) => { try { this._onMidiWorkflow(workflow) } catch (e) {} })
                Hooks.on('midi-qol.DamageRollComplete', (workflow) => { try { this._onMidiWorkflow(workflow) } catch (e) {} })
                Hooks.on('midi-qol.WorkflowComplete', (workflow) => { try { this._onMidiWorkflow(workflow) } catch (e) {} })
            }
        } catch (err) {
            // Safe no-op if Midi/QOL isn't present
        }
    }

    static async _onMidiWorkflow(workflow) {
        try {
            if (!workflow) return
            const attackerId = workflow?.actor?.id || workflow?.actor?._id || null
            const itemId = workflow?.item?.id || workflow?.item?.uuid || null
            if (!attackerId || !itemId) return

            // Find any pending matching entries from this actor and item within a reasonable timeframe
            const now = Date.now()
            const logLevel = getSetting('midiQolLoggingLevel', 'minimal')
            if (logLevel === 'none') return

            for (const [key, data] of this._midiPendingWorkflows) {
                const parts = key.split(':')
                if (parts.length < 3) continue
                const [kAttacker, kItem, kTs] = parts
                const ts = Number(kTs || 0)
                if (kAttacker === String(attackerId) && (kItem === String(itemId) || kItem === workflow?.item?.uuid) && (now - ts) < 15000) {
                    // Build workflow info
                    const workflowInfo = {}
                    // Always minimal
                    workflowInfo.attackRoll = workflow?.attackRoll?.total || workflow?.roll?.total || null
                    workflowInfo.damageTotal = workflow?.damageTotal || workflow?.damage?.total || null
                    workflowInfo.workflowId = workflow?.id || workflow?.uuid || null

                    if (logLevel === 'verbose') {
                        workflowInfo.targets = Array.from(workflow?.targets?.keys?.() || [])
                        workflowInfo.hitTargets = Array.from(workflow?.hitTargets?.keys?.() || [])
                        workflowInfo.critical = workflow?.isCritical || false

                        // Enrich with attacker item stats via system adapter if available
                        try {
                            const attackerActor = workflow?.actor
                            if (attackerActor) {
                                const adapter = getAdapter(attackerActor?.system?.id || game?.system?.id)
                                if (adapter && typeof adapter.estimateBestAttackForToken === 'function') {
                                    const tidyToken = canvas.tokens.placeables.find(t => t.actor?.id === attackerActor.id)
                                    const est = await adapter.estimateBestAttackForToken(tidyToken)
                                    if (est) {
                                        workflowInfo.estimatedAvgDamage = est.avgDamage
                                        workflowInfo.estimatedAttackBonus = est.attackBonus
                                        workflowInfo.estimatedWeapon = est.weapon?.name || est.weapon?.id || null
                                    }
                                }
                            }
                        } catch (err) {}
                    }

                    // Enrich workflowInfo with per-target breakdown if available
                    try {
                        workflowInfo.targets = workflowInfo.targets || []
                        workflowInfo.targetDetails = workflowInfo.targetDetails || []
                        const damageTargets = (workflow?.damageList || workflow?.damageListDetailed || workflow?.damageDetail || workflow?.damage || workflow?.damageMaps || null)
                        if (damageTargets && Array.isArray(damageTargets)) {
                            for (const dt of damageTargets) {
                                if (dt && (dt.tokenId || dt.targetId || dt.id)) {
                                    const targetId = dt.tokenId || dt.targetId || dt.id
                                    workflowInfo.targetDetails.push({ targetId, damage: dt.damage || dt.total || dt.damageTotal || dt.value || null })
                                }
                            }
                        } else if (workflow?.targets && workflow.targets.size) {
                            try {
                                const keys = Array.from(workflow.targets.keys())
                                for (const uid of keys) {
                                    const t = canvas.tokens.placeables.find(x => x?.id === uid) || canvas.tokens.placeables.find(x => x.actor?.id === uid)
                                    const dmg = workflow?.damage?.get?.(uid) || workflow?.damageList?.find(d => d.tokenId === uid)?.damage || null
                                    workflowInfo.targetDetails.push({ targetId: uid, targetName: t?.name || null, damage: dmg })
                                }
                            } catch (err) {}
                        }
                    } catch (e) {}

                    // Update log entry with more detailed workflow info
                    if (data?.logTimestamp) {
                        game.rnkPatrol?.updateAiLogEntry?.(data.logTimestamp, { payload: { ...(data.payload || {}), workflow: workflowInfo } })
                    }
                    // Clean pending
                    this._midiPendingWorkflows.delete(key)
                }
            }
        } catch (err) {
            // ignore
        }
    }

    // Perform an action suggested by AI for the combatant
    static async performAction({ combatant, action, targetToken = null, combat = null }) {
        try {
            if (!combatant || !action) return false
            // For now, only support 'attack'
            if (action === 'attack') {
                let attacker = combatant.token?.object
                if (!attacker) {
                    const tid = combatant.token?.id || combatant.token?._id
                    if (tid) attacker = canvas.tokens.get(tid)
                }
                let target = null
                if (targetToken?.object) target = targetToken.object
                else if (targetToken?._id || targetToken?.id) target = canvas.tokens.get(targetToken._id || targetToken.id)
                if (!target) target = (combat?.combatants?.contents.find(c => c.token?.document?.disposition !== combatant.token?.document?.disposition)?.token?.object)
                if (!attacker || !target || !target.actor) return false

                // Use best weapon if available
                const attackInfo = await this._estimateAttackForToken(attacker)
                const attackBonus = attackInfo?.attackBonus || 0
                const avgDamage = attackInfo?.avgDamage || (await this._estimateDprForToken(attacker)) || 5

                // Compute target AC
                const targetAdapter = getAdapter(target?.actor?.system?.id || game?.system?.id)
                const targetAc = targetAdapter?.getActorAc?.(target.actor) || getProperty(target, 'actor.system.attributes.ac.value') || getProperty(target, 'actor.system.attributes.ac') || getProperty(target, 'actor.system.defenses.ac') || 10

                // Roll attack - prefer system adapters
                try {
                    // If Midi-QOL is present and the attacker has an item, attempt a native item use for better fidelity
                    const item = attackInfo?.weapon
                    const adapter = getAdapter(game?.system?.id)
                    const midiEnabled = typeof MidiQOL !== 'undefined'

                    if (item && typeof adapter?.rollItemUse === 'function') {
                        if (midiEnabled && item && item?.uuid) {
                            try {
                                // Use MidiQOL completeItemUse to perform item attack
                                const tsKey = Date.now()
                                const key = `${attacker.actor?.id}:${item.uuid}:${tsKey}`
                                // Log an initial entry with placeholder
                                const logEntry = { type: 'performAction', message: `Performed action via MidiQOL: ${item.name}`, payload: { itemId: item.id, actorId: attacker.actor?.id, targetId: target.actor?.id }, provider: this.getProvider(), timestamp: tsKey }
                                const saved = await game.rnkPatrol?.logAiDecision?.(logEntry)
                                if (saved && saved.timestamp) {
                                    // Register pending workflow to update later
                                    AIService._midiPendingWorkflows.set(key, { logTimestamp: saved.timestamp, payload: logEntry.payload })
                                }
                                const workflow = await adapter.rollItemUse(item, attacker, target ? [target] : [])
                                // MidiQOL returns a workflow; try to extract key aggregates if available
                                const workflowInfo = {}
                                try {
                                    workflowInfo.attackRoll = workflow?.attackRoll?.total || workflow?.roll?.total || null
                                    workflowInfo.damageTotal = workflow?.damageTotal || workflow?.damage?.total || null
                                    workflowInfo.targets = Array.from(workflow?.targets?.keys?.() || [])
                                    workflowInfo.hitTargets = Array.from(workflow?.hitTargets?.keys?.() || [])
                                    workflowInfo.critical = workflow?.isCritical || false
                                    workflowInfo.workflowId = workflow?.id || workflow?.uuid || null
                                } catch (err) {}
                                // Update the saved entry (if present) with workflow info
                                if (AIService._midiPendingWorkflows.has(key)) {
                                    const data = AIService._midiPendingWorkflows.get(key)
                                    await game.rnkPatrol?.updateAiLogEntry?.(data.logTimestamp, { payload: { ...(data.payload || {}), workflow: workflowInfo } })
                                    AIService._midiPendingWorkflows.delete(key)
                                } else {
                                    game.rnkPatrol?.logAiDecision?.({ type: 'performAction', message: `Performed action via MidiQOL: ${item.name}`, payload: { itemId: item.id, actorId: attacker.actor?.id, targetId: target.actor?.id, workflow: workflowInfo }, provider: this.getProvider() })
                                }
                                return true
                            } catch (err) {
                                // Fallback to local roll
                            }
                        }
                        // If the item has a roll method (system-native), try that for better fidelity
                        if (item && typeof item.roll === 'function') {
                            try {
                                const result = await item.roll({ target: target })
                                const rollTotal = result?.total || result?.roll?.total || null
                                if (rollTotal) {
                                    game.rnkPatrol?.logAiDecision?.({ type: 'performAction', message: `Performed system item roll: ${item.name}`, payload: { itemId: item.id, actorId: attacker.actor?.id, targetId: target.actor?.id, rollTotal }, provider: this.getProvider() })
                                    return true
                                }
                            } catch (err) {
                                // fallback
                            }
                        }
                    }

                    const atkRoll = await new Roll(`1d20 + ${attackBonus}`).evaluate({ async: true })
                    const hit = atkRoll.total >= (targetAc || 10)
                    let damageRollValue = Math.round(avgDamage)

                    // If we have a weapon formula, try to roll exact damage
                    const wp = attackInfo?.weapon
                    if (wp) {
                        const dmgParts = getProperty(wp, 'system.damage.parts') || []
                        const dmgFormula = dmgParts[0]?.[0] || getProperty(wp, 'system.damage.value') || null
                        if (dmgFormula) {
                            try {
                                const dmgRoll = await new Roll(dmgFormula).evaluate({ async: true })
                                damageRollValue = dmgRoll.total
                            } catch (err) { /* fallback to avg */ }
                        }
                    }

                    if (!hit) {
                        game.rnkPatrol?.logAiDecision?.({ type: 'performAction', message: `AI attack missed: ${attacker.name} -> ${target.name}`, payload: { attackerId: attacker.actor?.id, targetId: target.actor?.id, attackRoll: atkRoll.total, attackBonus, targetAc }, provider: this.getProvider() })
                        return false
                    }

                    // Reduce HP on successful hit (use adapter if available for system compatibility)
                    const targetAdapter3 = getAdapter(target?.actor?.system?.id || game?.system?.id)
                    const currentHp = targetAdapter3?.getActorHp?.(target) ?? getProperty(target, 'actor.system.attributes.hp.value') ?? target.actor.system?.attributes?.hp?.value ?? target.actor.system?.hp ?? 1
                    const beforeHp = currentHp
                    const newHp = Math.max(0, currentHp - damageRollValue)
                    try {
                        const updated = (typeof targetAdapter3?.applyDamage === 'function') ? await targetAdapter3.applyDamage(target.actor, (targetAdapter3.getActorHp(target.actor) || 0) - newHp) : (typeof targetAdapter3?.setActorHp === 'function' ? await targetAdapter3.setActorHp(target.actor, newHp) : await target.actor.update({ 'system.attributes.hp.value': newHp }))
                        // Log with undo info
                        const logEntry = { type: 'performAction', message: `Performed ${action} by ${attacker.name} on ${target.name}: ${damageRollValue} damage`, payload: { attackerId: attacker.actor?.id, targetId: target.actor?.id, attackRoll: atkRoll.total, damage: damageRollValue, attackBonus, targetAc }, provider: this.getProvider(), undo: { actorId: target.actor.id, before: beforeHp, after: newHp } }
                        game.rnkPatrol?.logAiDecision?.(logEntry)
                        return true
                    } catch (err) {
                        error('AI performAction failed to update HP', err)
                        return false
                    }
                } catch (err) {
                    error('AI performAction attack roll failed', err)
                    return false
                }
            }
            return false
        } catch (err) { error('AI performAction error', err); return false }
    }

    // Internal helper to call OpenAI endpoint; returns parsed output or null on errors
    static async _callOpenAi(intent, payload) {
        const apiKey = getSetting('aiApiKey')
        if (!apiKey) return null
        try {
            const openaiPayload = this._buildOpenAiPayload(intent, payload)
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(openaiPayload)
            })
            const json = await res.json()
            const content = json?.choices?.[0]?.message?.content
            return this._parseOpenAiResponse(intent, content)
        } catch (err) {
            error('OpenAI call failed', err)
            return null
        }
    }

    static _buildOpenAiPayload(intent, payload) {
        let system = 'You are an assistant for tabletop game automation.'
        let userPrompt = ''
        switch (intent) {
            case 'bribery':
                userPrompt = `Decide if a player will accept a bribe. Data: ${JSON.stringify(payload)}`
                break
            case 'captureOutcome':
                userPrompt = `Decide capture outcome. Data: ${JSON.stringify(payload)}`
                break
            case 'combatAction':
                userPrompt = `Decide combat action. Data: ${JSON.stringify(payload)}`
                break
            default:
                userPrompt = `General decision. Data: ${JSON.stringify(payload)}`
        }
        return { model: 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }], temperature: 0.5 }
    }

    static _parseOpenAiResponse(intent, content) {
        if (!content) return null
        try {
            // Generic parse attempt: if content includes JSON, try to parse
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) return JSON.parse(jsonMatch[0])
            // Bribery expected 'true'/'false'
            if (intent === 'bribery') return content.toLowerCase().includes('true')
            if (intent === 'captureOutcome') return content.split('\n')[0].toLowerCase()
            if (intent === 'combatAction') return content.split('\n')[0].toLowerCase()
            return content
        } catch (err) { return null }
    }
}

function getProperty(obj, path) {
    if (!obj || !path) return undefined
    try {
        return path.split('.').reduce((a, p) => a?.[p], obj)
    } catch (err) { return undefined }
}

// Estimate DPR for a token by inspecting actor items (best-effort)
AIService._estimateDprForToken = async function(token) {
    try {
        const actor = token.actor
        if (!actor) return null

        // Prefer adapter's estimation for best speed
        const adapter = getAdapter(game?.system?.id)
        if (adapter?.estimateBestAttackForToken) {
            const est = await adapter.estimateBestAttackForToken(token)
            if (est?.avgDamage) return est.avgDamage
        }

        // Heuristic: apply previous logic as a fallback
        const weapons = actor.items?.filter(i => i.type === 'weapon' || i.type === 'strike') || []
        let best = null
        for (const w of weapons) {
            const dmgParts = getProperty(w, 'system.damage.parts')
            if (dmgParts && Array.isArray(dmgParts) && dmgParts.length) {
                const formula = dmgParts[0][0]
                const avg = parseAverageDamage(formula)
                if (avg && (best === null || avg > best)) best = avg
            } else {
                const pfDice = getProperty(w, 'system.damage.value') || getProperty(w, 'system.damage.dice')
                if (pfDice) {
                    const avg = parseAverageDamage(pfDice)
                    if (avg && (best === null || avg > best)) best = avg
                }
            }
        }
        if (best) return best
        const scaled = token.getFlag(MODULE_ID, 'scaledStats')
        if (scaled && scaled.damage) return scaled.damage
        return 5
    } catch (err) {
        return null
    }
}

function parseAverageDamage(formula) {
    if (!formula || typeof formula !== 'string') return null
    // Remove spaces
    const clean = formula.replace(/\s+/g, '')
    // Match XdY+k or XdY
    const m = clean.match(/(\d+)d(\d+)([+-]\d+)?/i)
    if (!m) return null
    const diceCount = parseInt(m[1], 10)
    const diceSides = parseInt(m[2], 10)
    const modifier = m[3] ? parseInt(m[3], 10) : 0
    const avgDice = diceCount * (diceSides + 1) / 2
    return avgDice + modifier
}

export default AIService
