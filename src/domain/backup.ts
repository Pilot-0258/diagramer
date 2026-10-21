import { z } from 'zod'
import {
  APP_DATA_SCHEMA_VERSION,
  AppDataSchema,
  TripSchema,
  type ActivityItem,
  type AppData,
  type PlaceRef,
  type ScheduleItem,
  type TransportItem,
  type Trip,
} from './trip'

export const BackupBundleSchema = z.object({
  schemaVersion: z.literal(APP_DATA_SCHEMA_VERSION),
  exportedAt: z.string().trim().min(1),
  trips: z.array(TripSchema).min(1, '备份中没有行程'),
})

export type BackupBundle = z.infer<typeof BackupBundleSchema>

export type BackupImportResult =
  | {
      ok: true
      data: AppData
      importedTrips: Trip[]
    }
  | {
      ok: false
      message: string
    }

export function createBackupBundle(
  trips: Trip[],
  exportedAt = new Date().toISOString(),
): BackupBundle {
  return BackupBundleSchema.parse({
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    exportedAt,
    trips,
  })
}

function remapPlace(place: PlaceRef): PlaceRef {
  return {
    ...place,
    id: crypto.randomUUID(),
  }
}

function remapScheduleItem(item: ScheduleItem): ScheduleItem {
  if (item.type === 'transport') {
    const transport: TransportItem = {
      ...item,
      id: crypto.randomUUID(),
      from: remapPlace(item.from),
      to: remapPlace(item.to),
    }
    return transport
  }

  const activity: ActivityItem = {
    ...item,
    id: crypto.randomUUID(),
    location: item.location ? remapPlace(item.location) : undefined,
  }
  return activity
}

function remapTrip(trip: Trip): Trip {
  return TripSchema.parse({
    ...trip,
    id: crypto.randomUUID(),
    title: `${trip.title}（导入）`,
    items: trip.items.map(remapScheduleItem),
    updatedAt: new Date().toISOString(),
  })
}

function describeBackupValidation(error: z.ZodError) {
  const firstIssue = error.issues[0]

  if (!firstIssue) {
    return '备份数据格式不正确'
  }

  const path =
    firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : ''
  return `备份数据格式不正确：${path}${firstIssue.message}`
}

export function importBackupText(
  rawText: string,
  currentData: AppData,
): BackupImportResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText.replace(/^\uFEFF/, ''))
  } catch {
    return {
      ok: false,
      message: '所选文件不是有效的 JSON',
    }
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'schemaVersion' in parsed &&
    parsed.schemaVersion !== APP_DATA_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      message: `不支持备份数据版本 ${String(parsed.schemaVersion)}，当前支持版本 ${APP_DATA_SCHEMA_VERSION}`,
    }
  }

  const bundle = BackupBundleSchema.safeParse(parsed)

  if (!bundle.success) {
    return {
      ok: false,
      message: describeBackupValidation(bundle.error),
    }
  }

  try {
    const importedTrips = bundle.data.trips.map(remapTrip)
    const data = AppDataSchema.parse({
      ...currentData,
      trips: [...currentData.trips, ...importedTrips],
    })

    return {
      ok: true,
      data,
      importedTrips,
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? describeBackupValidation(error)
          : '无法导入备份数据',
    }
  }
}
