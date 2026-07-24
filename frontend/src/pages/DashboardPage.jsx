import React, { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import MetricPanel from '../components/MetricPanel.jsx'

const fallbackDashboardData = {
  metric1: {
    labels: ['CP #1 (BUF Bepanda)', 'CP #2 (BUF Bonaberi)', 'CP #3 (BUF Yaounde)'],
    values: [62, 40, 55],
    quantities: [2400, 1800, 2100],
    dailySeries: {
      1: {
        labels: ['CJ #1', 'CJ #2', 'CJ #3'],
        percentages: [72, 88, 80],
        colors: ['#0b3d7a', '#3b82f6', '#60a5fa'],
      },
    },
  },
  metric2: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalConsumption: [380, 420, 460, 490, 520, 570],
    siteSeries: [
      { label: 'BUF Bepanda', data: [130, 150, 170, 180, 190, 220], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { label: 'BUF Bonaberi', data: [115, 130, 145, 150, 160, 175], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { label: 'BUF Yaounde', data: [135, 140, 145, 160, 170, 175], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
  metric3: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalHours: [42, 48, 54, 61, 58, 66],
    sitesData: {
      1: {
        nom_site: 'BUF Bepanda',
        datasets: [
          { label: 'G#1 (Group 1)', data: [18, 21, 22, 24, 23, 26], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
          { label: 'G#2 (Group 2)', data: [12, 13, 15, 17, 16, 18], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
        ],
      },
    },
  },
  metric4: {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui'],
    globalVolumes: [1800, 2100, 2050, 2350, 2600, 2820],
    siteSeries: [
      { label: 'BUF Bepanda', data: [700, 780, 760, 850, 920, 1000], borderColor: '#0b3d7a', backgroundColor: '#0b3d7a22' },
      { label: 'BUF Bonaberi', data: [560, 620, 610, 720, 760, 820], borderColor: '#3b82f6', backgroundColor: '#3b82f622' },
      { label: 'BUF Yaounde', data: [540, 700, 680, 780, 920, 1000], borderColor: '#60a5fa', backgroundColor: '#60a5fa22' },
    ],
  },
}

function DashboardPage({ onNavigate }) {
  const chartPalette = useMemo(() => ({
    axis: '#123d6d',
    grid: 'rgba(11, 61, 122, 0.08)',
    text: '#23466d',
  }), [])
  const [dashboardData, setDashboardData] = useState(null)
  const [periodStart, setPeriodStart] = useState(0)
  const [periodEnd, setPeriodEnd] = useState(0)

  const sliceRange = (items = []) => {
    if (!items.length) return []
    const start = Math.min(periodStart, periodEnd)
    const end = Math.max(periodStart, periodEnd)
    return items.slice(start, end + 1)
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [metric1, metric2, metric3, metric4] = await Promise.all([
          fetch('/dashboard/etat_cuves').then((response) => response.json()),
          fetch('/dashboard/evolution_volumes').then((response) => response.json()),
          fetch('/dashboard/horaires_groupes').then((response) => response.json()),
          fetch('/dashboard/consommation').then((response) => response.json()),
        ])

        setDashboardData({
          metric1: {
            labels: metric1.cp_chart_labels,
            values: metric1.cp_chart_pcts,
            quantities: metric1.cp_chart_quantities,
            dailySeries: metric1.sites_cj_chart_data || {},
          },
          metric2: {
            labels: metric4.labels,
            globalConsumption: metric4.global_consumption,
            siteSeries: metric4.sites_series,
          },
          metric3: {
            labels: metric3.labels,
            globalHours: metric3.global_hours,
            sitesData: metric3.sites_data,
          },
          metric4: {
            labels: metric2.labels,
            globalVolumes: metric2.global_volumes,
            siteSeries: metric2.sites_series,
          },
        })
      } catch (error) {
        console.warn('Backend React dashboard unavailable, using demo fallback data.', error)
        setDashboardData(fallbackDashboardData)
      }
    }

    loadDashboardData()
  }, [])

  useEffect(() => {
    if (!dashboardData) return
    const lastIndex = Math.max((dashboardData.metric2.labels?.length || 1) - 1, 0)
    setPeriodStart(0)
    setPeriodEnd(lastIndex)
  }, [dashboardData])

  useEffect(() => {
    if (!window.Chart || !dashboardData) {
      return undefined
    }

    const charts = []
    const labels = sliceRange(dashboardData.metric2.labels)
    const globalConsumptionRange = sliceRange(dashboardData.metric2.globalConsumption)
    const globalVolumesRange = sliceRange(dashboardData.metric4.globalVolumes)
    const globalHoursRange = sliceRange(dashboardData.metric3.globalHours)

    const createLineChart = (id, data, label, color, labelsForChart, fill = false) => {
      const ctx = document.getElementById(id)
      if (!ctx) return

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labelsForChart,
          datasets: [
            {
              label,
              data,
              borderColor: color,
              backgroundColor: fill ? `${color}22` : 'transparent',
              borderWidth: 3,
              tension: 0.35,
              fill,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })

      charts.push(chart)
    }

    const createBarChart = (id, data, label, labelsForChart, color, tooltipFormatter) => {
      const ctx = document.getElementById(id)
      if (!ctx) return

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labelsForChart,
          datasets: [
            {
              label,
              data,
              backgroundColor: color,
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: tooltipFormatter || ((context) => ` ${context.parsed.y.toLocaleString('fr-FR')} ${label}`),
              },
            },
          },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { display: false } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })

      charts.push(chart)
    }

    createBarChart('chart-metric-1', dashboardData.metric1.values, 'Cuves principales (% remplissage)', dashboardData.metric1.labels, '#0b3d7a', (context) => {
      const index = context.dataIndex
      const quantity = dashboardData.metric1.quantities?.[index] ?? 0
      return ` ${context.parsed.y.toFixed(1)} % • ${quantity.toLocaleString('fr-FR')} L`
    })

    const flattenedDailySeries = Object.entries(dashboardData.metric1.dailySeries || {}).flatMap(([siteId, siteSeries]) =>
      (siteSeries.labels || []).map((label, index) => ({
        label: `${siteId} · ${label}`,
        value: siteSeries.percentages?.[index] ?? 0,
        color: siteSeries.colors?.[index] || '#0b3d7a',
      })),
    )

    if (flattenedDailySeries.length) {
      const dailyCtx = document.getElementById('chart-metric-1-daily')
      if (dailyCtx) {
        const dailyChart = new Chart(dailyCtx, {
          type: 'bar',
          data: {
            labels: flattenedDailySeries.map((item) => item.label),
            datasets: [
              {
                label: 'Cuves journalières visibles (% remplissage)',
                data: flattenedDailySeries.map((item) => item.value),
                backgroundColor: flattenedDailySeries.map((item) => item.color),
                borderRadius: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: chartPalette.text }, grid: { display: false } },
              y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            },
          },
        })
        charts.push(dailyChart)
      }
    }

    createLineChart('chart-metric-2', globalConsumptionRange, 'Consommation totale (L)', '#0b3d7a', labels, true)
    createLineChart('chart-metric-3', globalHoursRange, 'Écart horaire global', '#3b82f6', labels, true)
    createLineChart('chart-metric-4', globalVolumesRange, 'Volume total dans les cuves (L)', '#60a5fa', labels, true)

    const siteVolumeCtx = document.getElementById('chart-metric-2-sites')
    if (siteVolumeCtx) {
      const siteChart = new Chart(siteVolumeCtx, {
        type: 'line',
        data: {
          labels,
          datasets: dashboardData.metric2.siteSeries.map((site) => ({
            label: site.label,
            data: sliceRange(site.data),
            borderColor: site.borderColor || site.color,
            backgroundColor: site.backgroundColor || `${site.borderColor || site.color}22`,
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })
      charts.push(siteChart)
    }

    const siteHoursCtx = document.getElementById('chart-metric-3-sites')
    if (siteHoursCtx) {
      const siteHoursDatasets = Object.values(dashboardData.metric3.sitesData || {}).flatMap((site) =>
        (site.datasets || []).map((dataset) => ({
          label: dataset.label,
          data: sliceRange(dataset.data),
          borderColor: dataset.borderColor,
          backgroundColor: dataset.backgroundColor,
          borderWidth: 2,
          tension: 0.35,
          fill: false,
        })),
      )

      const siteHoursChart = new Chart(siteHoursCtx, {
        type: 'line',
        data: { labels, datasets: siteHoursDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })
      charts.push(siteHoursChart)
    }

    const siteConsumptionCtx = document.getElementById('chart-metric-4-sites')
    if (siteConsumptionCtx) {
      const siteConsumptionChart = new Chart(siteConsumptionCtx, {
        type: 'line',
        data: {
          labels,
          datasets: dashboardData.metric4.siteSeries.map((site) => ({
            label: site.label,
            data: sliceRange(site.data),
            borderColor: site.borderColor || site.color,
            backgroundColor: site.backgroundColor || `${site.borderColor || site.color}22`,
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
            y: { ticks: { color: chartPalette.text }, grid: { color: chartPalette.grid } },
          },
        },
      })
      charts.push(siteConsumptionChart)
    }

    return () => charts.forEach((chart) => chart.destroy())
  }, [chartPalette, dashboardData, periodStart, periodEnd])

  if (!dashboardData) {
    return (
      <div className="app-shell dashboard-shell">
        <Topbar activeView="dashboard" onNavigate={onNavigate} />
        <main className="dashboard-grid">
          <div className="loading-state">Chargement du dashboard...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <Topbar activeView="dashboard" onNavigate={onNavigate} />

      <main className="dashboard-grid">
        <section className="dashboard-cards">
          <MetricPanel label="Volume actuel des cuves" title="Volume actuel des cuves">
            <div className="metric-stack">
              <div className="chart-box fixed-box">
                <span className="curve-title">Principales cuves (% remplissage)</span>
                <canvas id="chart-metric-1" />
              </div>
              <div className="chart-box fixed-box">
                <span className="curve-title">Diagramme des cuves journalières visibles</span>
                <canvas id="chart-metric-1-daily" />
              </div>
            </div>
          </MetricPanel>

          {dashboardData && (
            <div className="period-bar">
              <div className="filter-field">
                <label htmlFor="dashboard-start">Rapport début</label>
                <select id="dashboard-start" value={periodStart} onChange={(event) => setPeriodStart(Number(event.target.value))}>
                  {dashboardData.metric2.labels.map((label, index) => (
                    <option key={`${label}-${index}`} value={index}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="dashboard-end">Rapport fin</label>
                <select id="dashboard-end" value={periodEnd} onChange={(event) => setPeriodEnd(Number(event.target.value))}>
                  {dashboardData.metric2.labels.map((label, index) => (
                    <option key={`${label}-${index}`} value={index}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <MetricPanel label="Métrique 2" title="Quantité de carburant totale consommée">
            <div className="metric-split-grid">
              <div className="chart-box fixed-box"><canvas id="chart-metric-2" /></div>
              <div className="chart-box fixed-box"><canvas id="chart-metric-2-sites" /></div>
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 3" title="Variations horaires totales">
            <div className="metric-split-grid">
              <div className="chart-box fixed-box"><canvas id="chart-metric-3" /></div>
              <div className="chart-box fixed-box"><canvas id="chart-metric-3-sites" /></div>
            </div>
          </MetricPanel>

          <MetricPanel label="Métrique 4" title="Volume total dans les cuves">
            <div className="metric-split-grid">
              <div className="chart-box fixed-box"><canvas id="chart-metric-4" /></div>
              <div className="chart-box fixed-box"><canvas id="chart-metric-4-sites" /></div>
            </div>
          </MetricPanel>
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
