export const SHOWCASE_BLOCKS = [
  {
    id: 'hex-color-picker',
    name: 'Hex color picker',
  },
]

export function showcaseBlock(id) {
  const entry = SHOWCASE_BLOCKS.find((item) => item.id === id)
  if (!entry) throw new Error(`Unknown showcase block: ${id}`)
  return entry
}
