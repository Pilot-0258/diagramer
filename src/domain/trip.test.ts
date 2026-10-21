import { describe, expect, it } from 'vitest'
import {
  AppDataSchema,
  TripSchema,
  createActivityItem,
  createTransportItem,
  createTrip,
} from './trip'

describe('行程数据校验', () => {
  it('使用中国时区与公共交通作为默认值', () => {
    const trip = createTrip({
      title: '杭州两日',
      destination: '杭州',
      startDate: '2026-10-24',
      endDate: '2026-10-25',
    })

    expect(trip.timezone).toBe('Asia/Shanghai')
    expect(trip.defaultTravelMode).toBe('transit')
    expect(TripSchema.safeParse(trip).success).toBe(true)
  })

  it('拒绝早于开始日期的结束日期', () => {
    expect(() =>
      createTrip({
        title: '错误日期',
        startDate: '2026-10-25',
        endDate: '2026-10-24',
      }),
    ).toThrow()
  })

  it('拒绝不存在的日历日期', () => {
    expect(() =>
      createTrip({
        title: '错误日期',
        startDate: '2026-02-30',
        endDate: '2026-03-01',
      }),
    ).toThrow()
  })

  it('拒绝零时长或跨午夜的安排', () => {
    expect(() =>
      createActivityItem({
        title: '错误时间',
        date: '2026-10-24',
        startTime: '10:00',
        endTime: '10:00',
      }),
    ).toThrow()

    expect(() =>
      createActivityItem({
        title: '跨午夜',
        date: '2026-10-24',
        startTime: '23:30',
        endTime: '00:30',
      }),
    ).toThrow()
  })

  it('支持活动和交通两种安排', () => {
    const trip = createTrip({
      title: '西湖一日',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      defaultTravelMode: 'walk',
    })
    const activity = createActivityItem({
      title: '游览西湖',
      date: '2026-10-24',
      startTime: '09:00',
      endTime: '11:00',
      location: {
        id: crypto.randomUUID(),
        name: '西湖',
        city: '杭州',
      },
    })
    const transport = createTransportItem({
      title: '步行到午餐',
      date: '2026-10-24',
      endDate: '2026-10-24',
      startTime: '11:00',
      endTime: '11:20',
      mode: 'walk',
      from: {
        id: crypto.randomUUID(),
        name: '西湖',
      },
      to: {
        id: crypto.randomUUID(),
        name: '知味观',
      },
    })
    const completeTrip = {
      ...trip,
      items: [activity, transport],
    }

    expect(TripSchema.safeParse(completeTrip).success).toBe(true)
  })

  it('允许交通跨日并校验结束日期', () => {
    const trip = createTrip({
      title: '跨日交通',
      startDate: '2026-10-24',
      endDate: '2026-10-25',
    })
    const transport = createTransportItem({
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

    expect(
      TripSchema.safeParse({
        ...trip,
        items: [transport],
      }).success,
    ).toBe(true)
  })

  it('拒绝结束日期早于开始日期的交通', () => {
    expect(() =>
      createTransportItem({
        title: '错误交通',
        date: '2026-10-25',
        endDate: '2026-10-24',
        startTime: '12:00',
        endTime: '13:00',
        mode: 'drive',
        from: {
          id: crypto.randomUUID(),
          name: '甲地',
        },
        to: {
          id: crypto.randomUUID(),
          name: '乙地',
        },
      }),
    ).toThrow()
  })

  it('拒绝落在行程日期范围外的安排', () => {
    const trip = createTrip({
      title: '日期范围',
      startDate: '2026-10-24',
      endDate: '2026-10-25',
    })
    const activity = createActivityItem({
      title: '错误日期',
      date: '2026-10-26',
      startTime: '09:00',
      endTime: '10:00',
    })

    const result = TripSchema.safeParse({
      ...trip,
      items: [activity],
    })

    expect(result.success).toBe(false)
  })

  it('拒绝重复的行程 ID', () => {
    const trip = createTrip({
      title: '重复行程',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    })
    const result = AppDataSchema.safeParse({
      schemaVersion: 2,
      trips: [trip, trip],
    })

    expect(result.success).toBe(false)
  })
})
