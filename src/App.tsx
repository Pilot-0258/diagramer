import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toBlob } from 'html-to-image'
import { ZodError } from 'zod'
import {
  createBackupBundle,
  importBackupText,
  type BackupBundle,
} from './domain/backup'
import {
  TRAVEL_MODE_LABELS,
  createActivityItem,
  createTransportItem,
  type AppData,
  type PlaceRef,
  type ScheduleItem,
  type Trip,
} from './domain/trip'
import {
  addScheduleItemInData,
  createTripInData,
  duplicateTripInData,
  findTrip,
  findOverlappingScheduleItemIds,
  listTripDates,
  removeScheduleItemInData,
  removeTripFromData,
  sortScheduleItemsForDisplay,
  sortTripsForDisplay,
  updateTripMetadataInData,
  updateScheduleItemInData,
  type TripMetadataInput,
} from './domain/tripCollection'
import {
  ScheduleItemForm,
  type ScheduleItemDraft,
} from './features/trips/ScheduleItemForm'
import { TripForm } from './features/trips/TripForm'
import { TimelineExportSheet } from './features/trips/TimelineExportSheet'
import { useTripData } from './features/trips/useTripData'

type SaveResult =
  | {
      ok: true
    }
  | {
      ok: false
      message: string
    }

type EditorState = 'create' | { tripId: string } | null
type ScheduleEditorState = 'create' | { itemId: string } | null

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="M4 10h11M11 5l5 5-5 5" />
  </svg>
)

const PinIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
    <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
    <circle cx="12" cy="10" r="2.25" />
  </svg>
)

const PlusIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="M10 4v12M4 10h12" />
  </svg>
)

const CalendarIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
    <path d="M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
    <path d="M8 13h3M8 17h7" />
  </svg>
)

const RouteIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
    <circle cx="6" cy="5" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.5 5H14a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h5.5" />
  </svg>
)

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}.${month}.${day}`
}

function formatDateRange(trip: Trip) {
  return trip.startDate === trip.endDate
    ? formatDate(trip.startDate)
    : `${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`
}

function countTripDays(trip: Trip) {
  const start = Date.parse(`${trip.startDate}T00:00:00.000Z`)
  const end = Date.parse(`${trip.endDate}T00:00:00.000Z`)
  return Math.floor((end - start) / 86_400_000) + 1
}

function formatScheduleDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${parsed.getUTCMonth() + 1} 月 ${parsed.getUTCDate()} 日 · ${weekdays[parsed.getUTCDay()]}`
}

function formatScheduleEnd(endDate: string, startDate: string) {
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const dayDifference = Math.round(
    (end.getTime() - start.getTime()) / 86_400_000,
  )

  if (dayDifference === 1) {
    return '次日'
  }

  return `${end.getUTCMonth() + 1}/${end.getUTCDate()}`
}

function describeError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? '行程数据格式不正确'
  }

  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function downloadBackup(bundle: BackupBundle, filename: string) {
  downloadBlob(
    new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
    filename,
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function safeFilenamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || '行程'
}

function buildPlace(
  name: string | undefined,
  address: string | undefined,
  existing?: PlaceRef,
) {
  const trimmedName = name?.trim()

  if (!trimmedName) {
    return undefined
  }

  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    name: trimmedName,
    address: address?.trim() || undefined,
  } satisfies PlaceRef
}

function buildScheduleItem(
  draft: ScheduleItemDraft,
  existing?: ScheduleItem,
): ScheduleItem {
  const common = {
    id: existing?.id,
    title: draft.title,
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    notes: draft.notes,
  }

  if (draft.type === 'transport') {
    const transport =
      existing?.type === 'transport' ? existing : undefined
    const from = buildPlace(
      draft.fromName,
      draft.fromAddress,
      transport?.from,
    )
    const to = buildPlace(draft.toName, draft.toAddress, transport?.to)

    if (!from || !to || !draft.mode) {
      throw new Error('交通安排需要填写起点、终点和交通方式')
    }

    return createTransportItem({
      ...common,
      endDate: draft.endDate,
      mode: draft.mode,
      from,
      to,
    })
  }

  const activity = existing?.type === 'activity' ? existing : undefined
  const location = buildPlace(
    draft.locationName,
    draft.locationAddress,
    activity?.location,
  )

  return createActivityItem({
    ...common,
    location,
  })
}

