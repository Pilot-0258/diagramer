import { z } from 'zod'

export const APP_DATA_SCHEMA_VERSION = 1 as const

export const TRAVEL_MODES = ['walk', 'drive', 'transit', 'riding'] as const
export const TRAVEL_MODE_LABELS = {
  walk: '步行',
  drive: '驾车',
  transit: '公共交通',
  riding: '骑行',
} satisfies Record<(typeof TRAVEL_MODES)[number], string>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function isValidCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

const idSchema = z.string().trim().min(1, 'ID 不能为空')
const dateSchema = z
  .string()
  .refine(isValidCalendarDate, '日期必须是有效的 YYYY-MM-DD')
const timeSchema = z
  .string()
  .regex(TIME_PATTERN, '时间必须是 00:00 到 23:59 之间的 HH:mm')
const optionalTextSchema = (max: number) =>
  z.string().trim().max(max, `内容不能超过 ${max} 个字符`).optional()

export const CoordinatesSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  crs: z.enum(['gcj02', 'wgs84']),
})

export const PlaceRefSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, '地点名称不能为空').max(120),
  address: optionalTextSchema(240),
  city: optionalTextSchema(80),
  provider: optionalTextSchema(40),
  providerPlaceId: optionalTextSchema(160),
  coordinate: CoordinatesSchema.optional(),
})

export const TravelModeSchema = z.enum(TRAVEL_MODES)

const scheduleBaseShape = {
  id: idSchema,
  title: z.string().trim().min(1, '安排标题不能为空').max(120),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  notes: optionalTextSchema(2000),
}

function validateTimeRange(
  value: { startTime: string; endTime: string },
  context: z.RefinementCtx,
) {
  if (value.endTime <= value.startTime) {
    context.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: '结束时间必须晚于开始时间，暂不支持跨午夜事件',
    })
  }
}

export const ActivityItemSchema = z
  .object({
    ...scheduleBaseShape,
    type: z.literal('activity'),
    location: PlaceRefSchema.optional(),
  })
  .superRefine(validateTimeRange)

export const TransportItemSchema = z
  .object({
    ...scheduleBaseShape,
    type: z.literal('transport'),
    mode: TravelModeSchema,
    from: PlaceRefSchema,
    to: PlaceRefSchema,
  })
  .superRefine(validateTimeRange)

export const ScheduleItemSchema = z.discriminatedUnion('type', [
  ActivityItemSchema,
  TransportItemSchema,
])

export const TripSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1, '行程标题不能为空').max(120),
    destination: optionalTextSchema(120),
    startDate: dateSchema,
    endDate: dateSchema,
    timezone: z.string().trim().min(1, '时区不能为空').max(80),
    defaultTravelMode: TravelModeSchema,
    items: z.array(ScheduleItemSchema),
    createdAt: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1),
  })
  .superRefine((trip, context) => {
    if (trip.endDate < trip.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '结束日期不能早于开始日期',
      })
    }

    const itemIds = new Set<string>()

    trip.items.forEach((item, index) => {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: '同一行程内的安排 ID 不能重复',
        })
      }
      itemIds.add(item.id)

      if (item.date < trip.startDate || item.date > trip.endDate) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'date'],
          message: '安排日期必须位于行程日期范围内',
        })
      }
    })
  })

export const AppDataSchema = z
  .object({
    schemaVersion: z.literal(APP_DATA_SCHEMA_VERSION),
    trips: z.array(TripSchema),
  })
  .superRefine((data, context) => {
    const tripIds = new Set<string>()

    data.trips.forEach((trip, index) => {
      if (tripIds.has(trip.id)) {
        context.addIssue({
          code: 'custom',
          path: ['trips', index, 'id'],
          message: '行程 ID 不能重复',
        })
      }
      tripIds.add(trip.id)
    })
  })

export type Coordinates = z.infer<typeof CoordinatesSchema>
export type PlaceRef = z.infer<typeof PlaceRefSchema>
export type TravelMode = z.infer<typeof TravelModeSchema>
export type ActivityItem = z.infer<typeof ActivityItemSchema>
export type TransportItem = z.infer<typeof TransportItemSchema>
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>
export type Trip = z.infer<typeof TripSchema>
export type AppData = z.infer<typeof AppDataSchema>

export type CreateTripInput = {
  title: string
  destination?: string
  startDate: string
  endDate: string
  timezone?: string
  defaultTravelMode?: TravelMode
}

export type CreateActivityInput = Omit<ActivityItem, 'id' | 'type'> & {
  id?: string
}

export type CreateTransportInput = Omit<TransportItem, 'id' | 'type'> & {
  id?: string
}

export function createEmptyAppData(): AppData {
  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    trips: [],
  }
}

export function createTrip(input: CreateTripInput): Trip {
  const now = new Date().toISOString()

  return TripSchema.parse({
    id: crypto.randomUUID(),
    title: input.title,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: input.timezone ?? 'Asia/Shanghai',
    defaultTravelMode: input.defaultTravelMode ?? 'transit',
    items: [],
    createdAt: now,
    updatedAt: now,
  })
}

export function createActivityItem(input: CreateActivityInput): ActivityItem {
  return ActivityItemSchema.parse({
    ...input,
    id: input.id ?? crypto.randomUUID(),
    type: 'activity',
  })
}

export function createTransportItem(input: CreateTransportInput): TransportItem {
  return TransportItemSchema.parse({
    ...input,
    id: input.id ?? crypto.randomUUID(),
    type: 'transport',
  })
}
