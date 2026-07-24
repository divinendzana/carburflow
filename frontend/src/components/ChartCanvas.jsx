import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/theme'
import {
  Chart,
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js'

Chart.register(
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
)

Chart.defaults.font.family = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
Chart.defaults.font.size = 11.5

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function chartTheme() {
  return {
    text: cssVar('--chart-text') || '#23466d',
    grid: cssVar('--chart-grid') || 'rgba(11, 61, 122, 0.08)',
  }
}

function baseScales(unit, { beginAtZero = false } = {}) {
  const theme = chartTheme()
  return {
    x: {
      ticks: { color: theme.text, maxRotation: 30, autoSkipPadding: 12 },
      grid: { color: theme.grid },
    },
    y: {
      beginAtZero,
      ticks: {
        color: theme.text,
        callback: (value) => (unit ? `${value.toLocaleString('fr-FR')} ${unit}` : value.toLocaleString('fr-FR')),
      },
      grid: { color: theme.grid },
    },
  }
}

function tooltipFor(unit) {
  return {
    backgroundColor: 'rgba(10, 25, 47, 0.92)',
    padding: 10,
    cornerRadius: 10,
    displayColors: true,
    boxPadding: 4,
    callbacks: unit
      ? { label: (ctx) => ` ${ctx.dataset.label ?? ''} : ${ctx.parsed.y.toLocaleString('fr-FR')} ${unit}` }
      : undefined,
  }
}

/**
 * Wrapper React générique autour de Chart.js : crée le graphique au montage,
 * le détruit au démontage, et le recrée quand `config` change.
 */
function useChart(buildConfig, deps) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined
    const chart = new Chart(canvasRef.current, buildConfig())
    return () => chart.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return canvasRef
}

export function LineChart({ labels = [], datasets = [], unit = '', beginAtZero = false, showLegend = false, height }) {
  const theme = useTheme()
  const canvasRef = useChart(
    () => ({
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((dataset) => ({
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: dataset.fill ?? false,
          ...dataset,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: showLegend ? { position: 'top', labels: { color: chartTheme().text, usePointStyle: true, boxHeight: 7 } } : { display: false },
          tooltip: tooltipFor(unit),
        },
        scales: baseScales(unit, { beginAtZero }),
      },
    }),
    [labels, datasets, unit, beginAtZero, showLegend, theme],
  )

  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <canvas ref={canvasRef} />
    </div>
  )
}

/**
 * Graphique combiné : chaque dataset porte son propre `type` ('line' ou 'bar').
 * Utilisé pour corréler la consommation (barres) avec le volume de cuve (courbe).
 */
export function MixedChart({ labels = [], datasets = [], leftUnit = '', rightUnit = '', showLegend = true, height }) {
  const theme = useTheme()
  const canvasRef = useChart(
    () => {
      const palette = chartTheme()
      const hasRight = datasets.some((dataset) => dataset.yAxisID === 'y1')
      return {
        type: 'bar',
        data: {
          labels,
          datasets: datasets.map((dataset) => ({
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: dataset.type === 'line' ? 3 : undefined,
            borderRadius: dataset.type === 'bar' ? 6 : undefined,
            maxBarThickness: dataset.type === 'bar' ? 42 : undefined,
            ...dataset,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: showLegend ? { position: 'top', labels: { color: palette.text, usePointStyle: true, boxHeight: 7 } } : { display: false },
            tooltip: {
              backgroundColor: 'rgba(10, 25, 47, 0.92)',
              padding: 10,
              cornerRadius: 10,
              callbacks: {
                label: (ctx) => {
                  const unit = ctx.dataset.yAxisID === 'y1' ? rightUnit : leftUnit
                  return ` ${ctx.dataset.label ?? ''} : ${ctx.parsed.y.toLocaleString('fr-FR')} ${unit}`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: palette.text, maxRotation: 40, autoSkipPadding: 8 }, grid: { display: false } },
            y: {
              position: 'left',
              beginAtZero: true,
              ticks: { color: palette.text, callback: (v) => `${v.toLocaleString('fr-FR')} ${leftUnit}` },
              grid: { color: palette.grid },
            },
            ...(hasRight && {
              y1: {
                position: 'right',
                beginAtZero: true,
                ticks: { color: palette.text, callback: (v) => `${v.toLocaleString('fr-FR')} ${rightUnit}` },
                grid: { drawOnChartArea: false },
              },
            }),
          },
        },
      }
    },
    [labels, datasets, leftUnit, rightUnit, showLegend, theme],
  )

  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <canvas ref={canvasRef} />
    </div>
  )
}

export function BarChart({ labels = [], datasets = [], unit = '', showLegend = false, height, tooltipLabel }) {
  const theme = useTheme()
  const canvasRef = useChart(
    () => ({
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((dataset) => ({
          borderRadius: 8,
          maxBarThickness: 46,
          ...dataset,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: showLegend ? { position: 'top', labels: { color: chartTheme().text } } : { display: false },
          tooltip: {
            ...tooltipFor(unit),
            callbacks: tooltipLabel ? { label: tooltipLabel } : tooltipFor(unit).callbacks,
          },
        },
        scales: {
          ...baseScales(unit, { beginAtZero: true }),
          x: { ticks: { color: chartTheme().text, maxRotation: 40, autoSkipPadding: 8 }, grid: { display: false } },
        },
      },
    }),
    [labels, datasets, unit, showLegend, tooltipLabel, theme],
  )

  return (
    <div className="chart-box" style={height ? { height } : undefined}>
      <canvas ref={canvasRef} />
    </div>
  )
}
