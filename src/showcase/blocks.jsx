import { useState } from 'react'
import {
  DARKEN_DEFAULT,
  HexColorPicker,
  HexPickerControls,
  PICKER_DESCRIPTION,
  RADIUS_DEFAULT,
  SCALE_DEFAULT,
} from '../components/hex-color-picker/HexColorPicker.jsx'
import { showcaseBlock } from './catalog.js'

const INITIAL_COLOR = 'color.primitive.blue.600'

export function useHexBlock() {
  const entry = showcaseBlock('hex-color-picker')
  const [value, setValue] = useState(INITIAL_COLOR)
  const [radius, setRadius] = useState(RADIUS_DEFAULT)
  const [scaleHover, setScaleHover] = useState(SCALE_DEFAULT)
  const [darken, setDarken] = useState(DARKEN_DEFAULT)

  function reset() {
    setRadius(RADIUS_DEFAULT)
    setScaleHover(SCALE_DEFAULT)
    setDarken(DARKEN_DEFAULT)
  }

  return {
    id: entry.id,
    name: entry.name,
    description: PICKER_DESCRIPTION,
    content: (
      <HexColorPicker
        value={value}
        onChange={setValue}
        radius={radius}
        scaleHover={scaleHover}
        darken={darken}
      />
    ),
    controls: (
      <HexPickerControls
        radius={radius}
        scaleHover={scaleHover}
        darken={darken}
        onRadius={setRadius}
        onScale={setScaleHover}
        onDarken={setDarken}
        onReset={reset}
      />
    ),
  }
}
