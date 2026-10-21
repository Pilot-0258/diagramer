import { describe, expect, it } from 'vitest'
import { createActivityItem, createEmptyAppData, createTrip } from './trip'
import {
  addTripToData,
  createTripInData,
  duplicateTripInData,
  findTrip,
  removeTripFromData,
  sortTripsForDisplay,
  updateTripMetadataInData,
} from './tripCollection'

const metadata = {
  title: '杭州两日',
  destination: '杭州',
  startDate: '2026-10-24',
  endDate: '2026-10-25',
  defaultTravelMode: 'transit' as const,
}

describe('行程库操作', () => {
  it('创建并查找行程', () => {
    const data = createTripInData(createEmptyAppData(), metadata)
    const created = data.trips[0]

    expect(created.title).toBe('杭州两日')
    expect(findTrip(data, created.id)).toEqual(created)
  })

  it('修改行程元数据且保留原 ID', () => {
    const initial = createTripInData(createEmptyAppData(), metadata)
    const tripId = initial.trips[0].id
    const updated = updateTripMetadataInData(initial, tripId, {
      ...metadata,
      title: '杭州周末',
      endDate: '2026-10-26',
    })

    expect(updated.trips[0].id).toBe(tripId)
    expect(updated.trips[0].title).toBe('杭州周末')
    expect(updated.trips[0].endDate).toBe('2026-10-26')
  })

  it('删除指定行程并保留其他行程', () => {
    const first = createTrip({
      ...metadata,
      title: '第一趟',
    })
    const second = createTrip({
      ...metadata,
      title: '第二趟',
    })
    const data = addTripToData(addTripToData(createEmptyAppData(), first), second)
    const result = removeTripFromData(data, first.id)

    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].id).toBe(second.id)
  })

  it('复制行程时生成新的行程和安排 ID', () => {
    const source = createTrip(metadata)
    const activity = createActivityItem({
      title: '游湖',
      date: '2026-10-24',
      startTime: '09:00',
      endTime: '10:30',
      location: {
        id: crypto.randomUUID(),
        name: '西湖',
      },
    })
    const data = addTripToData(createEmptyAppData(), {
      ...source,
      items: [activity],
    })
    const result = duplicateTripInData(data, source.id)

    expect(result.trip.id).not.toBe(source.id)
    expect(result.trip.title).toBe('杭州两日（副本）')
    expect(result.trip.items[0].id).not.toBe(activity.id)
  })

  it('按开始日期排列待展示行程', () => {
    const later = createTrip({
      ...metadata,
      title: '较晚',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
    })
    const earlier = createTrip({
      ...metadata,
      title: '较早',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })

    expect(sortTripsForDisplay([later, earlier]).map((trip) => trip.title)).toEqual(
      ['较早', '较晚'],
    )
  })
})
