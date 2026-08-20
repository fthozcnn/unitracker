/**
 * Shared formatting utilities.
 */

/**
 * Formats total seconds into a human-readable time string.
 * @example formatTime(3661) => "1:01:01"
 * @example formatTime(125) => "02:05"
 */
export function formatTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
