import {
  DEFAULT_TEMPLATES,
  isKnownTemplate,
  TEMPLATE_IDS,
} from './default-templates';

describe('default-templates', () => {
  it('cataloga exatamente os 3 templates de e-mail conhecidos', () => {
    expect(TEMPLATE_IDS).toEqual([
      'event-registration-confirmation',
      'event-reminder-d1',
      'event-post-event',
    ]);
    expect(isKnownTemplate('event-registration-confirmation')).toBe(true);
    expect(isKnownTemplate('template-inexistente')).toBe(false);
  });

  it('cada template tem subject, corpo e variáveis resolvidas pelo contexto de exemplo', () => {
    for (const id of TEMPLATE_IDS) {
      const def = DEFAULT_TEMPLATES[id];
      expect(def.subject.length).toBeGreaterThan(0);
      expect(def.bodyMarkdown.length).toBeGreaterThan(0);
      const sample = def.sample();
      // checkinUrl é derivada em tempo de render (FRONTEND_URL + /membro),
      // não é propriedade do EmailTemplateContext.
      const sampleKeys = new Set([...Object.keys(sample), 'checkinUrl']);
      for (const variable of def.variables) {
        if (!sampleKeys.has(variable)) {
          throw new Error(`${id}: variável "${variable}" ausente no sample`);
        }
      }
      // nenhuma variável solta no markdown
      const leftovers =
        (def.bodyMarkdown + def.subject).match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ??
        [];
      for (const token of leftovers) {
        const key = token.replace(/\{\{\s*|\s*\}\}/g, '');
        if (!def.variables.includes(key)) {
          throw new Error(`${id}: {{${key}}} usada mas não declarada`);
        }
      }
    }
  });
});
