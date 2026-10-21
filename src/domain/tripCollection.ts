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
