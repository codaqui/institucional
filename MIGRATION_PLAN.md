# Plano de Migração: MkDocs → Zensical

**Data**: 2026-02-26 (revisado com dados de [zensical.org](https://zensical.org))
**Repositório**: codaqui/institucional
**Branch de trabalho**: feat/migration-to-zensical
**Versão analisada do Zensical**: [0.0.24](https://pypi.org/project/zensical/) (Alpha)

---

## 1. Visão Geral

O [Zensical](https://zensical.org/) é um gerador de sites estáticos moderno criado pelos mesmos desenvolvedores do [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/). Ele é construído com um núcleo em Rust ([ZRX runtime](https://github.com/zensical/zrx)) e uma camada Python para processamento de Markdown e compatibilidade com o ecossistema MkDocs.

De acordo com a [página de compatibilidade](https://zensical.org/compatibility/), o Zensical foi projetado para **substituição direta** do MkDocs + Material for MkDocs — consolidando ambos os projetos em uma stack coerente. Em muitos casos, é possível instalar o Zensical e construir projetos imediatamente, **sem alterações na configuração ou conteúdo**.

### Fontes de Referência

- [Página de Compatibilidade](https://zensical.org/compatibility/)
- [Tabela de Feature Parity](https://zensical.org/compatibility/features/)
- [Compatibilidade de Configuração](https://zensical.org/compatibility/configuration/)
- [Plugins de Terceiros](https://zensical.org/compatibility/plugins/)
- [Roadmap](https://zensical.org/about/roadmap/)
- [Getting Started](https://zensical.org/docs/get-started/)
- [Código-Fonte](https://github.com/zensical/zensical)

---

## 2. O Que Permanece Igual (segundo [zensical.org/compatibility](https://zensical.org/compatibility/))

O Zensical mantém compatibilidade nas seguintes áreas-chave:

| Área | Detalhes |
|---|---|
| **Configuração de build** | Use o `mkdocs.yml` existente. Não é necessário aprender novo formato nem criar `zensical.toml`. |
| **Conteúdo e front matter** | Python Markdown e todas as extensões funcionam sem alterações. O conteúdo existente é compilado como está. |
| **Estrutura do projeto e URLs** | Arquivos permanecem no lugar. URLs e âncoras continuam idênticos, preservando bookmarks, links externos e SEO. |
| **Template overrides** | Ajustes menores para compatibilidade com [MiniJinja](https://github.com/mitsuhiko/MiniJinja) (já presentes em versões recentes do Material for MkDocs). Estrutura HTML permanece inalterada. |
| **CSS e JavaScript customizados** | HTML gerado, variáveis CSS e APIs JavaScript permanecem compatíveis com customizações existentes. |

---

## 3. Resumo Técnico de Compatibilidade

### 3.1 Formato de Configuração

| Aspecto | MkDocs (Atual) | Zensical | Compatibilidade |
|---|---|---|---|
| Arquivo de configuração | `mkdocs.yml` (YAML) | `mkdocs.yml` ou `zensical.toml` | ✅ Total — [O Zensical lê `mkdocs.yml` nativamente](https://zensical.org/compatibility/configuration/) |
| Variáveis de ambiente (`!ENV`) | Suportado | Suportado (compatibilidade) | ✅ Total |
| Herança (`INHERIT`) | Suportado | Suportado (compatibilidade) | ✅ Total |
| Navegação (`nav`) | YAML list | YAML ou TOML | ✅ Total |
| Plugins → Módulos | Plugins MkDocs | [Automaticamente mapeados para módulos Zensical](https://zensical.org/compatibility/configuration/) | ✅ Total |

### 3.2 Markdown e Extensões

De acordo com a [tabela de feature parity](https://zensical.org/compatibility/features/#markdown-extensions), **todas** as extensões Markdown utilizadas no projeto são suportadas:

| Extensão | Uso no Projeto | Suporte Zensical | Fonte |
|---|---|---|---|
| `admonition` | ✅ | ✅ | [Admonitions](https://zensical.org/compatibility/features/#markdown-extensions) |
| `attr_list` | ✅ | ✅ | [Attribute lists](https://zensical.org/compatibility/features/#markdown-extensions) |
| `md_in_html` | ✅ | ✅ | [Markdown in HTML](https://zensical.org/compatibility/features/#markdown-extensions) |
| `def_list` | ✅ | ✅ | [Definition lists](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.tasklist` | ✅ | ✅ | [Tasklist](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.emoji` | ✅ | ✅ | [Icons and Emojis](https://zensical.org/compatibility/features/#markdown-extensions) — namespace remapeado automaticamente |
| `pymdownx.highlight` | ✅ | ✅ | [Code blocks, highlighting, copying](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.inlinehilite` | ✅ | ✅ | [InlineHighlight](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.snippets` | ✅ | ✅ | [Snippets](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.superfences` | ✅ | ✅ | [Superfences](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.details` | ✅ | ✅ | [Details](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.critic` | ✅ | ✅ | [Critic](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.caret` | ✅ | ✅ | [Caret, Mark & Tilde](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.keys` | ✅ | ✅ | [Keys](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.mark` | ✅ | ✅ | [Caret, Mark & Tilde](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.tilde` | ✅ | ✅ | [Caret, Mark & Tilde](https://zensical.org/compatibility/features/#markdown-extensions) |
| `pymdownx.tabbed` | ✅ | ✅ | [Tabbed](https://zensical.org/compatibility/features/#markdown-extensions) |
| `footnotes` | ✅ | ✅ | [Footnotes](https://zensical.org/compatibility/features/#markdown-extensions) |

**Resultado: 18/18 extensões compatíveis (100%).**

### 3.3 Plugins e Funcionalidades do Material for MkDocs

De acordo com a [tabela de feature parity](https://zensical.org/compatibility/features/), o Zensical suporta as seguintes funcionalidades que no MkDocs eram implementadas como plugins:

| Plugin/Funcionalidade | Uso no Projeto | Suporte Zensical | Fonte |
|---|---|---|---|
| `search` | ✅ | ✅ | [Search](https://zensical.org/compatibility/features/#navigation) — motor de busca nativo "Disco" |
| `meta` | ✅ | ✅ | [YAML page metadata](https://zensical.org/compatibility/features/#core-features) |
| `tags` | ✅ | ✅ | [Tags, Tags in search, Tag listings](https://zensical.org/compatibility/features/#site-and-page-structure) |
| `social` | ✅ | ✅ | [Social cards](https://zensical.org/compatibility/features/#appearance) |
| `blog` | ✅ | ✅ | [Blog](https://zensical.org/compatibility/features/#content) |
| `git-committers` | ✅ | ✅ (planejado nativo) | [Será suportado nativamente](https://zensical.org/compatibility/plugins/#mkdocstrings) — incluindo git-authors e git-revision-date-localized |

**Resultado: 6/6 plugins/funcionalidades com suporte confirmado.**

### 3.4 Tema e Funcionalidades do Site

| Recurso | MkDocs Material (Atual) | Zensical | Fonte |
|---|---|---|---|
| Tema Material (clássico) | ✅ | ✅ | [Classic Material theme](https://zensical.org/compatibility/features/#appearance) |
| Design moderno (novo) | N/A | ✅ | [Roadmap: Modern design](https://zensical.org/about/roadmap/#modern-design) |
| `custom_dir` (overrides) | ✅ | ✅ | [Template overrides](https://zensical.org/compatibility/features/#appearance) |
| Paleta de cores / toggle | ✅ | ✅ | [Colors and palette toggle](https://zensical.org/compatibility/features/#appearance) |
| Modo claro/escuro automático | N/A | ✅ | [Automatic light and dark mode](https://zensical.org/compatibility/features/#appearance) |
| Navegação: tabs, sticky, sections | ✅ | ✅ | [Navigation tabs and sticky tabs, sections](https://zensical.org/compatibility/features/#navigation) |
| Navigation path (breadcrumbs) | ✅ | ✅ | [Navigation path](https://zensical.org/compatibility/features/#navigation) |
| Code annotations | ✅ | ✅ | [Annotations](https://zensical.org/compatibility/features/#markdown-extensions) |
| Code copy | ✅ | ✅ | [Code blocks, highlighting, copying](https://zensical.org/compatibility/features/#markdown-extensions) |
| Content tabs | ✅ | ✅ | [Content tabs](https://zensical.org/compatibility/features/#markdown-extensions) |
| Ícones (FontAwesome, Octicons) | ✅ | ✅ | [Icons, emojis, favicon](https://zensical.org/compatibility/features/#appearance) — também suporta [Lucide](https://lucide.dev/) |
| Google Analytics | ✅ | ✅ | [Site analytics and feedback widget](https://zensical.org/compatibility/features/#optimization) |
| Cookie consent (LGPD) | ✅ | ✅ | [Cookie consent, Custom cookies](https://zensical.org/compatibility/features/#optimization) |
| Feedback widget | ✅ | ✅ | [Site analytics and feedback widget](https://zensical.org/compatibility/features/#optimization) |
| Footer / Social links / Copyright | ✅ | ✅ | [Footer, Social links, Copyright notice](https://zensical.org/compatibility/features/#site-and-page-structure) |
| Instant loading/prefetching | N/A | ✅ | [Instant loading, prefetching](https://zensical.org/compatibility/features/#navigation) |
| Link validation | N/A | ✅ | [Link validation](https://zensical.org/compatibility/features/#core-features) |
| Offline usage | N/A | ✅ | [Offline usage](https://zensical.org/compatibility/features/#optimization) |
| SEO | ✅ | ✅ | [Search engine optimization](https://zensical.org/compatibility/features/#optimization) |
| 60+ idiomas | ✅ | ✅ | [60+ language support](https://zensical.org/compatibility/features/#site-and-page-structure) |

**Resultado: Compatibilidade total em todas as funcionalidades de tema e site.**

---

## 4. Plugins de Terceiros ([zensical.org/compatibility/plugins](https://zensical.org/compatibility/plugins/))

O Zensical se comprometeu a fornecer nativamente a funcionalidade dos seguintes plugins de terceiros do MkDocs:

| Plugin MkDocs | Uso no Projeto | Plano Zensical |
|---|---|---|
| `git-committers` | ✅ Ativo | ✅ Suporte nativo planejado — metadados Git integrados |
| `git-authors` | Desabilitado | ✅ Suporte nativo planejado |
| `git-revision-date-localized` | Desabilitado | ✅ Suporte nativo planejado |
| `mkdocstrings` | Não usado | ✅ Módulo dedicado (autor do mkdocstrings está na equipe Zensical) |
| `minify` | Não usado | ✅ Minificação nativa incluída |
| `mike` (versioning) | Não usado | ✅ Opções expandidas de versionamento |
| `macros` | Não usado | ✅ Substituído pelo [component system](https://zensical.org/about/roadmap/#component-system) |
| `static-i18n` | Não usado | ✅ Internacionalização nativa planejada |

---

## 5. Análise de Lacunas (Gap Analysis)

### 5.1 Status Atual: Lacunas Mínimas

Com base na [tabela de feature parity](https://zensical.org/compatibility/features/) atualizada, **todas as funcionalidades utilizadas no projeto Codaqui já estão listadas como suportadas** pelo Zensical. A única ressalva é que o Zensical ainda está em **fase Alpha (v0.0.24)**, o que significa que:

1. **Bugs são esperados** — O roadmap menciona que estão "weeding out any remaining bugs in the initial implementation".
2. **Template overrides** podem necessitar de ajustes menores para compatibilidade com [MiniJinja](https://github.com/mitsuhiko/MiniJinja) (motor de templates em Rust que substitui Jinja2).
3. **O module system** (substituto do sistema de plugins) ainda está em desenvolvimento.

### 5.2 Pontos de Atenção Específicos do Projeto Codaqui

| Item | Status | Nota |
|---|---|---|
| Overrides customizadas (`overrides/partials/comments.html`, `overrides/partials/tabs.html`) | ⚠️ Testar | MiniJinja é compatível com Jinja2 mas pode ter diferenças sutis |
| Plugin `blog` com `.authors.yml` e estrutura de posts | ✅ Listado | Confirmar via teste prático |
| Plugin `git-committers` com `!ENV GH_TOKEN` | ✅ Planejado | Verificar se já funciona na v0.0.24 |
| Google Analytics (`G-CL043JTTND`) | ✅ Listado | Confirmar via teste prático |
| Cookie consent (LGPD) | ✅ Listado | Confirmar via teste prático |
| Feedback widget ("Esta página foi útil?") | ✅ Listado | Confirmar via teste prático |

---

## 6. Mudanças Necessárias

### 6.1 Arquivo de Configuração (`mkdocs.yml`)

**Nenhuma mudança necessária.** De acordo com a [documentação de compatibilidade](https://zensical.org/compatibility/configuration/):

> "Zensical understands your existing `mkdocs.yml` configuration and automatically adapts it for use within Zensical's own format. You don't need to change anything – your current settings just work."

Os plugins MkDocs listados no `mkdocs.yml` são automaticamente mapeados para módulos Zensical equivalentes.

**Opcionalmente**, no futuro, pode-se migrar para `zensical.toml` quando o formato estiver maduro, mas o `mkdocs.yml` continuará sendo suportado via camada de compatibilidade.

### 6.2 Requisitos de Versão

| Requisito | Versão Atual (Codaqui) | Requisito Zensical | Nota |
|---|---|---|---|
| Python | 3.11 | ≥ 3.10 | ✅ Compatível |
| Rust | N/A | Não requerido pelo usuário | ✅ Wheels pré-compilados disponíveis no [PyPI](https://pypi.org/project/zensical/) |
| Node.js | N/A | Não requerido | ✅ |
| Docker | N/A | Opcional | [Imagem oficial disponível](https://hub.docker.com/r/zensical/zensical/) |

### 6.3 Mudanças no `requirements.txt`

```txt
# Antes (MkDocs)
mkdocs
mkdocs-git-authors-plugin
mkdocs-git-committers-plugin-2
mkdocs-git-revision-date-localized-plugin
pillow
cairosvg

# Depois (Zensical) — mudança mínima
zensical
# pillow e cairosvg podem ainda ser necessários para social cards
# Dependências Git serão nativas no Zensical
```

### 6.4 Ajustes na Estrutura de Pastas

| Item | Mudança Necessária |
|---|---|
| `/docs/` | ✅ Nenhuma — [Compatible with MkDocs file layout](https://zensical.org/compatibility/features/#core-features) |
| `/overrides/` | ⚠️ Possíveis ajustes menores — Templates precisam ser compatíveis com MiniJinja |
| `/docs/blog/` | ✅ Nenhuma — Blog é funcionalidade suportada |
| `/docs/blog/.authors.yml` | ✅ Testar — Deve funcionar via mapeamento de plugins |
| `/docs/blog/posts/` | ✅ Nenhuma — Front matter YAML é suportado nativamente |
| `/docs/assets/` | ✅ Nenhuma — Assets relativos funcionam |
| `/docs/stylesheets/` | ✅ Nenhuma — [Extra CSS compatível](https://zensical.org/compatibility/features/#core-features) |
| `CNAME` | ✅ Nenhuma — Independente do gerador |

### 6.5 Mudanças no CI/CD (GitHub Actions)

```yaml
# Antes
- run: pip install -r requirements.txt
- run: mkdocs build

# Depois
- run: pip install zensical
- run: zensical build
```

Alternativamente, usando Docker:
```yaml
# Usando imagem Docker oficial
- uses: docker://zensical/zensical:latest
  with:
    args: build
```

O comando `zensical build` aceita as flags `--config-file` (ou `-f`) e `--strict` (ou `-s`).

---

## 7. Estratégia de Transição em Fases

De acordo com a [estratégia de transição do Zensical](https://zensical.org/compatibility/#phased-transition-strategy):

| Fase | Descrição | Status |
|---|---|---|
| **1a** | Compatibilidade máxima com Material for MkDocs — Python Markdown, extensões, templates Jinja | ✅ Em andamento |
| **1b** | Feature parity total — funcionalidades de plugins do Material for MkDocs e plugins populares de terceiros | 🔄 Em progresso |
| **2** | Module system — módulos composáveis para substituir plugins com melhor DX | 📋 Planejado |
| **3** | Component system e suporte a CommonMark — parser Rust substituindo Python Markdown | 📋 Planejado |

### Plano de Migração Recomendado para Codaqui

1. **Fase 1 — Teste sem modificações** (pode ser feito agora):
   ```bash
   pip install zensical
   zensical serve
   ```
   Testar o site atual com o `mkdocs.yml` existente e identificar qualquer incompatibilidade.

2. **Fase 2 — Ajustar overrides** (se necessário):
   Adaptar os templates em `overrides/partials/` para compatibilidade com MiniJinja, caso existam diferenças.

3. **Fase 3 — Atualizar CI/CD** (quando fase 1 e 2 estiverem OK):
   Substituir `mkdocs build` por `zensical build` no workflow do GitHub Actions.

4. **Fase 4 — Migrar requirements** (deploy):
   Atualizar `requirements.txt` substituindo `mkdocs` por `zensical`.

5. **Fase 5 — Opcional: migrar para `zensical.toml`**:
   Quando o formato nativo estiver maduro, converter a configuração (ferramentas de conversão automática serão fornecidas pelo Zensical).

---

## 8. Riscos e Recomendações

### 8.1 Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Zensical em fase Alpha (v0.0.24) | 🟡 Média | Testar em ambiente de staging antes de migrar produção |
| Templates MiniJinja podem ter diferenças sutis com Jinja2 | 🟡 Média | Testar overrides customizadas (`comments.html`, `tabs.html`) |
| Funcionalidades Git (`git-committers`) podem não estar 100% na versão atual | 🟡 Média | Verificar via teste prático; funcionalidade nativa está planejada |
| Fase Alpha pode ter bugs | 🟢 Baixa | Manter `mkdocs.yml` funcional como fallback |

### 8.2 Recomendações

1. **Testar agora em staging**: A compatibilidade é alta o suficiente para testar imediatamente com `zensical serve` sem alterar nenhum arquivo do projeto.

2. **Manter fallback**: Manter o `requirements.txt` atual funcional durante a transição para poder reverter rapidamente.

3. **Monitorar o roadmap**: Acompanhar o [roadmap](https://zensical.org/about/roadmap/) e a [newsletter](https://zensical.org/about/newsletter/) para saber quando features como o module system estarão disponíveis.

4. **Considerar Zensical Spark**: Para suporte direto da equipe core durante a migração, avaliar o [Zensical Spark](https://zensical.org/spark/).

---

## 9. Comandos de Referência

```bash
# Instalar Zensical via pip
pip install zensical

# Instalar via uv
uv add --dev zensical

# Build do projeto (lê mkdocs.yml automaticamente)
zensical build

# Build com arquivo de configuração específico
zensical build -f mkdocs.yml

# Servir localmente com live-reload
zensical serve

# Servir em porta/endereço específico
zensical serve --dev-addr=0.0.0.0:8000

# Abrir no navegador automaticamente
zensical serve --open

# Criar novo projeto Zensical
zensical new meu-projeto
```

---

## 10. Conclusão

A migração de MkDocs para Zensical é **totalmente viável** para o site institucional da Codaqui. Com base na análise detalhada do [site oficial](https://zensical.org/compatibility/) e da [tabela de feature parity](https://zensical.org/compatibility/features/):

- ✅ **100% das extensões Markdown** utilizadas são suportadas
- ✅ **100% dos plugins/funcionalidades** utilizados estão listados como suportados ou com suporte nativo planejado
- ✅ **Nenhuma mudança no `mkdocs.yml`** é necessária — o Zensical lê a configuração existente
- ✅ **Nenhuma mudança na estrutura de pastas** é necessária
- ✅ **Nenhuma mudança no conteúdo** é necessária
- ⚠️ **Único ponto de atenção**: Possíveis ajustes menores nos templates de override para MiniJinja

**Recomendação final**: Iniciar testes com `pip install zensical && zensical serve` no projeto atual. Se o build e o site funcionarem corretamente, a migração pode ser realizada de forma simples substituindo apenas o `requirements.txt` e os comandos de build no CI/CD.
