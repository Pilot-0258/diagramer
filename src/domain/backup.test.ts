import { describe, expect, it } from 'vitest'
import { createEmptyAppData, createTransportItem, createTrip } from './trip'
import {
  createBackupBundle,
  importBackupText,
} from './backup'
import { addTripToData } from './tripCollection'

function createSampleData() {
  const trip = createTrip({
    title: '杭州两日',
    destination: '杭州',
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

  return {
    ...trip,
    items: [transport],
  }
}

describe('JSON 备份', () => {
  it('创建带版本和导出时间的备份包', () => {
    const trip = createSampleData()
    const bundle = createBackupBundle([trip], '2026-10-21T10:00:00.000Z')

    expect(bundle.schemaVersion).toBe(2)
    expect(bundle.exportedAt).toBe('2026-10-21T10:00:00.000Z')
    expect(bundle.trips).toHaveLength(1)
  })

  it('导入时作为新副本追加，并重映射所有 ID', () => {
    const source = createSampleData()
    const currentTrip = createTrip({
      title: '原有行程',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })
    const currentData = addTripToData(createEmptyAppData(), currentTrip)
    const bundle = createBackupBundle([source], '2026-10-21T10:00:00.000Z')
    const result = importBackupText(JSON.stringify(bundle), currentData)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.trips).toHaveLength(2)
      expect(result.data.trips[0].id).toBe(currentTrip.id)

      const imported = result.data.trips[1]
      expect(imported.id).not.toBe(source.id)
      expect(imported.title).toBe('杭州两日（导入）')
      expect(imported.items[0].id).not.toBe(source.items[0].id)

      const sourceTransport = source.items[0]
      const importedTransport = imported.items[0]
      expect(sourceTransport.type).toBe('transport')
      expect(importedTransport.type).toBe('transport')
      if (
        sourceTransport.type === 'transport' &&
        importedTransport.type === 'transport'
      ) {
        expect(importedTransport.from.id).not.toBe(sourceTransport.from.id)
        expect(importedTransport.to.id).not.toBe(sourceTransport.to.id)
      }
    }
  })

  it('拒绝损坏的 JSON', () => {
    const result = importBackupText('{not-json', createEmptyAppData())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('不是有效的 JSON')
    }
  })

  it('拒绝不支持的数据版本', () => {
    const trip = createSampleData()
    const result = importBackupText(
      JSON.stringify({
        schemaVersion: 99,
        exportedAt: '2026-10-21T10:00:00.000Z',
        trips: [trip],
      }),
      createEmptyAppData(),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('不支持备份数据版本 99')
    }
  })

  it('拒绝空的或结构不完整的备份', () => {
    const result = importBackupText(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '2026-10-21T10:00:00.000Z',
        trips: [],
      }),
      createEmptyAppData(),
    )

    expect(result.ok).toBe(false)
  })
})
