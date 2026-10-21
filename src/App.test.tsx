// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import {
  APP_DATA_SCHEMA_VERSION,
  createEmptyAppData,
  createTrip,
} from './domain/trip'
import {
  APP_DATA_STORAGE_KEY,
  TripRepository,
} from './storage/tripRepository'

describe('排图者 diagramer 界面', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('创建行程并写入本地存储', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '新建行程' }))
    fireEvent.change(screen.getByLabelText('行程标题'), {
      target: { value: '成都周末' },
    })
    fireEvent.change(screen.getByLabelText('目的地 选填'), {
      target: { value: '成都' },
    })
    fireEvent.click(screen.getByRole('button', { name: '创建行程' }))

    expect(
      await screen.findByRole('heading', { name: '成都周末' }),
    ).toBeInTheDocument()

    const stored = JSON.parse(
      window.localStorage.getItem(APP_DATA_STORAGE_KEY) ?? '{}',
    )
    expect(stored.schemaVersion).toBe(APP_DATA_SCHEMA_VERSION)
    expect(stored.trips).toHaveLength(1)
    expect(stored.trips[0].title).toBe('成都周末')
  })

  it('打开已有行程并添加活动', async () => {
    const trip = createTrip({
      title: '界面测试行程',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    })
    const data = {
      ...createEmptyAppData(),
      trips: [trip],
    }
    const repository = new TripRepository(window.localStorage)
    expect(repository.save(data).ok).toBe(true)

    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /界面测试行程/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: '添加安排' }))
    fireEvent.change(screen.getByLabelText('安排标题'), {
      target: { value: '午餐' },
    })
    fireEvent.change(screen.getByLabelText('地点 选填'), {
      target: { value: '春熙路' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: '添加到时间表' }),
    )

    expect(await screen.findByRole('heading', { name: '午餐' })).toBeInTheDocument()

    const loaded = repository.load()
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.trips[0].items).toHaveLength(1)
      expect(loaded.value.trips[0].items[0].title).toBe('午餐')
    }
  })
})
