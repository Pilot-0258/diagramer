import {
  AppDataSchema,
  TripSchema,
  createTrip,
  type ActivityItem,
  type AppData,
  type PlaceRef,
  type ScheduleItem,
  type TransportItem,
  type TravelMode,
  type Trip,
} from './trip'

export type TripMetadataInput = {
  title: string
  destination?: string
  startDate: string
  endDate: string
  defaultTravelMode: TravelMode
}

export function sortTripsForDisplay(trips: Trip[]) {
  return [...trips].sort((left, right) => {
    const dateOrder = left.startDate.localeCompare(right.startDate)
    return dateOrder !== 0
      ? dateOrder
      : left.title.localeCompare(right.title, 'zh-CN')
  })
}

export function findTrip(data: AppData, tripId: string) {
  return data.trips.find((trip) => trip.id === tripId)
}

export function addTripToData(data: AppData, trip: Trip): AppData {
  return AppDataSchema.parse({
    ...data,
    trips: [...data.trips, trip],
  })
}

export function createTripInData(
  data: AppData,
  input: TripMetadataInput,
): AppData {
  const trip = createTrip(input)
  return addTripToData(data, trip)
}

export function updateTripMetadataInData(
  data: AppData,
  tripId: string,
  input: TripMetadataInput,
): AppData {
  const existing = findTrip(data, tripId)

  if (!existing) {
    throw new Error('找不到要编辑的行程')
  }

  const updated = TripSchema.parse({
    ...existing,
    title: input.title,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    defaultTravelMode: input.defaultTravelMode,
    updatedAt: new Date().toISOString(),
  })

  return AppDataSchema.parse({
    ...data,
    trips: data.trips.map((trip) => (trip.id === tripId ? updated : trip)),
  })
}

function replaceTripItems(
  data: AppData,
  tripId: string,
  items: ScheduleItem[],
): AppData {
  const trip = findTrip(data, tripId)

  if (!trip) {
    throw new Error('找不到要修改的行程')
  }

  const updated = TripSchema.parse({
    ...trip,
    items,
    updatedAt: new Date().toISOString(),
  })

  return AppDataSchema.parse({
    ...data,
    trips: data.trips.map((candidate) =>
      candidate.id === tripId ? updated : candidate,
    ),
  })
}

export function addScheduleItemInData(
  data: AppData,
  tripId: string,
  item: ScheduleItem,
): AppData {
  const trip = findTrip(data, tripId)

  if (!trip) {
    throw new Error('找不到要添加安排的行程')
  }

  return replaceTripItems(data, tripId, [...trip.items, item])
}

export function updateScheduleItemInData(
  data: AppData,
  tripId: string,
  item: ScheduleItem,
): AppData {
  const trip = findTrip(data, tripId)

  if (!trip) {
    throw new Error('找不到要修改安排的行程')
  }

  if (!trip.items.some((candidate) => candidate.id === item.id)) {
    throw new Error('找不到要修改的安排')
  }

  return replaceTripItems(
    data,
    tripId,
    trip.items.map((candidate) =>
      candidate.id === item.id ? item : candidate,
    ),
  )
}

export function removeScheduleItemInData(
  data: AppData,
  tripId: string,
  itemId: string,
): AppData {
  const trip = findTrip(data, tripId)

  if (!trip) {
    throw new Error('找不到要修改安排的行程')
  }

  return replaceTripItems(
    data,
    tripId,
    trip.items.filter((item) => item.id !== itemId),
  )
}

export function sortScheduleItemsForDisplay(items: ScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftKey = `${left.date}T${left.startTime}`
    const rightKey = `${right.date}T${right.startTime}`
    return leftKey.localeCompare(rightKey)
  })
}

export function listTripDates(trip: Trip) {
  const dates: string[] = []
  const cursor = new Date(`${trip.startDate}T00:00:00.000Z`)
  const end = new Date(`${trip.endDate}T00:00:00.000Z`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export function findOverlappingScheduleItemIds(trip: Trip) {
  const overlapping = new Set<string>()
  const sorted = sortScheduleItemsForDisplay(trip.items)

  const toMinute = (date: string, time: string) =>
    Date.parse(`${date}T${time}:00.000Z`) / 60_000

  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sorted.length;
      rightIndex += 1
    ) {
      const left = sorted[leftIndex]
      const right = sorted[rightIndex]
      const leftStart = toMinute(left.date, left.startTime)
      const leftEnd = toMinute(
        left.type === 'transport' ? left.endDate : left.date,
        left.endTime,
      )
      const rightStart = toMinute(right.date, right.startTime)
      const rightEnd = toMinute(
        right.type === 'transport' ? right.endDate : right.date,
        right.endTime,
      )

      if (leftStart < rightEnd && rightStart < leftEnd) {
        overlapping.add(left.id)
        overlapping.add(right.id)
      }
    }
  }

  return overlapping
}

export function removeTripFromData(data: AppData, tripId: string): AppData {
  return AppDataSchema.parse({
    ...data,
    trips: data.trips.filter((trip) => trip.id !== tripId),
  })
}

function clonePlace(place: PlaceRef): PlaceRef {
  return {
    ...place,
    id: crypto.randomUUID(),
  }
}

function cloneScheduleItem(item: ScheduleItem): ScheduleItem {
  if (item.type === 'transport') {
    const transport: TransportItem = {
      ...item,
      id: crypto.randomUUID(),
      from: clonePlace(item.from),
      to: clonePlace(item.to),
    }
    return transport
  }

  const activity: ActivityItem = {
    ...item,
    id: crypto.randomUUID(),
    location: item.location ? clonePlace(item.location) : undefined,
  }
  return activity
}

export function duplicateTripInData(
  data: AppData,
  tripId: string,
): { data: AppData; trip: Trip } {
  const source = findTrip(data, tripId)

  if (!source) {
    throw new Error('找不到要复制的行程')
  }

  const now = new Date().toISOString()
  const trip = TripSchema.parse({
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title}（副本）`,
    items: source.items.map(cloneScheduleItem),
    createdAt: now,
    updatedAt: now,
  })

  return {
    data: addTripToData(data, trip),
    trip,
  }
}
