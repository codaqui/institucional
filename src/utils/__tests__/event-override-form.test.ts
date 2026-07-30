import {
  EMPTY_OVERRIDE_FORM,
  buildExtendData,
  buildSourceWildcardScope,
  computeCompleteness,
  formStateFromExtendData,
  isValidScope,
  type OverrideFormState,
} from "../event-override-form";

const filledForm: OverrideFormState = {
  title: "  Meetup de Mobile  ",
  summary: "Resumo corrigido.",
  imageUrl: "https://example.com/banner.png",
  location: "Auditório Central",
  tags: [" meetup ", "mobile", ""],
  featured: true,
  speakers: [
    {
      name: "  Ana Silva ",
      handle: " anasilva ",
      avatarUrl: "",
      talkTitle: "React Native na prática",
      profileUrl: "https://github.com/anasilva",
    },
    { name: "   " }, // descartado: sem nome
  ],
  registrationUrl: "https://meetup.com/evento",
  slidesUrl: "",
  videoUrl: "",
  discussionUrl: "",
  workloadMinutes: "",
};

describe("formStateFromExtendData", () => {
  it("retorna formulário vazio quando não há extendData", () => {
    expect(formStateFromExtendData(null)).toEqual(EMPTY_OVERRIDE_FORM);
    expect(formStateFromExtendData(undefined)).toEqual(EMPTY_OVERRIDE_FORM);
  });

  it("pré-preenche o formulário a partir do extendData", () => {
    const form = formStateFromExtendData({
      title: "Título",
      tags: ["a", "b"],
      featured: true,
      speakers: [{ name: "Ana" }],
    });
    expect(form.title).toBe("Título");
    expect(form.tags).toEqual(["a", "b"]);
    expect(form.featured).toBe(true);
    expect(form.speakers).toEqual([{ name: "Ana" }]);
    expect(form.summary).toBe("");
  });
});

describe("buildExtendData", () => {
  it("retorna objeto vazio para formulário vazio", () => {
    expect(buildExtendData(EMPTY_OVERRIDE_FORM)).toEqual({});
  });

  it("faz trim, remove vazios e omite featured=false", () => {
    const data = buildExtendData({ ...filledForm, featured: false });
    expect(data.title).toBe("Meetup de Mobile");
    expect(data.tags).toEqual(["meetup", "mobile"]);
    expect(data.featured).toBeUndefined();
    expect(data.slidesUrl).toBeUndefined();
    expect(data.speakers).toEqual([
      {
        name: "Ana Silva",
        handle: "anasilva",
        talkTitle: "React Native na prática",
        profileUrl: "https://github.com/anasilva",
      },
    ]);
  });

  it("inclui featured=true quando marcado", () => {
    expect(buildExtendData(filledForm).featured).toBe(true);
  });

  it("inclui workloadMinutes quando inteiro válido (0–1000)", () => {
    expect(buildExtendData({ ...filledForm, workloadMinutes: "240" }).workloadMinutes).toBe(240);
  });

  it.each(["", "0", "abc", "1001", "-5"])(
    "omite workloadMinutes inválido: '%s'",
    (value) => {
      expect(
        buildExtendData({ ...filledForm, workloadMinutes: value }).workloadMinutes
      ).toBeUndefined();
    }
  );

  it("pré-preenche workloadMinutes a partir do extendData", () => {
    expect(formStateFromExtendData({ workloadMinutes: 120 }).workloadMinutes).toBe("120");
    expect(formStateFromExtendData({ workloadMinutes: 0 }).workloadMinutes).toBe("");
  });
});

describe("computeCompleteness", () => {
  it("0% para formulário vazio", () => {
    const result = computeCompleteness(EMPTY_OVERRIDE_FORM);
    expect(result.percent).toBe(0);
    expect(result.items.every((i) => !i.done)).toBe(true);
  });

  it("conta itens preenchidos e detalha palestrantes", () => {
    const result = computeCompleteness(filledForm);
    // imagem, descrição, tags, palestrantes = 4 de 6
    expect(result.percent).toBe(67);
    const speakers = result.items.find((i) => i.key === "speakers");
    expect(speakers?.done).toBe(true);
    expect(speakers?.detail).toBe("1 adicionado(s)");
  });

  it("100% quando tudo está preenchido", () => {
    const result = computeCompleteness({
      ...filledForm,
      slidesUrl: "https://slides.com/x",
      videoUrl: "https://youtube.com/x",
    });
    expect(result.percent).toBe(100);
  });
});

describe("isValidScope", () => {
  it.each([
    "meetup:devparana:*",
    "discord:codaqui:1234567890",
    "sympla:elasnocodigo:3321444",
  ])("aceita scope válido: %s", (scope) => {
    expect(isValidScope(scope)).toBe(true);
  });

  it.each([
    "",
    "meetup",
    "meetup:devparana",
    "meetup::123",
    ":devparana:*",
    "meetup:devparana:",
    "meetup:devparana:123:extra",
    "meetup: devparana:*",
  ])("rejeita scope inválido: '%s'", (scope) => {
    expect(isValidScope(scope)).toBe(false);
  });
});

describe("buildSourceWildcardScope", () => {
  it("monta o scope coringa da fonte", () => {
    expect(buildSourceWildcardScope("meetup:devparana")).toBe("meetup:devparana:*");
  });
});
