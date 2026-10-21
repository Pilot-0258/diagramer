import type { Coordinates, PlaceRef, TravelMode } from './trip'

export type PlaceCandidate = PlaceRef

export type RouteQuery = {
  origin: PlaceRef
  destination: PlaceRef
  mode: TravelMode
}

export type RouteLeg = {
  provider: string
  mode: TravelMode
  path: Coordinates[]
  distanceMeters: number
  durationMinutes: number
  fetchedAt: string
}

export interface MapProvider {
  readonly id: string
  searchPlaces(query: string, city?: string): Promise<PlaceCandidate[]>
  geocode(place: PlaceRef): Promise<PlaceRef>
  planRoute(query: RouteQuery): Promise<RouteLeg>
}
