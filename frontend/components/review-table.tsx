import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

export interface Column<T> {
  key: string
  header: string
  render: (item: T, index: number) => React.ReactNode
  className?: string
}

export interface ReviewTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onAction: (item: T) => void
  actionLabel?: string
  emptyMessage?: string
  keyExtractor: (item: T) => string
}

/**
 * Reusable table component for displaying review lists
 *
 * Usage:
 * <ReviewTable
 *   columns={[
 *     { key: 'name', header: 'File Name', render: (item) => item.fileName },
 *     { key: 'date', header: 'Date', render: (item) => formatDate(item.date) }
 *   ]}
 *   data={items}
 *   onAction={(item) => handleReview(item.id)}
 *   actionLabel="Review →"
 *   keyExtractor={(item) => item.id}
 * />
 */
export function ReviewTable<T>({
  columns,
  data,
  onAction,
  actionLabel = "View →",
  emptyMessage = "No items found",
  keyExtractor,
}: ReviewTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left p-3 text-sm font-medium text-muted-foreground ${
                    column.className || ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className={`border-b border-border hover:bg-muted/30 transition-colors ${
                  index % 2 === 0 ? "bg-background" : "bg-muted/10"
                }`}
              >
                {columns.map((column) => (
                  <td key={`${keyExtractor(item)}-${column.key}`} className="p-3">
                    {column.render(item, index)}
                  </td>
                ))}
                <td className="p-3">
                  <Button onClick={() => onAction(item)} size="sm" className="w-full">
                    {actionLabel}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Common column renderers
 */
export const ColumnRenderers = {
  text: (value: string) => <div className="text-sm">{value}</div>,

  date: (date: Date | string | undefined) => (
    <div className="text-sm">
      {date ? new Date(date).toLocaleDateString() : "N/A"}
    </div>
  ),

  count: (count: number) => <div className="text-sm font-medium">{count}</div>,

  rating: (count: number, rating: number | undefined) => (
    <div className="flex items-center gap-1">
      {count > 0 && rating ? (
        <>
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium">{rating.toFixed(1)}</span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">N/A</span>
      )}
    </div>
  ),

  status: (
    reviewCount: number,
    avgRating: number | undefined,
    needsReviewLabel: string = "Needs Review",
    lowRatingLabel: string = "Low Rating",
    reviewedLabel: string = "Reviewed"
  ) => (
    <div className="flex gap-1">
      {reviewCount === 0 ? (
        <Badge variant="secondary" className="text-xs">
          {needsReviewLabel}
        </Badge>
      ) : avgRating && avgRating < 3.5 ? (
        <Badge variant="destructive" className="text-xs">
          {lowRatingLabel}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs">
          {reviewedLabel}
        </Badge>
      )}
    </div>
  ),
}
