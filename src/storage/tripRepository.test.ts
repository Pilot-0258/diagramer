import { describe, expect, it } from 'vitest'
import {
  APP_DATA_SCHEMA_VERSION,
  createEmptyAppData,
  createTransportItem,
  createTrip,
} from '../domain/trip'
import {
  APP_DATA_STORAGE_KEY,
  TripRepository,
  type StorageLike,
} from './tripRepository'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()
  failReads = false
  failWrites = false

  getItem(key: string) {
    if (this.failReads) {
      throw new Error('storage blocked')
    }

    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.failWrites) {
      throw new Error('quota exceeded')
    }

    this.values.set(key, value)
  }
}

describe('本地行程存储', () => {
  it('在没有数据时返回空行程库', () => {
    const repository = new TripRepository(new MemoryStorage())
    const result = repository.load()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(createEmptyAppData())
    }
  })

  it('可以保存并重新读取行程', () => {
    const storage = new MemoryStorage()
    const repository = new TripRepository(storage)
    const trip = createTrip({
      title: '苏州周末',
      destination: '苏州',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })
    const data = {
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      trips: [trip],
    }

    const saved = repository.save(data)
    const loaded = repository.load()

    expect(saved.ok).toBe(true)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value).toEqual(data)
    }
  })

  it('明确拒绝损坏的 JSON', () => {
    const storage = new MemoryStorage()
    storage.setItem(APP_DATA_STORAGE_KEY, '{not-json')
    const result = new TripRepository(storage).load()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-json')
    }
  })

  it('拒绝来自更高数据版本的内容', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      APP_DATA_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, trips: [] }),
    )
    const result = new TripRepository(storage).load()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported-version')
    }
  })

  it('在没有迁移规则时拒绝旧数据版本', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      APP_DATA_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 0, trips: [] }),
    )
    const result = new TripRepository(storage).load()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported-version')
    }
  })

  it('拒绝不符合数据约定的内容', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      APP_DATA_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: APP_DATA_SCHEMA_VERSION,
        trips: 'not-an-array',
      }),
    )
    const result = new TripRepository(storage).load()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-data')
    }
  })

  it('将版本 1 数据迁移为带交通结束日期的版本 2', () => {
    const storage = new MemoryStorage()
    const trip = createTrip({
      title: '旧版行程',
      startDate: '2026-10-24',
      endDate: '2026-10-25',
    })
    const transport = createTransportItem({
      title: '夜间列车',
      date: '2026-10-24',
      endDate: '2026-10-25',
      startTime: '23:00',
      endTime: '23:30',
      mode: 'transit',
      from: {
        id: crypto.randomUUID(),
        name: '杭州',
      },
      to: {
        id: crypto.randomUUID(),
        name: '南京',
      },
    })
    storage.setItem(
      APP_DATA_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        trips: [
          {
            ...trip,
            items: [{ ...transport, endDate: undefined }],
          },
        ],
      }),
    )

    const result = new TripRepository(storage).load()

    expect(result.ok).toBe(true)
    if (result.ok) {
      const migratedTransport = result.value.trips[0].items[0]
      expect(result.value.schemaVersion).toBe(2)
      expect(migratedTransport.type).toBe('transport')
      if (migratedTransport.type === 'transport') {
        expect(migratedTransport.endDate).toBe('2026-10-24')
      }
    }

    const persisted = JSON.parse(storage.getItem(APP_DATA_STORAGE_KEY) ?? '{}')
    expect(persisted.schemaVersion).toBe(2)
  })

  it('在浏览器拒绝读取或写入时返回可处理错误', () => {
    const readFailureStorage = new MemoryStorage()
    readFailureStorage.failReads = true
    const readResult = new TripRepository(readFailureStorage).load()

    expect(readResult.ok).toBe(false)
    if (!readResult.ok) {
      expect(readResult.error.code).toBe('unavailable')
    }

    const writeFailureStorage = new MemoryStorage()
    writeFailureStorage.failWrites = true
    const writeResult = new TripRepository(writeFailureStorage).save(
      createEmptyAppData(),
    )

    expect(writeResult.ok).toBe(false)
    if (!writeResult.ok) {
      expect(writeResult.error.code).toBe('write-failed')
    }
  })
})
