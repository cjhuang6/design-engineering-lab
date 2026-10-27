import { useId } from 'react'
import { SegmentedControl, ShowcaseSlider } from './controls.jsx'

const FILL_OPTIONS = [
  { value: 'retro', label: 'Retro' },
  { value: 'smooth', label: 'Smooth' },
]

export function SlotCodeControls({ fillStyle, countdown, onFillStyle, onCountdown, onReset }) {
  const headingId = useId()
  const smooth = fillStyle === 'smooth'
  return (
    <div className="showcase-controls">
      <div className="showcase-controls-head">
        <h4 id={headingId}>Controls</h4>
        <button type="button" className="showcase-reset" aria-label="Reset controls" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="showcase-controls-list" data-showcase-scroll="" role="group" aria-labelledby={headingId}>
        <SegmentedControl label="Fill style" value={fillStyle} options={FILL_OPTIONS} onChange={onFillStyle} />
        <ShowcaseSlider
          label="Countdown"
          min={3}
          max={30}
          step={1}
          value={countdown}
          display={`${countdown}s`}
          valueText={`${countdown} seconds`}
          disabled={!smooth}
          onChange={onCountdown}
        />
      </div>
    </div>
  )
}
