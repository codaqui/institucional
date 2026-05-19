import React from "react";
import Box from "@mui/material/Box";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import TableContainer from "@mui/material/TableContainer";
import { type SxProps, type Theme } from "@mui/material/styles";

interface AdminDataTableProps {
  table: React.ReactNode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  tableContainerSx?: SxProps<Theme>;
  paginationMarginTop?: number;
}

export default function AdminDataTable({
  table,
  page,
  totalPages,
  onPageChange,
  tableContainerSx,
  paginationMarginTop = 2,
}: Readonly<AdminDataTableProps>): React.JSX.Element {
  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={tableContainerSx}>
        {table}
      </TableContainer>
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: paginationMarginTop }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => onPageChange(value)}
            color="primary"
          />
        </Box>
      )}
    </>
  );
}
