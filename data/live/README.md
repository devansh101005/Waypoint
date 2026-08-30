# data/live — the curated corpus

Drop the three exported CSVs here and the application uses them instead of the seed corpus in
`data/bootstrap`. Nothing else needs changing: the corpus loader looks in `data/live` first and
falls back to `data/bootstrap` only when this folder is empty.

## Exporting from the Google Sheet

Google Sheets exports one tab at a time, so this is three separate downloads.

1. Open the sheet and click the **Skills** tab at the bottom.
2. **File → Download → Comma Separated Values (.csv)**.
3. Rename the downloaded file to exactly `skills.csv`.
4. Repeat for the **Resources** tab → `resources.csv`.
5. Repeat for the **Scenarios** tab → `scenarios.csv`.
6. Put all three in this folder.

The filenames must be exactly `skills.csv`, `resources.csv` and `scenarios.csv`.

## Then import

```bash
npm run import -- data/live/skills.csv data/live/resources.csv data/live/scenarios.csv
```

Nothing is written unless every row validates. If something is wrong you get a report naming the
sheet, the row number and the problem — send that straight back to whoever owns the sheet, no
interpretation needed:

```
resources.csv — 2 problems:
  • row 47, column "skills_taught": unknown skill slug "sql-join" — add it to the Skills tab first
  • row 51, column "url": duplicate url — already used on row 22
```

Row numbers match the spreadsheet exactly (row 1 is the header).

To check a sheet without touching the database, add `--validate-only`.

## After a successful import

```bash
npm run eval -- --json    # re-score against the new corpus
```

Every figure shown in the interface is read from the corpus and from `eval-results/eval.json`, so
both update on their own once these two commands have run. Nothing is typed in by hand.
