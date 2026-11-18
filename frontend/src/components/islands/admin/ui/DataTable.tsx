/**
 * Port de `src/components/AdminDataTable` (Docusaurus) — tabela + paginação
 * padrão das listagens do painel admin.
 */
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TableContainer from "@mui/material/TableContainer";
import type { SxProps, Theme } from "@mui/material/styles";
import PaginationControls from "../../ui/PaginationControls";

interface DataTableProps {
  table: ReactNode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  tableContainerSx?: SxProps<Theme>;
  paginationMarginTop?: number;
  itemLabel?: string;
}

export default function DataTable({
  table,
  page,
  totalPages,
  onPageChange,
  tableContainerSx,
  paginationMarginTop = 2,
  itemLabel = "resultados",
}: Readonly<DataTableProps>): React.JSX.Element {
  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={tableContainerSx}>
        {table}
      </TableContainer>
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: paginationMarginTop }}>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onChange={onPageChange}
            itemLabel={itemLabel}
          />
        </Box>
      )}
    </>
  );
}
