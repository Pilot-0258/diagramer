import { useCallback, useState } from 'react'
import type { AppData } from '../../domain/trip'
import { TripRepository } from '../../storage/tripRepository'

export function useTripData() {
  const [repository] = useState(() => new TripRepository(window.localStorage))
  const [initialResult] = useState(() => repository.load())
  const [data, setData] = useState<AppData | null>(
    initialResult.ok ? initialResult.value : null,
  )
  const [storageError, setStorageError] = useState<string | null>(
    initialResult.ok ? null : initialResult.error.message,
  )

  const commit = useCallback(
    (next: AppData) => {
      const result = repository.save(next)

      if (!result.ok) {
        setStorageError(result.error.message)
        return false
      }

      setData(result.value)
      setStorageError(null)
      return true
    },
    [repository],
  )

  const dismissStorageError = useCallback(() => {
    setStorageError(null)
  }, [])

  return {
    data,
    storageError,
    commit,
    dismissStorageError,
  }
}
