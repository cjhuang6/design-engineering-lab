export const SHOWCASE_BLOCKS = [
  {
    id: 'slot-code',
    name: 'Security code',
  },
  {
    id: 'hex-color-picker',
    name: 'Hex color picker',
  },
  {
    id: 'guide-feedback',
    name: 'Guide feedback',
  },
]

export function showcaseBlock(id) {
  const entry = SHOWCASE_BLOCKS.find((item) => item.id === id)
  if (!entry) throw new Error(`Unknown showcase block: ${id}`)
  return entry
}
