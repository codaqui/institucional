# Plano de Migração: MkDocs → Zensical

**Data**: 2026-02-25
**Repositório**: codaqui/institucional
**Branch de trabalho**: feat/migration-to-zensical

---

## 1. Visão Geral

O [Zensical](https://github.com/zensical/zensical) é um gerador de sites estáticos moderno criado pelos mesmos desenvolvedores do [Material for MkDocs](https://github.com/squidfunk/mkdocs-material). Ele é construído com um núcleo em Rust (para performance) e uma camada Python para processamento de Markdown e compatibilidade com o ecossistema MkDocs.

O Zensical foi projetado para ser **retrocompatível** com projetos MkDocs existentes, suportando tanto o formato de configuração `mkdocs.yml` quanto o seu formato nativo `zensical.toml`.

---

## 2. Resumo Técnico de Compatibilidade

### 2.1 Formato de Configuração

| Aspecto | MkDocs (Atual) | Zensical | Compatibilidade |
|---|---|---|---|
| Arquivo de configuração | `mkdocs.yml` (YAML) | `zensical.toml` (TOML) ou `mkdocs.yml` | ✅ Total — O Zensical lê `mkdocs.yml` nativamente |
| Variáveis de ambiente (`!ENV`) | Suportado | Suportado (compatibilidade) | ✅ Total |
| Herança (`INHERIT`) | Suportado | Suportado (compatibilidade) | ✅ Total |
| Navegação (`nav`) | YAML list | TOML array ou YAML | ✅ Total |

### 2.2 Markdown e Extensões

| Extensão | Uso no Projeto | Suporte Zensical | Notas |
|---|---|---|---|
| `admonition` | ✅ | ✅ | Suportado via Python Markdown |
| `attr_list` | ✅ | ✅ | Suportado via Python Markdown |
| `md_in_html` | ✅ | ✅ | Suportado via Python Markdown |
| `def_list` | ✅ | ✅ | Suportado via Python Markdown |
| `pymdownx.tasklist` | ✅ | ✅ | pymdown-extensions é dependência do Zensical |
| `pymdownx.emoji` | ✅ | ✅ | Namespace remapeado automaticamente (`material.extensions` → `zensical.extensions`) |
| `pymdownx.highlight` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.inlinehilite` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.snippets` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.superfences` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.details` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.critic` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.caret` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.keys` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.mark` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.tilde` | ✅ | ✅ | Suportado via pymdown-extensions |
| `pymdownx.tabbed` | ✅ | ✅ | Suportado via pymdown-extensions |
| `footnotes` | ✅ | ✅ | Suportado via Python Markdown |

### 2.3 Plugins

| Plugin | Uso no Projeto | Suporte Zensical | Notas |
|---|---|---|---|
| `search` | ✅ | ✅ | Zensical possui extensão de busca nativa (`zensical.extensions.search`) |
| `meta` | ✅ | ✅ | Metadados são processados via front matter YAML nativo |
| `tags` | ✅ | ⚠️ A verificar | Pode exigir adaptação ou substituição |
| `social` | ✅ | ⚠️ A verificar | Cards de compartilhamento social podem não estar disponíveis ainda |
| `blog` | ✅ | ⚠️ A verificar | O sistema de blog do Material for MkDocs pode ainda não ter equivalente nativo no Zensical |
| `git-committers` | ✅ | ❌ Não suportado | Zensical não possui sistema de plugins MkDocs — funcionalidades Git devem ser tratadas de forma diferente |

### 2.4 Tema e Funcionalidades

| Recurso | MkDocs Material (Atual) | Zensical | Compatibilidade |
|---|---|---|---|
| Tema Material | `theme: material` | Herdeiro do Material for MkDocs | ✅ Total — Templates próprios baseados no Material |
| `custom_dir` (overrides) | `overrides/` | Suportado | ✅ Total |
| Paleta de cores | `palette.primary: black` | Suportado (esquemas `default` / `slate`) | ⚠️ Parcial — Sistema de paletas diferente |
| Navegação: tabs, sticky, sections | ✅ | ✅ | Mesmos feature flags |
| Code annotations | ✅ | ✅ | Suportado |
| Code copy | ✅ | ✅ | Suportado |
| Ícones (FontAwesome, Octicons) | ✅ | ✅ | Zensical também suporta Lucide icons |
| Google Analytics | ✅ | ⚠️ A verificar | Pode precisar de configuração manual |
| Consent (LGPD) | ✅ | ⚠️ A verificar | Funcionalidade pode não estar disponível |
| Feedback | ✅ | ⚠️ A verificar | Funcionalidade pode não estar disponível |

---

## 3. Análise de Lacunas (Gap Analysis)

### 3.1 Funcionalidades sem Suporte Direto

1. **Plugin `blog`**: O blog do Material for MkDocs é um plugin complexo com sistema de posts, categorias, tags, autores e arquivo. O Zensical ainda está em fase Alpha e pode não ter equivalente nativo. **Impacto: Alto** — O blog é uma funcionalidade central do site.

2. **Plugin `git-committers`**: Exibe contribuidores nas páginas. O Zensical não implementa sistema de plugins compatível com MkDocs. **Impacto: Médio** — Informação de contribuidores ficaria indisponível.

3. **Plugin `social`**: Gera cards de compartilhamento social (Open Graph). **Impacto: Baixo** — Funcionalidade de SEO.

4. **Plugin `tags`**: Sistema de tags para organização de conteúdo. **Impacto: Baixo** — Usado principalmente no blog.

5. **Google Analytics e Consent (LGPD)**: A configuração `extra.analytics` e `extra.consent` pode necessitar de adaptação manual nos templates. **Impacto: Médio**.

6. **Feedback ratings**: O sistema de feedback ("Esta página foi útil?") pode não estar disponível. **Impacto: Baixo**.

### 3.2 Funcionalidades com Compatibilidade Automática

1. **Namespace de emoji**: O Zensical remapeia automaticamente `material.extensions.emoji` → `zensical.extensions.emoji` durante o parsing do `mkdocs.yml`.

2. **Variáveis de ambiente (`!ENV`)**: Suportado para retrocompatibilidade, embora o Zensical pretenda usar abordagem diferente no futuro.

3. **Extensões Markdown (pymdownx)**: Todas as extensões pymdownx usadas no projeto são dependências diretas do Zensical.

4. **Navegação (`nav`)**: Totalmente compatível tanto em formato YAML quanto TOML.

---

## 4. Mudanças Necessárias

### 4.1 Arquivo de Configuração (`mkdocs.yml`)

**Opção A — Manter `mkdocs.yml` (menor esforço):**
O Zensical pode ler o `mkdocs.yml` diretamente. Ajustes necessários:

```yaml
# Remover ou desabilitar plugins sem suporte:
plugins:
  - search
  # - meta        # Removido — front matter processado nativamente
  # - tags        # Removido — sem equivalente confirmado
  # - social      # Removido — sem equivalente confirmado
  # - blog        # Removido — sem equivalente confirmado (IMPACTO ALTO)
  # - git-committers  # Removido — sem sistema de plugins

# Emoji namespace será remapeado automaticamente, mas pode ser atualizado:
  - pymdownx.emoji:
      emoji_index: !!python/name:zensical.extensions.emoji.twemoji
      emoji_generator: !!python/name:zensical.extensions.emoji.to_svg
```

**Opção B — Migrar para `zensical.toml` (recomendado a longo prazo):**
Criar um arquivo `zensical.toml` equivalente ao `mkdocs.yml` atual. Exemplo parcial:

```toml
[project]
site_name = "CODAQUI.dev"
site_author = "codaqui // endersonmenezes"
site_url = "https://codaqui.dev/"
site_description = "Queremos democratizar o aprendizado tecnológico."
copyright = "Codaqui © Copyright - 2024 - Todos os direitos reservados - CNPJ 44.593.429/0001-05"

nav = [
  { "Inicio" = "index.md" },
  { "Sobre" = [
    { "Equipe" = "team.md" },
    { "Associação" = "ong.md" },
    { "Linha do Tempo" = "timeline.md" },
    { "Pais e Responsáveis" = "pais_responsaveis.md" },
    { "Código de Conduta" = "conduta.md" },
  ]},
  # ... demais itens de navegação
]

extra_css = ["stylesheets/extra.css"]

[project.theme]
language = "pt"
custom_dir = "overrides"
features = [
  "navigation.tabs",
  "navigation.tabs.sticky",
  "navigation.indexes",
  "navigation.top",
  "navigation.sections",
  "navigation.path",
  "content.code.annotate",
  "content.tabs.link",
  "content.code.copy",
]

[[project.theme.palette]]
primary = "black"

[project.theme.icon]
repo = "fontawesome/brands/github"

[[project.extra.social]]
icon = "fontawesome/brands/github-alt"
link = "https://github.com/codaqui"

[[project.extra.social]]
icon = "fontawesome/brands/twitter"
link = "https://twitter.com/codaquidev"

[[project.extra.social]]
icon = "fontawesome/brands/linkedin"
link = "https://www.linkedin.com/company/codaqui"

[[project.extra.social]]
icon = "fontawesome/brands/instagram"
link = "https://instagram.com/codaqui.dev"

[[project.extra.social]]
icon = "fontawesome/brands/youtube"
link = "https://youtube.com/@codaqui"
```

### 4.2 Requisitos de Versão

| Requisito | Versão Atual (Codaqui) | Requisito Zensical |
|---|---|---|
| Python | 3.11 | ≥ 3.10 ✅ |
| Rust | N/A | ≥ 1.86 (necessário para build) |
| Node.js | N/A | Não requerido |
| `mkdocs` | Instalado via pip | Substituído pelo `zensical` |
| `mkdocs-material` | Implícito (tema) | Substituído pelo tema nativo do Zensical |
| `pymdown-extensions` | Implícito | ≥ 10.15 (dependência do Zensical) |
| `pillow` | Listado em requirements.txt | Pode não ser necessário (social cards) |
| `cairosvg` | Listado em requirements.txt | Pode não ser necessário (social cards) |
| `mkdocs-git-authors-plugin` | Listado (desabilitado) | Não necessário |
| `mkdocs-git-committers-plugin-2` | Listado (ativo) | Sem equivalente |
| `mkdocs-git-revision-date-localized-plugin` | Listado (desabilitado) | Sem equivalente |

### 4.3 Mudanças no `requirements.txt`

```txt
# Antes (MkDocs)
mkdocs
mkdocs-git-authors-plugin
mkdocs-git-committers-plugin-2
mkdocs-git-revision-date-localized-plugin
pillow
cairosvg

# Depois (Zensical)
zensical
# pillow    — Remover se social cards não forem necessários
# cairosvg  — Remover se social cards não forem necessários
```

### 4.4 Ajustes na Estrutura de Pastas

| Item | Mudança Necessária |
|---|---|
| `/docs/` | ✅ Nenhuma — Zensical usa `docs_dir` padrão como o MkDocs |
| `/overrides/` | ✅ Nenhuma — `custom_dir` é suportado |
| `/docs/blog/` | ⚠️ **Precisa avaliação** — O sistema de blog pode precisar de reestruturação |
| `/docs/blog/.authors.yml` | ⚠️ Possivelmente incompatível sem plugin `blog` |
| `/docs/blog/posts/` | ⚠️ Posts com front matter podem precisar de ajuste |
| `/docs/assets/` | ✅ Nenhuma — Assets relativos funcionam normalmente |
| `/docs/stylesheets/` | ✅ Nenhuma — CSS customizado via `extra_css` |
| `CNAME` | ✅ Nenhuma — Arquivo de domínio independente do gerador |

### 4.5 Mudanças no CI/CD (GitHub Actions)

O workflow de deploy deve ser atualizado para:

```yaml
# Antes
- run: pip install -r requirements.txt
- run: mkdocs build

# Depois
- run: pip install zensical
- run: zensical build
```

O comando `zensical build` aceita a flag `--config-file` (ou `-f`) e a flag `--strict` (embora strict esteja atualmente sem suporte completo).

---

## 5. Riscos e Recomendações

### 5.1 Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Zensical em fase Alpha (status 3 - Alpha) | 🔴 Alta | Aguardar versão Beta/Stable antes de migrar produção |
| Blog sem suporte nativo | 🔴 Alta | Manter MkDocs para blog ou implementar solução alternativa |
| Plugins MkDocs incompatíveis | 🟡 Média | Avaliar funcionalidades essenciais vs. desejáveis |
| Templates customizados (`overrides/`) podem quebrar | 🟡 Média | Testar templates contra o sistema de templating do Zensical (Minijinja) |
| Perda de contribuidores (`git-committers`) | 🟡 Média | Implementar solução customizada ou aceitar perda |

### 5.2 Recomendações

1. **Aguardar maturidade**: O Zensical está em fase Alpha. Recomenda-se aguardar pelo menos uma versão Beta estável antes de migrar o site de produção.

2. **Teste paralelo**: Instalar o Zensical localmente e rodar `zensical serve` no projeto atual para avaliar quais funcionalidades funcionam sem modificação.

3. **Migração incremental**:
   - **Fase 1**: Testar build com `mkdocs.yml` existente (sem mudanças).
   - **Fase 2**: Remover plugins incompatíveis e avaliar impacto.
   - **Fase 3**: Migrar para `zensical.toml` (opcional).
   - **Fase 4**: Adaptar blog e funcionalidades customizadas.

4. **Manter fallback**: Manter o `mkdocs.yml` funcional durante todo o processo de migração para poder reverter rapidamente se necessário.

---

## 6. Comandos de Referência

```bash
# Instalar Zensical
pip install zensical

# Build do projeto (lê mkdocs.yml ou zensical.toml automaticamente)
zensical build

# Servir localmente com live-reload
zensical serve

# Servir em porta/endereço específico
zensical serve --dev-addr=0.0.0.0:8000

# Criar novo projeto Zensical (referência)
zensical new meu-projeto
```

---

## 7. Conclusão

A migração de MkDocs para Zensical é **tecnicamente viável** para a maior parte do site institucional da Codaqui. O Zensical foi projetado com retrocompatibilidade com MkDocs, suportando o formato `mkdocs.yml` nativamente e incluindo todas as extensões Markdown utilizadas no projeto.

Os **principais bloqueios** são:
- O sistema de **blog** (plugin `blog` do Material for MkDocs) que é uma funcionalidade central do site
- O plugin **`git-committers`** para exibição de contribuidores
- A **maturidade** do projeto (ainda em fase Alpha)

**Recomendação final**: Monitorar o roadmap do Zensical e planejar a migração para quando o suporte a blog e funcionalidades equivalentes aos plugins utilizados estiverem disponíveis, ou quando o projeto atingir maturidade Beta/Stable.
