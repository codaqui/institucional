import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
  BudgetItemFormValue,
  SupportPartnerFormValue,
} from "./project-form";

interface ProjectResourcesFieldsProps {
  readonly supportPartners: SupportPartnerFormValue[];
  readonly budgetItems: BudgetItemFormValue[];
  readonly attachments: string[];
  readonly onChange: (values: {
    supportPartners: SupportPartnerFormValue[];
    budgetItems: BudgetItemFormValue[];
    attachments: string[];
  }) => void;
  readonly disabled?: boolean;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function ProjectResourcesFields({
  supportPartners,
  budgetItems,
  attachments,
  onChange,
  disabled = false,
}: ProjectResourcesFieldsProps): React.JSX.Element {
  const updatePartner = (
    index: number,
    field: keyof SupportPartnerFormValue,
    value: string,
  ) => {
    onChange({
      supportPartners: supportPartners.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
      budgetItems,
      attachments,
    });
  };
  const updateBudget = (
    index: number,
    field: keyof BudgetItemFormValue,
    value: string,
  ) => {
    onChange({
      supportPartners,
      budgetItems: budgetItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
      attachments,
    });
  };
  const updateAttachment = (index: number, value: string) => {
    onChange({
      supportPartners,
      budgetItems,
      attachments: attachments.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    });
  };

  return (
    <>
      <Typography variant="h6" component="h3">
        Parceiros de apoio
      </Typography>
      {supportPartners.map((partner, index) => (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          key={`partner-${index}`}
        >
          <TextField
            fullWidth
            label={`Nome do parceiro ${index + 1}`}
            value={partner.nome}
            disabled={disabled}
            onChange={(event) =>
              updatePartner(index, "nome", event.target.value)
            }
          />
          <TextField
            fullWidth
            label={`CNPJ do parceiro ${index + 1}`}
            value={partner.cnpj}
            disabled={disabled}
            onChange={(event) =>
              updatePartner(index, "cnpj", event.target.value)
            }
          />
          <Button
            type="button"
            aria-label={`Remover parceiro ${index + 1}`}
            disabled={disabled}
            onClick={() =>
              onChange({
                supportPartners: supportPartners.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
                budgetItems,
                attachments,
              })
            }
          >
            Remover
          </Button>
        </Stack>
      ))}
      <Button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange({
            supportPartners: [...supportPartners, { nome: "", cnpj: "" }],
            budgetItems,
            attachments,
          })
        }
      >
        Adicionar parceiro
      </Button>

      <Typography variant="h6" component="h3">
        Orçamento
      </Typography>
      {budgetItems.map((item, index) => {
        const total =
          Math.round(
            Number(item.quantidade || 0) *
              Number(item.valorUnitario || 0) *
              100,
          ) / 100;
        return (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            key={`budget-${index}`}
          >
            <TextField
              fullWidth
              label={`Descrição do item ${index + 1}`}
              value={item.descricao}
              disabled={disabled}
              onChange={(event) =>
                updateBudget(index, "descricao", event.target.value)
              }
            />
            <TextField
              label="Quantidade"
              type="number"
              value={item.quantidade}
              disabled={disabled}
              onChange={(event) =>
                updateBudget(index, "quantidade", event.target.value)
              }
            />
            <TextField
              label="Unidade"
              value={item.unidadeMedida}
              disabled={disabled}
              onChange={(event) =>
                updateBudget(index, "unidadeMedida", event.target.value)
              }
            />
            <TextField
              label="Valor unitário"
              type="number"
              value={item.valorUnitario}
              disabled={disabled}
              onChange={(event) =>
                updateBudget(index, "valorUnitario", event.target.value)
              }
            />
            <TextField
              label={`Total do item ${index + 1}`}
              value={currency.format(total)}
              slotProps={{ htmlInput: { readOnly: true } }}
            />
            <Button
              type="button"
              aria-label={`Remover item ${index + 1}`}
              disabled={disabled}
              onClick={() =>
                onChange({
                  supportPartners,
                  budgetItems: budgetItems.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                  attachments,
                })
              }
            >
              Remover
            </Button>
          </Stack>
        );
      })}
      <Button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange({
            supportPartners,
            budgetItems: [
              ...budgetItems,
              {
                descricao: "",
                quantidade: "",
                unidadeMedida: "",
                valorUnitario: "",
              },
            ],
            attachments,
          })
        }
      >
        Adicionar item do orçamento
      </Button>

      <Typography variant="h6" component="h3">
        Anexos
      </Typography>
      {attachments.map((attachment, index) => (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          key={`attachment-${index}`}
        >
          <TextField
            fullWidth
            label={`URL do anexo ${index + 1}`}
            value={attachment}
            disabled={disabled}
            onChange={(event) => updateAttachment(index, event.target.value)}
            helperText="Use HTTPS; o backend valida o host permitido."
          />
          <Button
            type="button"
            aria-label={`Remover anexo ${index + 1}`}
            disabled={disabled}
            onClick={() =>
              onChange({
                supportPartners,
                budgetItems,
                attachments: attachments.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              })
            }
          >
            Remover
          </Button>
        </Stack>
      ))}
      <Button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange({
            supportPartners,
            budgetItems,
            attachments: [...attachments, ""],
          })
        }
      >
        Adicionar anexo
      </Button>
    </>
  );
}
