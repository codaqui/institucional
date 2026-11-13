import {
  DEFAULT_TEMPLATES,
  isKnownTemplate,
  TEMPLATE_IDS,
} from './default-templates';

describe('default-templates', () => {
  it('cataloga os templates de eventos, certificados, mentoria e C4P', () => {
    expect(TEMPLATE_IDS).toEqual([
      'event-registration-confirmation',
      'event-registration-cancelled',
      'event-reminder-d1',
      'certificate-pending-registration',
      'event-post-event',
      'mentorship-requested',
      'mentorship-confirmed',
      'mentorship-reminder-d1',
      'mentorship-cancelled',
      'c4p-submission-confirmation',
      'c4p-evaluator-invite',
      'c4p-talk-result',
    ]);
    expect(isKnownTemplate('event-registration-cancelled')).toBe(true);
    expect(isKnownTemplate('template-inexistente')).toBe(false);
  });

  it('documenta as variáveis dos templates de C4P', () => {
    expect(DEFAULT_TEMPLATES['c4p-submission-confirmation'].variables).toEqual(
      expect.arrayContaining(['attendeeName', 'c4pCallName', 'c4pTalkTitle']),
    );
    expect(DEFAULT_TEMPLATES['c4p-evaluator-invite'].variables).toEqual(
      expect.arrayContaining(['attendeeName', 'c4pCallName', 'c4pActionUrl']),
    );
    expect(DEFAULT_TEMPLATES['c4p-talk-result'].variables).toEqual(
      expect.arrayContaining([
        'attendeeName',
        'c4pCallName',
        'c4pTalkTitle',
        'c4pResultStatus',
        'c4pActionUrl',
      ]),
    );
    for (const id of [
      'c4p-submission-confirmation',
      'c4p-evaluator-invite',
      'c4p-talk-result',
    ]) {
      const sample = DEFAULT_TEMPLATES[id].sample();
      expect(sample.c4pCallName).toBeTruthy();
    }
  });

  it('documenta o contexto real do e-mail de cancelamento', () => {
    expect(
      DEFAULT_TEMPLATES['event-registration-cancelled'].variables,
    ).toEqual(
      expect.arrayContaining([
        'attendeeName',
        'eventTitle',
        'eventStartAt',
        'eventTimeZone',
      ]),
    );
  });

  it('cada template tem subject, corpo e variáveis resolvidas pelo contexto de exemplo', () => {
    for (const id of TEMPLATE_IDS) {
      const def = DEFAULT_TEMPLATES[id];
      expect(def.subject.length).toBeGreaterThan(0);
      expect(def.bodyMarkdown.length).toBeGreaterThan(0);
      const sample = def.sample();
      // checkinUrl é derivada em tempo de render conforme membro/guest,
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
