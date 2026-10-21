import { describe, expect, it } from 'vitest'
import {
  createActivityItem,
  createEmptyAppData,
  createTransportItem,
  createTrip,
} from './trip'
import {
  addTripToData,
  addScheduleItemInData,
  createTripInData,
  duplicateTripInData,
  findTrip,
  findOverlappingScheduleItemIds,
  listTripDates,
  removeScheduleItemInData,
  removeTripFromData,
  sortTripsForDisplay,
  updateTripMetadataInData,
  updateScheduleItemInData,
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

  it('添加、修改和删除行程安排', () => {
    const initial = createTripInData(createEmptyAppData(), metadata)
    const tripId = initial.trips[0].id
    const activity = createActivityItem({
      title: '游湖',
      date: '2026-10-24',
      startTime: '09:00',
      endTime: '10:30',
    })
    const added = addScheduleItemInData(initial, tripId, activity)
    const updated = updateScheduleItemInData(added, tripId, {
      ...activity,
      title: '慢游西湖',
    })
    const removed = removeScheduleItemInData(updated, tripId, activity.id)

    expect(added.trips[0].items).toHaveLength(1)
    expect(updated.trips[0].items[0].title).toBe('慢游西湖')
    expect(removed.trips[0].items).toHaveLength(0)
  })

  it('标记所有时间重叠的安排，但不把首尾相接算作冲突', () => {
    const trip = createTrip(metadata)
    const first = createActivityItem({
      id: 'first',
      title: '第一项',
      date: '2026-10-24',
      startTime: '09:00',
      endTime: '10:00',
    })
    const second = createActivityItem({
      id: 'second',
      title: '重叠项',
      date: '2026-10-24',
      startTime: '09:30',
      endTime: '10:30',
    })
    const adjacent = createActivityItem({
      id: 'adjacent',
      title: '紧接项',
      date: '2026-10-24',
      startTime: '10:30',
      endTime: '11:30',
    })
    const overlapping = findOverlappingScheduleItemIds({
      ...trip,
      items: [first, second, adjacent],
    })

    expect(overlapping).toEqual(new Set(['first', 'second']))
  })

  it('跨日交通可以和第二天的安排产生冲突', () => {
    const trip = createTrip({
      ...metadata,
      startDate: '2026-10-24',
      endDate: '2026-10-25',
    })
    const overnightTransport = createTransportItem({
      id: 'overnight',
      title: '夜间列车',
      date: '2026-10-24',
      endDate: '2026-10-25',
      startTime: '23:00',
      endTime: '06:30',
      mode: 'transit',
      from: {
        id: crypto.randomUUID(),
        name: '杭州东站',
      },
      to: {
        id: crypto.randomUUID(),
        name: '南京南站',
      },
    })
    const earlyActivity = createActivityItem({
      id: 'early',
      title: '过早安排',
      date: '2026-10-25',
      startTime: '05:30',
      endTime: '07:00',
    })
    const overlapping = findOverlappingScheduleItemIds({
      ...trip,
      items: [overnightTransport, earlyActivity],
    })

    expect(overlapping).toEqual(new Set(['overnight', 'early']))
  })

  it('列出多日行程中的每一天', () => {
    const trip = createTrip({
      ...metadata,
      startDate: '2026-10-24',
      endDate: '2026-10-26',
    })

    expect(listTripDates(trip)).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ])
  })
})
