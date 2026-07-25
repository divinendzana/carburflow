import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SITES = [
  { name: 'Douala — Bepanda', level: 78, tone: 'bg-success' },
  { name: 'Douala — Bonaberi', level: 54, tone: 'bg-warning' },
  { name: 'Yaoundé — Nsimalen', level: 31, tone: 'bg-destructive' },
]

function DashboardShowcase() {
  return (
    <Card className="showcase-panel overflow-hidden border-border/80 shadow-[0_24px_60px_rgba(15,76,110,0.12)]">
      <CardHeader className="border-b border-border bg-petrol-soft/40 pb-4">
        <CardTitle className="text-base text-petrol">Vue multi-sites</CardTitle>
        <p className="text-sm text-muted-foreground">Niveaux de cuves · dernière synchro il y a 12 min</p>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          {SITES.map((site) => (
            <div key={site.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{site.name}</span>
                <span className="tabular-nums text-muted-foreground">{site.level} %</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${site.tone}`}
                  style={{ width: `${site.level}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Consommation 7 jours
          </p>
          <div className="mt-4 flex h-32 items-end gap-2">
            {[42, 58, 51, 67, 60, 74, 69].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-[linear-gradient(180deg,#1a6b8a,#0f4c6e)] opacity-90"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>Lun</span>
            <span>Dim</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardShowcase
