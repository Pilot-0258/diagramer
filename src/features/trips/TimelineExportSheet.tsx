import {
  TRAVEL_MODE_LABELS,
  type ScheduleItem,
  type Trip,
} from '../../domain/trip'
import {
  findOverlappingScheduleItemIds,
  listTripDates,
  sortScheduleItemsForDisplay,
} from '../../domain/tripCollection'

function formatFullDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${parsed.getUTCFullYear()} 年 ${parsed.getUTCMonth() + 1} 月 ${parsed.getUTCDate()} 日 · ${weekdays[parsed.getUTCDay()]}`
}

function formatDateRange(trip: Trip) {
  return trip.startDate === trip.endDate
    ? formatFullDate(trip.startDate)
    : `${formatFullDate(trip.startDate)} — ${formatFullDate(trip.endDate)}`
}

function formatEndDate(endDate: string, startDate: string) {
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

function itemDetail(item: ScheduleItem) {
  if (item.type === 'transport') {
    return `${TRAVEL_MODE_LABELS[item.mode]} · ${item.from.name} → ${item.to.name}`
  }

  return item.location?.name || '未填写地点'
}

export function TimelineExportSheet({ trip }: { trip: Trip }) {
  const dates = listTripDates(trip)
  const overlappingIds = findOverlappingScheduleItemIds(trip)

  return (
    <article className="export-sheet">
      <header className="export-sheet-header">
        <div className="export-brand">
          <span className="export-brand-mark">行</span>
          <span>排图者 diagramer · ITINERARY</span>
        </div>
        <p className="export-destination">
          {trip.destination || '目的地待定'}
        </p>
        <h1>{trip.title}</h1>
        <p className="export-date-range">{formatDateRange(trip)}</p>
        <div className="export-summary-line">
          <span>{dates.length} 天行程</span>
          <span>{trip.items.length} 项安排</span>
          <span>默认交通：{TRAVEL_MODE_LABELS[trip.defaultTravelMode]}</span>
        </div>
      </header>

      <div className="export-days">
        {dates.map((date, dayIndex) => {
          const items = sortScheduleItemsForDisplay(
            trip.items.filter((item) => item.date === date),
          )

          return (
            <section className="export-day" key={date}>
              <header className="export-day-heading">
                <span className="export-day-number">
                  DAY {String(dayIndex + 1).padStart(2, '0')}
                </span>
                <h2>{formatFullDate(date)}</h2>
                <span>{items.length} 项安排</span>
              </header>

              {items.length === 0 ? (
                <p className="export-empty-day">这一天暂时没有安排</p>
              ) : (
                <div className="export-items">
                  {items.map((item) => {
                    const isCrossDay =
                      item.type === 'transport' && item.endDate !== item.date
                    const hasConflict = overlappingIds.has(item.id)

                    return (
                      <div className="export-item" key={item.id}>
                        <div className="export-item-time">
                          <strong>{item.startTime}</strong>
                          <span>
                            {isCrossDay && item.type === 'transport'
                              ? `${formatEndDate(item.endDate, item.date)} ${item.endTime}`
                              : item.endTime}
                          </span>
                        </div>
                        <div className="export-item-content">
                          <div className="export-item-tags">
                            <span>
                              {item.type === 'transport' ? '交通' : '活动'}
                            </span>
                            {isCrossDay ? <span>跨日</span> : null}
                            {hasConflict ? (
                              <span className="export-conflict">时间重叠</span>
                            ) : null}
                          </div>
                          <h3>{item.title}</h3>
                          <p>{itemDetail(item)}</p>
                          {item.notes ? (
                            <p className="export-item-notes">{item.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <footer className="export-footer">
        <span>排图者 diagramer · 本地旅行时间表</span>
        <span>时区 {trip.timezone}</span>
      </footer>
    </article>
  )
}
