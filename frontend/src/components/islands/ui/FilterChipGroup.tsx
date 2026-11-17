import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

interface FilterChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface FilterChipGroupProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly FilterChipOption<T>[];
  readonly onChange: (value: T) => void;
}

export default function FilterChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: Readonly<FilterChipGroupProps<T>>): React.JSX.Element {
  return (
    <Stack
      component="div"
      role="group"
      aria-label={label}
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexWrap: "wrap", mb: 2 }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Chip
            key={option.value}
            component="button"
            type="button"
            label={option.label}
            aria-pressed={selected}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            onClick={() => onChange(option.value)}
          />
        );
      })}
    </Stack>
  );
}
