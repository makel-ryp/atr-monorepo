export default defineEventHandler(async () => {
  const db = useDb()

  const { rows: master } = await db.sql`SELECT * FROM inventory_master`
  const { rows: rolling } = await db.sql`SELECT * FROM rolling_windows`

  const rollingBySku = new Map(rolling.map((r: Record<string, unknown>) => [r.sku, r]))

  return master.map((row: Record<string, unknown>) => ({
    ...row,
    total_7d: rollingBySku.get(row.sku)?.total_7d ?? null,
    total_180d: rollingBySku.get(row.sku)?.total_180d ?? null,
    yoy_change_pct: rollingBySku.get(row.sku)?.yoy_change_pct ?? null,
    velocity_trend: rollingBySku.get(row.sku)?.velocity_trend ?? null,
  }))
})
