import { useEffect, useState, type FormEvent } from 'react'
import {
  TRAVEL_MODE_LABELS,
  TRAVEL_MODES,
  type TravelMode,
  type Trip,
} from '../../domain/trip'
import type { TripMetadataInput } from '../../domain/tripCollection'

type SaveResult =
  | {
      ok: true
    }
  | {
      ok: false
      message: string
    }

type TripFormProps = {
  initialTrip?: Trip
  onCancel: () => void
  onSubmit: (input: TripMetadataInput) => SaveResult
}

function todayForInput() {
  const today = new Date()
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

export function TripForm({
  initialTrip,
  onCancel,
  onSubmit,
}: TripFormProps) {
  const today = todayForInput()
  const [title, setTitle] = useState(initialTrip?.title ?? '')
  const [destination, setDestination] = useState(
    initialTrip?.destination ?? '',
  )
  const [startDate, setStartDate] = useState(
    initialTrip?.startDate ?? today,
  )
  const [endDate, setEndDate] = useState(initialTrip?.endDate ?? today)
  const [defaultTravelMode, setDefaultTravelMode] = useState<TravelMode>(
    initialTrip?.defaultTravelMode ?? 'transit',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('请填写行程标题')
      return
    }

    if (endDate < startDate) {
      setError('结束日期不能早于开始日期')
      return
    }

    const result = onSubmit({
      title: title.trim(),
      destination: destination.trim() || undefined,
      startDate,
      endDate,
      defaultTravelMode,
    })

    if (!result.ok) {
      setError(result.message)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="trip-form-title"
        aria-modal="true"
        className="trip-form-panel"
        role="dialog"
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">
              {initialTrip ? 'EDIT TRIP' : 'NEW ITINERARY'}
            </p>
            <h2 id="trip-form-title">
              {initialTrip ? '编辑行程信息' : '创建一趟新行程'}
            </h2>
          </div>
          <button
            aria-label="关闭"
            className="icon-button"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="trip-form" onSubmit={handleSubmit}>
          <label className="field field-wide">
            <span>行程标题</span>
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：杭州秋日两日游"
              required
              value={title}
            />
          </label>

          <label className="field field-wide">
            <span>目的地 <small>选填</small></span>
            <input
              maxLength={120}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="例如：杭州"
              value={destination}
            />
          </label>

          <label className="field">
            <span>开始日期</span>
            <input
              onChange={(event) => setStartDate(event.target.value)}
              onInput={(event) => setStartDate(event.currentTarget.value)}
              required
              type="date"
              value={startDate}
            />
          </label>

          <label className="field">
            <span>结束日期</span>
            <input
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              onInput={(event) => setEndDate(event.currentTarget.value)}
              required
              type="date"
              value={endDate}
            />
          </label>

          <label className="field field-wide">
            <span>默认交通方式</span>
            <select
              onChange={(event) =>
                setDefaultTravelMode(event.target.value as TravelMode)
              }
              value={defaultTravelMode}
            >
              {TRAVEL_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {TRAVEL_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>

          <p className="form-timezone">
            时区固定为 <strong>Asia/Shanghai</strong>
          </p>

          {error ? (
            <p aria-live="polite" className="form-error">
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button className="text-button" onClick={onCancel} type="button">
              取消
            </button>
            <button className="primary-button" type="submit">
              {initialTrip ? '保存修改' : '创建行程'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
