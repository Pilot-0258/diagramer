import { useEffect, useState, type FormEvent } from 'react'
import {
  TRAVEL_MODE_LABELS,
  TRAVEL_MODES,
  type ScheduleItem,
  type TravelMode,
  type Trip,
} from '../../domain/trip'

export type ScheduleItemDraft = {
  type: 'activity' | 'transport'
  title: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  notes?: string
  locationName?: string
  locationAddress?: string
  mode?: TravelMode
  fromName?: string
  fromAddress?: string
  toName?: string
  toAddress?: string
}

type SaveResult =
  | {
      ok: true
    }
  | {
      ok: false
      message: string
    }

type ScheduleItemFormProps = {
  trip: Trip
  initialItem?: ScheduleItem
  onCancel: () => void
  onSubmit: (draft: ScheduleItemDraft) => SaveResult
}

export function ScheduleItemForm({
  trip,
  initialItem,
  onCancel,
  onSubmit,
}: ScheduleItemFormProps) {
  const initialActivity =
    initialItem?.type === 'activity' ? initialItem : undefined
  const initialTransport =
    initialItem?.type === 'transport' ? initialItem : undefined
  const [type, setType] = useState<'activity' | 'transport'>(
    initialItem?.type ?? 'activity',
  )
  const [title, setTitle] = useState(initialItem?.title ?? '')
  const [date, setDate] = useState(initialItem?.date ?? trip.startDate)
  const [endDate, setEndDate] = useState(
    initialTransport?.endDate ?? initialItem?.date ?? trip.startDate,
  )
  const [startTime, setStartTime] = useState(initialItem?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initialItem?.endTime ?? '10:00')
  const [notes, setNotes] = useState(initialItem?.notes ?? '')
  const [locationName, setLocationName] = useState(
    initialActivity?.location?.name ?? '',
  )
  const [locationAddress, setLocationAddress] = useState(
    initialActivity?.location?.address ?? '',
  )
  const [mode, setMode] = useState<TravelMode>(
    initialTransport?.mode ?? trip.defaultTravelMode,
  )
  const [fromName, setFromName] = useState(initialTransport?.from.name ?? '')
  const [fromAddress, setFromAddress] = useState(
    initialTransport?.from.address ?? '',
  )
  const [toName, setToName] = useState(initialTransport?.to.name ?? '')
  const [toAddress, setToAddress] = useState(
    initialTransport?.to.address ?? '',
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
      setError('请填写安排标题')
      return
    }

    if (date < trip.startDate || date > trip.endDate) {
      setError('安排日期必须位于行程日期范围内')
      return
    }

    const effectiveEndDate = type === 'transport' ? endDate : date

    if (
      effectiveEndDate < date ||
      (effectiveEndDate === date && endTime <= startTime)
    ) {
      setError(
        type === 'transport'
          ? '交通结束日期和结束时间必须晚于开始日期和时间'
          : '活动结束时间必须晚于开始时间',
      )
      return
    }

    if (type === 'transport' && (!fromName.trim() || !toName.trim())) {
      setError('交通安排需要填写起点和终点')
      return
    }

    const result = onSubmit({
      type,
      title: title.trim(),
      date,
      endDate: effectiveEndDate,
      startTime,
      endTime,
      notes: notes.trim() || undefined,
      locationName: locationName.trim() || undefined,
      locationAddress: locationAddress.trim() || undefined,
      mode,
      fromName: fromName.trim() || undefined,
      fromAddress: fromAddress.trim() || undefined,
      toName: toName.trim() || undefined,
      toAddress: toAddress.trim() || undefined,
    })

    if (!result.ok) {
      setError(result.message)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="schedule-form-title"
        aria-modal="true"
        className="trip-form-panel schedule-form-panel"
        role="dialog"
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">
              {initialItem ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}
            </p>
            <h2 id="schedule-form-title">
              {initialItem ? '编辑安排' : '添加一项安排'}
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

        <form className="trip-form schedule-form" onSubmit={handleSubmit}>
          <fieldset className="type-picker field-wide">
            <legend>安排类别</legend>
            <div>
              <button
                aria-pressed={type === 'activity'}
                disabled={Boolean(initialItem)}
                onClick={() => setType('activity')}
                type="button"
              >
                活动
                <small>游览、用餐、休息等</small>
              </button>
              <button
                aria-pressed={type === 'transport'}
                disabled={Boolean(initialItem)}
                onClick={() => setType('transport')}
                type="button"
              >
                交通
                <small>步行、驾车、公交等</small>
              </button>
            </div>
          </fieldset>

          <label className="field field-wide">
            <span>安排标题</span>
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                type === 'activity'
                  ? '例如：游览西湖'
                  : '例如：乘地铁去博物馆'
              }
              required
              value={title}
            />
          </label>

          <label className="field">
            <span>{type === 'transport' ? '开始日期' : '日期'}</span>
            <input
              max={trip.endDate}
              min={trip.startDate}
              onChange={(event) => {
                setDate(event.target.value)
                if (endDate < event.target.value) {
                  setEndDate(event.target.value)
                }
              }}
              onInput={(event) => {
                setDate(event.currentTarget.value)
                if (endDate < event.currentTarget.value) {
                  setEndDate(event.currentTarget.value)
                }
              }}
              required
              type="date"
              value={date}
            />
          </label>

          <div className="time-fields">
            <label className="field">
              <span>开始时间</span>
              <input
                onChange={(event) => setStartTime(event.target.value)}
                onInput={(event) => setStartTime(event.currentTarget.value)}
                required
                type="time"
                value={startTime}
              />
            </label>
            <span aria-hidden="true" className="time-separator">
              —
            </span>
            <label className="field">
              <span>结束时间</span>
              <input
                onChange={(event) => setEndTime(event.target.value)}
                onInput={(event) => setEndTime(event.currentTarget.value)}
                required
                type="time"
                value={endTime}
              />
            </label>
          </div>

          {type === 'transport' ? (
            <>
              <label className="field field-wide">
                <span>结束日期</span>
                <input
                  max={trip.endDate}
                  min={date}
                  onChange={(event) => setEndDate(event.target.value)}
                  onInput={(event) => setEndDate(event.currentTarget.value)}
                  required
                  type="date"
                  value={endDate}
                />
              </label>
              <p className="cross-day-hint field-wide">
                跨日交通请把结束日期设为实际到达日期；当天结束则保持与开始日期相同。
              </p>
            </>
          ) : null}

          {type === 'activity' ? (
            <>
              <label className="field">
                <span>地点 <small>选填</small></span>
                <input
                  maxLength={120}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="例如：西湖湖滨码头"
                  value={locationName}
                />
              </label>
              <label className="field">
                <span>地址 <small>选填</small></span>
                <input
                  maxLength={240}
                  onChange={(event) => setLocationAddress(event.target.value)}
                  placeholder="后续可用于地图定位"
                  value={locationAddress}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field field-wide">
                <span>交通方式</span>
                <select
                  onChange={(event) =>
                    setMode(event.target.value as TravelMode)
                  }
                  value={mode}
                >
                  {TRAVEL_MODES.map((travelMode) => (
                    <option key={travelMode} value={travelMode}>
                      {TRAVEL_MODE_LABELS[travelMode]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="transport-place">
                <p>起点</p>
                <label className="field">
                  <span>地点名称</span>
                  <input
                    maxLength={120}
                    onChange={(event) => setFromName(event.target.value)}
                    placeholder="例如：酒店"
                    required
                    value={fromName}
                  />
                </label>
                <label className="field">
                  <span>地址 <small>选填</small></span>
                  <input
                    maxLength={240}
                    onChange={(event) => setFromAddress(event.target.value)}
                    placeholder="详细地址"
                    value={fromAddress}
                  />
                </label>
              </div>
              <div className="transport-place">
                <p>终点</p>
                <label className="field">
                  <span>地点名称</span>
                  <input
                    maxLength={120}
                    onChange={(event) => setToName(event.target.value)}
                    placeholder="例如：博物馆"
                    required
                    value={toName}
                  />
                </label>
                <label className="field">
                  <span>地址 <small>选填</small></span>
                  <input
                    maxLength={240}
                    onChange={(event) => setToAddress(event.target.value)}
                    placeholder="详细地址"
                    value={toAddress}
                  />
                </label>
              </div>
            </>
          )}

          <label className="field field-wide">
            <span>备注 <small>选填</small></span>
            <textarea
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="预约信息、集合地点、注意事项……"
              rows={3}
              value={notes}
            />
          </label>

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
              {initialItem ? '保存修改' : '添加到时间表'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
