# Report window

The report window is what `useReportWindow(period, source)` in `src/lib/query/report-window.ts`
works out for the overview, and later for the member screen and the self view.

## Month slots

- "Last 12 months" is the twelve months ending with today's month. It moves at midnight, through
  `useToday()`.
- A year period is January to December of that year.

## Years read

- The period's year is always read: the current year for "Last 12 months". Its answer feeds the
  figures and the people list.
- The prior year is read only when the window reaches into it and `scope.years` lists it. The local
  seed lists one year, so only the Jest fixtures exercise the second read.
- A disabled prior-year query can still hold an answer cached under its key from an earlier filter.
  The window ignores it.

## States

| State        | When                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`    | The current year has no answer or shows placeholder data, or a window across two years still waits on the scope or the prior year, its placeholder data included. |
| `incomplete` | The prior year's read failed with nothing kept, or the scope failed with nothing kept on a window across two years.                                               |
| `ready`      | Otherwise.                                                                                                                                                        |

Charts draw only when `ready`, or when `incomplete` under the inline note with Retry. While
`pending` they say "Loading the months", so a half-read window never shows as zeros.

Beside the state:

- `staleSince` is the kept answer's `dataUpdatedAt` when a reread of the current year failed.
- `coldOffline` is a failed first read with nothing kept, unless the server answered 403 or 404.
- `forbidden` is a 403 or 404 on the current read. Only a member read can answer that.
- `retry` reads the scope and both years again.
