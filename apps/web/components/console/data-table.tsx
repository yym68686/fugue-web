import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@fugue/ui/components/table";

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  renderRow,
}: {
  columns: string[];
  rows: Row[];
  renderRow: (row: Row) => ReactNode;
}) {
  return (
    <Table variant="card">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map((row) => renderRow(row))}</TableBody>
    </Table>
  );
}
