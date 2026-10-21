import type { Trip } from './trip'

export type ParseWarning = {
  code: string
  message: string
  itemIndex?: number
}

export type ParsedTripDraft = {
  trip: Trip
  warnings: ParseWarning[]
}

export interface ItineraryTextParser {
  readonly id: string
  parse(text: string, context: { timezone: string }): Promise<ParsedTripDraft>
}
