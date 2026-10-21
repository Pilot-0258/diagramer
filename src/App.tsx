import { TripRepository } from './storage/tripRepository'

const ArrowIcon = () => (
  <svg
    aria-hidden="true"
    className="arrow-icon"
    viewBox="0 0 20 20"
    fill="none"
  >
    <path d="M4 10h11M11 5l5 5-5 5" />
  </svg>
)

const PinIcon = () => (
  <svg aria-hidden="true" className="pin-icon" viewBox="0 0 24 24" fill="none">
    <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
    <circle cx="12" cy="10" r="2.25" />
  </svg>
)

function getStorageStatus() {
  try {
    const result = new TripRepository(window.localStorage).load()

    if (!result.ok) {
      return '本地数据需要检查'
    }

    return result.value.trips.length === 0
      ? '本地存储已就绪'
      : `本机已保存 ${result.value.trips.length} 个行程`
  } catch {
    return '浏览器存储不可用'
  }
}

function App() {
  const storageStatus = getStorageStatus()

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="行程图首页">
          <span className="brand-mark">
            <PinIcon />
          </span>
          <span>行程图</span>
        </a>
        <span className="local-badge">仅保存在本机</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">TRIP ITINERARY · 本地版</p>
            <h1 id="hero-title">
              把旅程，
              <br />
              排成一张看得懂的图。
            </h1>
            <p className="lead">
              录入每天的时间与安排，自动整理成清晰的时间表。无需登录，行程只留在你的浏览器里。
            </p>
            <button className="primary-action" type="button" disabled>
              开始规划
              <ArrowIcon />
            </button>
            <p className="stage-note">下一阶段开放行程创建与编辑</p>
          </div>

          <div className="sample-card" aria-label="时间表样式预览">
            <div className="sample-card-header">
              <div>
                <span className="sample-label">示例行程</span>
                <h2>杭州 · 两日慢游</h2>
              </div>
              <span className="day-chip">DAY 01</span>
            </div>
            <div className="sample-rule" />
            <ol className="sample-list">
              <li>
                <time>09:00</time>
                <div>
                  <strong>抵达西湖</strong>
                  <span>湖滨码头</span>
                </div>
              </li>
              <li>
                <time>12:30</time>
                <div>
                  <strong>午餐</strong>
                  <span>北山街</span>
                </div>
              </li>
              <li>
                <time>15:00</time>
                <div>
                  <strong>浙江省博物馆</strong>
                  <span>孤山馆区</span>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="principles" aria-label="产品特点">
          <article>
            <span>01</span>
            <h2>本地优先</h2>
            <p>没有账号与云端同步，旅行安排只保存在当前浏览器。</p>
          </article>
          <article>
            <span>02</span>
            <h2>时间清楚</h2>
            <p>按天分组、自动排序，并提醒相互重叠的日程。</p>
          </article>
          <article>
            <span>03</span>
            <h2>为地图留好接口</h2>
            <p>地点与交通段从第一版开始建模，后续可接入动态地图。</p>
          </article>
        </section>
      </main>

      <footer>
        <span>行程图 · V1 数据层</span>
        <span data-testid="storage-status">{storageStatus}</span>
      </footer>
    </div>
  )
}

export default App
