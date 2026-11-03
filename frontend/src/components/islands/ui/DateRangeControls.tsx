import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeControlsProps extends DateRange {
  onChange: (range: DateRange) => void;
  onClear: () => void;
}

export default function DateRangeControls({ from, to, onChange, onClear }: Readonly<DateRangeControlsProps>) {
  const invalid = Boolean(from && to && from > to);
  const errorId = "transaction-date-range-error";

  return (
    <Box
      component="fieldset"
      sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", border: 0, p: 0, m: 0 }}
    >
      <TextField
        label="Data inicial"
        type="date"
        size="small"
        value={from}
        error={invalid}
        onChange={(event) => onChange({ from: event.target.value, to })}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            name: "from",
            "aria-invalid": invalid || undefined,
            "aria-errormessage": invalid ? errorId : undefined,
          },
        }}
        sx={{ width: 150 }}
      />
      <TextField
        label="Data final"
        type="date"
        size="small"
        value={to}
        error={invalid}
        onChange={(event) => onChange({ from, to: event.target.value })}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            name: "to",
            "aria-invalid": invalid || undefined,
            "aria-errormessage": invalid ? errorId : undefined,
          },
        }}
        sx={{ width: 150 }}
      />
      <Button type="button" size="small" variant="text" onClick={onClear} sx={{ textTransform: "none" }}>
        Limpar datas
      </Button>
      {invalid && (
        <Typography id={errorId} role="alert" color="error" variant="caption" sx={{ flexBasis: "100%" }}>
          A data inicial deve ser anterior ou igual à data final.
        </Typography>
      )}
    </Box>
  );
}