function TripCard({
  trip,
  onOpen,
}: {
  trip: Trip
  onOpen: () => void
}) {
  return (
    <button className="trip-card" onClick={onOpen} type="button">
      <span className="trip-card-tape" />
      <span className="trip-card-topline">
        <span className="saved-label">
          <span className="saved-dot" />
          已保存
        </span>
        <span>{countTripDays(trip)} 天</span>
      </span>
      <span className="trip-card-title">{trip.title}</span>
      <span className="trip-card-destination">
        {trip.destination || '未填写目的地'}
      </span>
      <span className="trip-card-divider" />
      <span className="trip-card-meta">
        <span>{formatDateRange(trip)}</span>
        <span>{trip.items.length} 项安排</span>
      </span>
      <span className="trip-card-link">
        打开行程
        <ArrowIcon />
      </span>
    </button>
  )
}

function LibraryView({
  data,
  storageError,
  actionError,
  actionMessage,
  onCreate,
  onImport,
  onExportAll,
  onOpenTrip,
  onDismissStorageError,
  onDismissActionError,
  onDismissActionMessage,
}: {
  data: AppData
  storageError: string | null
  actionError: string | null
  actionMessage: string | null
  onCreate: () => void
  onImport: () => void
  onExportAll: () => void
  onOpenTrip: (tripId: string) => void
  onDismissStorageError: () => void
  onDismissActionError: () => void
  onDismissActionMessage: () => void
}) {
  const trips = sortTripsForDisplay(data.trips)

  return (
    <section className="workspace" aria-labelledby="library-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">YOUR TRIPS · 本机行程库</p>
          <h1 id="library-title">我的行程</h1>
          <p className="workspace-lead">
            先把日期和目的地定下来，下一步再逐项安排活动与交通。
          </p>
        </div>
        <div className="workspace-actions">
          <button className="outline-button" onClick={onImport} type="button">
            导入 JSON
          </button>
          {trips.length > 0 ? (
            <button
              className="outline-button"
              onClick={onExportAll}
              type="button"
            >
              导出全部
            </button>
          ) : null}
          <button className="primary-button" onClick={onCreate} type="button">
            <PlusIcon />
            新建行程
          </button>
        </div>
      </div>

      {storageError ? (
        <div className="notice notice-error" role="alert">
          <span>{storageError}</span>
          <button
            aria-label="关闭提示"
            onClick={onDismissStorageError}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="notice notice-error" role="alert">
          <span>{actionError}</span>
          <button
            aria-label="关闭提示"
            onClick={onDismissActionError}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {actionMessage ? (
        <div className="notice notice-success" role="status">
          <span>{actionMessage}</span>
          <button
            aria-label="关闭提示"
            onClick={onDismissActionMessage}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {trips.length === 0 ? (
        <div className="empty-library">
          <div className="empty-illustration" aria-hidden="true">
            <span className="empty-path" />
            <span className="empty-pin empty-pin-start" />
            <span className="empty-pin empty-pin-end" />
            <span className="empty-date">01</span>
          </div>
          <div>
            <p className="eyebrow">A NEW JOURNEY</p>
            <h2>还没有安排行程</h2>
            <p>
              创建第一趟旅行，填写日期与目的地。行程会自动保存在当前浏览器中。
            </p>
            <button className="text-action" onClick={onCreate} type="button">
              创建第一趟行程
              <ArrowIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              onOpen={() => onOpenTrip(trip.id)}
              trip={trip}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ScheduleRow({
  item,
  hasConflict,
  onEdit,
  onDelete,
}: {
  item: ScheduleItem
  hasConflict: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const isCrossDay =
    item.type === 'transport' && item.endDate !== item.date
  const detail =
    item.type === 'transport'
      ? `${TRAVEL_MODE_LABELS[item.mode]} · ${item.from.name} → ${item.to.name}`
      : item.location?.name || '未填写地点'

  return (
    <article
      className={`schedule-item${hasConflict ? ' has-conflict' : ''}`}
    >
      <div className="schedule-item-time">
        <strong>{item.startTime}</strong>
        <span>
          {item.type === 'transport' && isCrossDay
            ? `${formatScheduleEnd(item.endDate, item.date)} ${item.endTime}`
            : item.endTime}
        </span>
      </div>
      <div className="schedule-item-body">
        <div className="schedule-item-topline">
          <span
            className={`item-kind ${
              item.type === 'transport' ? 'item-kind-transport' : ''
            }`}
          >
            {item.type === 'transport' ? '交通' : '活动'}
          </span>
          {isCrossDay ? <span className="cross-day-label">跨日</span> : null}
          {hasConflict ? <span className="conflict-label">时间重叠</span> : null}
        </div>
        <h3>{item.title}</h3>
        <p>{detail}</p>
        {item.notes ? <p className="item-notes">{item.notes}</p> : null}
      </div>
      <div className="schedule-item-actions">
        <button onClick={onEdit} type="button">
          编辑
        </button>
        <button className="danger-text" onClick={onDelete} type="button">
          删除
        </button>
      </div>
    </article>
  )
}

function DetailView({
  trip,
  onBack,
  onEdit,
  onExport,
  onExportImage,
  onPrint,
  onDuplicate,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  actionError,
  actionMessage,
  isExporting,
  onDismissActionError,
  onDismissActionMessage,
}: {
  trip: Trip
  onBack: () => void
  onEdit: () => void
  onExport: () => void
  onExportImage: () => void
  onPrint: () => void
  onDuplicate: () => void
  onDelete: () => void
  onAddItem: () => void
  onEditItem: (item: ScheduleItem) => void
  onDeleteItem: (item: ScheduleItem) => void
  actionError: string | null
  actionMessage: string | null
  isExporting: boolean
  onDismissActionError: () => void
  onDismissActionMessage: () => void
}) {
  const dates = listTripDates(trip)
  const overlappingIds = findOverlappingScheduleItemIds(trip)

  return (
    <section className="trip-detail" aria-labelledby="trip-title">
      <button className="back-button" onClick={onBack} type="button">
        <span aria-hidden="true">←</span>
        返回全部行程
      </button>

      {actionError ? (
        <div className="notice notice-error" role="alert">
          <span>{actionError}</span>
          <button
            aria-label="关闭提示"
            onClick={onDismissActionError}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {actionMessage ? (
        <div className="notice notice-success" role="status">
          <span>{actionMessage}</span>
          <button
            aria-label="关闭提示"
            onClick={onDismissActionMessage}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      <header className="detail-hero">
        <div className="detail-title-block">
          <p className="eyebrow">TRIP OVERVIEW · {trip.destination || '目的地待定'}</p>
          <h1 id="trip-title">{trip.title}</h1>
          <p className="detail-dates">{formatDateRange(trip)}</p>
        </div>
        <div className="detail-actions">
          <button className="secondary-button" onClick={onEdit} type="button">
            编辑信息
          </button>
          <button
            className="icon-text-button"
            disabled={isExporting}
            onClick={onExportImage}
            type="button"
          >
            {isExporting ? '生成中…' : '导出图片'}
          </button>
          <button
            className="icon-text-button"
            onClick={onPrint}
            type="button"
          >
            打印 / PDF
          </button>
          <button
            className="icon-text-button"
            onClick={onExport}
            type="button"
          >
            导出 JSON
          </button>
          <button
            className="icon-text-button"
            onClick={onDuplicate}
            type="button"
          >
            复制
          </button>
          <button
            className="icon-text-button danger-text"
            onClick={onDelete}
            type="button"
          >
            删除
          </button>
        </div>
      </header>

      <div className="detail-summary">
        <div>
          <CalendarIcon />
          <span>
            <small>行程长度</small>
            {countTripDays(trip)} 天
          </span>
        </div>
        <div>
          <RouteIcon />
          <span>
            <small>默认交通</small>
            {TRAVEL_MODE_LABELS[trip.defaultTravelMode]}
          </span>
        </div>
        <div>
          <span className="summary-number">{trip.items.length}</span>
          <span>
            <small>已录入安排</small>
            时间表条目
          </span>
        </div>
      </div>

      <div className="detail-content">
        <article className="schedule-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TIMELINE</p>
              <h2>行程时间表</h2>
            </div>
            <button className="add-item-button" onClick={onAddItem} type="button">
              <PlusIcon />
              添加安排
            </button>
          </div>

          {overlappingIds.size > 0 ? (
            <div className="conflict-summary" role="status">
              <span className="conflict-mark">!</span>
              <div>
                <strong>
                  发现 {overlappingIds.size} 项时间重叠的安排
                </strong>
                <p>安排已保留，请检查起止时间是否需要调整。</p>
              </div>
            </div>
          ) : null}

          <div className="schedule-days">
            {dates.map((date, dateIndex) => {
              const items = sortScheduleItemsForDisplay(
                trip.items.filter((item) => item.date === date),
              )

              return (
                <section className="schedule-day" key={date}>
                  <header className="day-heading">
                    <div>
                      <span className="day-number">
                        DAY {String(dateIndex + 1).padStart(2, '0')}
                      </span>
                      <h3>{formatScheduleDate(date)}</h3>
                    </div>
                    <span className="day-count">{items.length} 项</span>
                  </header>
                  <div className="day-items">
                    {items.length === 0 ? (
                      <p className="empty-day">这一天还没有安排</p>
                    ) : (
                      items.map((item) => (
                        <ScheduleRow
                          hasConflict={overlappingIds.has(item.id)}
                          item={item}
                          key={item.id}
                          onDelete={() => onDeleteItem(item)}
                          onEdit={() => onEditItem(item)}
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </article>

        <aside className="trip-notes">
          <p className="eyebrow">TRIP NOTES</p>
          <h2>关于这趟旅行</h2>
          <dl>
            <div>
              <dt>目的地</dt>
              <dd>{trip.destination || '未填写'}</dd>
            </div>
            <div>
              <dt>时区</dt>
              <dd>{trip.timezone}</dd>
            </div>
            <div>
              <dt>数据位置</dt>
              <dd>仅当前浏览器</dd>
            </div>
          </dl>
          <p className="notes-hint">
            所有修改会立即自动保存。活动地点与交通起终点会保留在数据中，供后续地图功能使用。
          </p>
        </aside>
      </div>
    </section>
  )
}

function StorageUnavailable({ message }: { message: string }) {
  return (
    <main className="storage-screen">
      <p className="eyebrow">LOCAL DATA</p>
      <h1>无法读取本机数据</h1>
      <p>{message}</p>
      <p>为避免覆盖原有行程，当前不会自动清空或重建数据。</p>
    </main>
  )
}

function App() {
  const { data, storageError, commit, dismissStorageError } = useTripData()
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [scheduleEditor, setScheduleEditor] =
    useState<ScheduleEditorState>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const backupInputRef = useRef<HTMLInputElement>(null)
  const exportSheetRef = useRef<HTMLDivElement>(null)

  const selectedTrip = useMemo(
    () =>
      data && selectedTripId ? findTrip(data, selectedTripId) : undefined,
    [data, selectedTripId],
  )
  const editingTrip =
    data && editor && editor !== 'create'
      ? findTrip(data, editor.tripId)
      : undefined
  const editingScheduleItem =
    selectedTrip && scheduleEditor && scheduleEditor !== 'create'
      ? selectedTrip.items.find((item) => item.id === scheduleEditor.itemId)
      : undefined

  const handleCreate = (input: TripMetadataInput): SaveResult => {
    if (!data) {
      return { ok: false, message: '本机数据尚未准备好' }
    }

    try {
      const next = createTripInData(data, input)
      const created = next.trips[next.trips.length - 1]

      if (!commit(next)) {
        return { ok: false, message: '浏览器存储写入失败，请检查可用空间' }
      }

      setSelectedTripId(created.id)
      setEditor(null)
      setScheduleEditor(null)
      setActionError(null)
      setActionMessage(null)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: describeError(error) }
    }
  }

  const handleUpdate = (input: TripMetadataInput): SaveResult => {
    if (!data || !editingTrip) {
      return { ok: false, message: '找不到要编辑的行程' }
    }

    try {
      const next = updateTripMetadataInData(data, editingTrip.id, input)

      if (!commit(next)) {
        return { ok: false, message: '浏览器存储写入失败，请检查可用空间' }
      }

      setEditor(null)
      setScheduleEditor(null)
      setActionError(null)
      setActionMessage(null)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: describeError(error) }
    }
  }

  const handleDuplicate = () => {
    if (!data || !selectedTrip) {
      return
    }

    try {
      const result = duplicateTripInData(data, selectedTrip.id)

      if (!commit(result.data)) {
        setActionError('浏览器存储写入失败，未能复制行程')
        return
      }

      setSelectedTripId(result.trip.id)
      setScheduleEditor(null)
      setActionError(null)
      setActionMessage(null)
    } catch (error) {
      setActionError(describeError(error))
    }
  }

  const handleDelete = () => {
    if (!data || !selectedTrip) {
      return
    }

    const confirmed = window.confirm(
      `确认删除“${selectedTrip.title}”？删除后无法从本机恢复，但已导出的备份不受影响。`,
    )

    if (!confirmed) {
      return
    }

    try {
      const next = removeTripFromData(data, selectedTrip.id)

      if (!commit(next)) {
        setActionError('浏览器存储写入失败，未能删除行程')
        return
      }

      setSelectedTripId(null)
      setScheduleEditor(null)
      setActionError(null)
      setActionMessage(null)
    } catch (error) {
      setActionError(describeError(error))
    }
  }

  const handleAddSchedule = (draft: ScheduleItemDraft): SaveResult => {
    if (!data || !selectedTrip) {
      return { ok: false, message: '找不到要添加安排的行程' }
    }

    try {
      const item = buildScheduleItem(draft)
      const next = addScheduleItemInData(data, selectedTrip.id, item)

      if (!commit(next)) {
        return { ok: false, message: '浏览器存储写入失败，请检查可用空间' }
      }

      setScheduleEditor(null)
      setActionError(null)
      setActionMessage(null)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: describeError(error) }
    }
  }

  const handleUpdateSchedule = (draft: ScheduleItemDraft): SaveResult => {
    if (!data || !selectedTrip || !editingScheduleItem) {
      return { ok: false, message: '找不到要编辑的安排' }
    }

    try {
      const item = buildScheduleItem(draft, editingScheduleItem)
      const next = updateScheduleItemInData(data, selectedTrip.id, item)

      if (!commit(next)) {
        return { ok: false, message: '浏览器存储写入失败，请检查可用空间' }
      }

      setScheduleEditor(null)
      setActionError(null)
      setActionMessage(null)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: describeError(error) }
    }
  }

  const handleDeleteSchedule = (item: ScheduleItem) => {
    if (!data || !selectedTrip) {
      return
    }

    const confirmed = window.confirm(
      `确认删除安排“${item.title}”？删除后无法从本机恢复。`,
    )

    if (!confirmed) {
      return
    }

    try {
      const next = removeScheduleItemInData(
        data,
        selectedTrip.id,
        item.id,
      )

      if (!commit(next)) {
        setActionError('浏览器存储写入失败，未能删除安排')
        return
      }

      setActionError(null)
      setActionMessage(null)
    } catch (error) {
      setActionError(describeError(error))
    }
  }

  const handleExport = (trips: Trip[], label: string) => {
    if (trips.length === 0) {
      setActionError('没有可导出的行程')
      return
    }

    try {
      const bundle = createBackupBundle(trips)
      const exportedDate = new Date().toISOString().slice(0, 10)
      downloadBackup(
        bundle,
        `排图者-diagramer-${safeFilenamePart(label)}-${exportedDate}.json`,
      )
      setActionError(null)
      setActionMessage(`已生成 ${trips.length} 个行程的 JSON 备份`)
    } catch (error) {
      setActionMessage(null)
      setActionError(describeError(error))
    }
  }

  const handleExportImage = async () => {
    if (!selectedTrip || !exportSheetRef.current) {
      setActionError('找不到可导出的时间表')
      return
    }

    setIsExporting(true)
    setActionError(null)
    setActionMessage(null)

    try {
      await document.fonts.ready
      const blob = await toBlob(exportSheetRef.current, {
        backgroundColor: '#fbf8f0',
        cacheBust: true,
        pixelRatio: 2,
      })

      if (!blob) {
        throw new Error('图片生成结果为空')
      }

      const exportedDate = new Date().toISOString().slice(0, 10)
      downloadBlob(
        blob,
        `${safeFilenamePart(selectedTrip.title)}-行程表-${exportedDate}.png`,
      )
      setActionMessage('已生成整趟行程的 PNG 图片')
    } catch {
      setActionError('生成图片失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    setActionError(null)
    setActionMessage(null)
    window.print()
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''

    if (!file) {
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setActionMessage(null)
      setActionError('备份文件不能超过 10 MB')
      return
    }

    if (!data) {
      setActionMessage(null)
      setActionError('本机数据尚未准备好')
      return
    }

    try {
      const result = importBackupText(await file.text(), data)

      if (!result.ok) {
        setActionMessage(null)
        setActionError(result.message)
        return
      }

      if (!commit(result.data)) {
        setActionMessage(null)
        setActionError('浏览器存储写入失败，未能导入备份')
        return
      }

      setActionError(null)
      setActionMessage(
        `已导入 ${result.importedTrips.length} 个行程副本，原行程未被覆盖`,
      )
      setSelectedTripId(null)
    } catch {
      setActionMessage(null)
      setActionError('读取备份文件失败')
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          aria-label="返回行程列表"
          className="brand"
          onClick={() => {
            setSelectedTripId(null)
            setScheduleEditor(null)
          }}
          type="button"
        >
          <span className="brand-mark">
            <PinIcon />
          </span>
          <span>排图者</span>
          <span className="brand-english">diagramer</span>
        </button>
        <span className="local-badge">仅保存在本机</span>
      </header>

      <input
        accept=".json,application/json"
        className="backup-file-input"
        onChange={handleImportFile}
        ref={backupInputRef}
        type="file"
      />

      {!data ? (
        <StorageUnavailable message={storageError ?? '本机存储格式异常'} />
      ) : selectedTrip ? (
        <DetailView
          actionError={actionError}
          actionMessage={actionMessage}
          onAddItem={() => {
            setActionError(null)
            setEditor(null)
            setScheduleEditor('create')
          }}
          onBack={() => {
            setSelectedTripId(null)
            setScheduleEditor(null)
          }}
          onDelete={handleDelete}
          onDeleteItem={handleDeleteSchedule}
          onDismissActionError={() => setActionError(null)}
          onDismissActionMessage={() => setActionMessage(null)}
          onDuplicate={handleDuplicate}
          onEdit={() => {
            setScheduleEditor(null)
            setEditor({ tripId: selectedTrip.id })
          }}
          onEditItem={(item) => {
            setActionError(null)
            setEditor(null)
            setScheduleEditor({ itemId: item.id })
          }}
          onExport={() => handleExport([selectedTrip], selectedTrip.title)}
          onExportImage={handleExportImage}
          onPrint={handlePrint}
          isExporting={isExporting}
          trip={selectedTrip}
        />
      ) : (
        <LibraryView
          actionError={actionError}
          actionMessage={actionMessage}
          data={data}
          onDismissActionError={() => setActionError(null)}
          onDismissActionMessage={() => setActionMessage(null)}
          onDismissStorageError={dismissStorageError}
          onExportAll={() => handleExport(data.trips, '全部')}
          onImport={() => backupInputRef.current?.click()}
          onCreate={() => {
            setActionError(null)
            setActionMessage(null)
            setScheduleEditor(null)
            setEditor('create')
          }}
          onOpenTrip={(tripId) => {
            setActionError(null)
            setActionMessage(null)
            setScheduleEditor(null)
            setSelectedTripId(tripId)
          }}
          storageError={storageError}
        />
      )}

      {selectedTrip ? (
        <div
          aria-hidden="true"
          className="export-sheet-stage"
        >
          <div className="export-sheet-capture" ref={exportSheetRef}>
            <TimelineExportSheet trip={selectedTrip} />
          </div>
        </div>
      ) : null}

      {data ? (
        <footer>
          <span>排图者 diagramer · V1 时间表</span>
          <span data-testid="storage-status">
            已保存 {data.trips.length} 个行程
          </span>
        </footer>
      ) : null}

      {editor ? (
        <TripForm
          initialTrip={editor === 'create' ? undefined : editingTrip}
          key={editor === 'create' ? 'create' : editor.tripId}
          onCancel={() => setEditor(null)}
          onSubmit={editor === 'create' ? handleCreate : handleUpdate}
        />
      ) : null}

      {selectedTrip && scheduleEditor ? (
        <ScheduleItemForm
          initialItem={
            scheduleEditor === 'create' ? undefined : editingScheduleItem
          }
          key={
            scheduleEditor === 'create' ? 'create' : scheduleEditor.itemId
          }
          onCancel={() => setScheduleEditor(null)}
          onSubmit={
            scheduleEditor === 'create'
              ? handleAddSchedule
              : handleUpdateSchedule
          }
          trip={selectedTrip}
        />
      ) : null}
    </div>
  )
}

export default App
