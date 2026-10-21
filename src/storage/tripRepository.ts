import { z } from 'zod'
import {
  APP_DATA_SCHEMA_VERSION,
  AppDataSchema,
  createEmptyAppData,
  type AppData,
} from '../domain/trip'

export const APP_DATA_STORAGE_KEY = 'travel-itinerary:app-data'

export type StorageErrorCode =
  | 'unavailable'
  | 'invalid-json'
  | 'unsupported-version'
  | 'invalid-data'
  | 'write-failed'

export type StorageError = {
  code: StorageErrorCode
  message: string
}

export type StorageResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: StorageError
    }

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const VersionProbeSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateV1ToV2(input: unknown) {
  if (!isRecord(input) || !Array.isArray(input.trips)) {
    return input
  }

  return {
    ...input,
    schemaVersion: 2,
    trips: input.trips.map((trip) => {
      if (!isRecord(trip) || !Array.isArray(trip.items)) {
        return trip
      }

      return {
        ...trip,
        items: trip.items.map((item) => {
          if (
            isRecord(item) &&
            item.type === 'transport' &&
            typeof item.date === 'string'
          ) {
            return {
              ...item,
              endDate: item.date,
            }
          }

          return item
        }),
      }
    }),
  }
}

const migrations: Readonly<
  Partial<Record<number, (input: unknown) => unknown>>
> = {
  1: migrateV1ToV2,
}

function fail(
  code: StorageErrorCode,
  message: string,
): { ok: false; error: StorageError } {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

function formatValidationIssues(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('；')
}

function migrateAppData(raw: unknown): StorageResult<unknown> {
  const probe = VersionProbeSchema.safeParse(raw)

  if (!probe.success) {
    return fail('invalid-data', '本地数据缺少有效的 schemaVersion')
  }

  let current: unknown = raw
  let version = probe.data.schemaVersion

  while (version < APP_DATA_SCHEMA_VERSION) {
    const migrate = migrations[version]

    if (!migrate) {
      return fail(
        'unsupported-version',
        `暂不支持从数据版本 ${version} 升级`,
      )
    }

    current = migrate(current)
    const nextProbe = VersionProbeSchema.safeParse(current)

    if (!nextProbe.success) {
      return fail('invalid-data', '数据迁移后缺少有效的 schemaVersion')
    }

    const nextVersion = nextProbe.data.schemaVersion

    if (nextVersion <= version) {
      return fail('invalid-data', '数据迁移没有推进 schemaVersion')
    }

    version = nextVersion
  }

  if (version > APP_DATA_SCHEMA_VERSION) {
    return fail(
      'unsupported-version',
      `数据版本 ${version} 高于当前支持的版本 ${APP_DATA_SCHEMA_VERSION}`,
    )
  }

  return {
    ok: true,
    value: current,
  }
}

export class TripRepository {
  constructor(
    private readonly storage: StorageLike,
    private readonly storageKey = APP_DATA_STORAGE_KEY,
  ) {}

  load(): StorageResult<AppData> {
    let raw: string | null

    try {
      raw = this.storage.getItem(this.storageKey)
    } catch {
      return fail('unavailable', '浏览器拒绝访问本地存储')
    }

    if (raw === null) {
      return {
        ok: true,
        value: createEmptyAppData(),
      }
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch {
      return fail('invalid-json', '本地存储中的内容不是有效 JSON')
    }

    const migrated = migrateAppData(parsed)

    if (!migrated.ok) {
      return migrated
    }

    const validated = AppDataSchema.safeParse(migrated.value)

    if (!validated.success) {
      return fail(
        'invalid-data',
        `本地数据格式不正确：${formatValidationIssues(validated.error)}`,
      )
    }

    if (
      isRecord(parsed) &&
      parsed.schemaVersion !== APP_DATA_SCHEMA_VERSION
    ) {
      try {
        this.storage.setItem(
          this.storageKey,
          JSON.stringify(validated.data),
        )
      } catch {
        // The migrated data can still be used for this session.
      }
    }

    return {
      ok: true,
      value: validated.data,
    }
  }

  save(data: AppData): StorageResult<AppData> {
    const validated = AppDataSchema.safeParse(data)

    if (!validated.success) {
      return fail(
        'invalid-data',
        `无法保存格式不正确的数据：${formatValidationIssues(validated.error)}`,
      )
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(validated.data))
    } catch {
      return fail(
        'write-failed',
        '无法写入浏览器存储，请先导出备份并检查可用空间',
      )
    }

    return {
      ok: true,
      value: validated.data,
    }
  }
}
