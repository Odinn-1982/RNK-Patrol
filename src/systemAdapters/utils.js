// Utility helpers for adapters to avoid circular dependencies
export function getProperty(obj, path) {
    if (!obj || !path || typeof path !== 'string') return undefined
    try {
        return path.split('.').reduce((o, p) => o?.[p], obj)
    } catch (err) { return undefined }
}

export function parseAverageDamage(formula) {
    if (!formula || typeof formula !== 'string') return null
    const clean = formula.replace(/\s+/g, '')
    const m = clean.match(/(\d+)d(\d+)([+-]\d+)?/i)
    if (!m) return null
    const diceCount = parseInt(m[1], 10)
    const diceSides = parseInt(m[2], 10)
    const modifier = m[3] ? parseInt(m[3], 10) : 0
    const avgDice = diceCount * (diceSides + 1) / 2
    return avgDice + modifier
}

export function averageDiceString(formula) { return parseAverageDamage(formula) }

export default { getProperty, parseAverageDamage, averageDiceString }
