# Instruções do GitHub Copilot para CODAQUI

## Sobre o Projeto

O CODAQUI é uma organização educacional brasileira sem fins lucrativos (CNPJ 44.593.429/0001-05) com a missão de democratizar o aprendizado tecnológico e aproximar novas gerações do conteúdo técnico. O site institucional é gerado usando MkDocs e serve como plataforma central para a comunidade.

## Estrutura do Projeto

### Tecnologias Principais
- **MkDocs** com tema Material para geração do site estático
- **Python** como base do sistema de build
- **GitHub Actions** para CI/CD e deploy automático
- **Blog plugin** do MkDocs para gerenciamento de posts

### Organização de Arquivos
- `docs/` - Conteúdo principal do site em Markdown
- `docs/blog/posts/` - Posts do blog organizados por categorias
- `docs/trilhas/` - Conteúdo educacional estruturado (Python, GitHub)
- `overrides/` - Customizações do tema Material
- `mkdocs.yml` - Configuração principal do MkDocs

## Padrões e Convenções

### Conteúdo em Português
- **Todo conteúdo deve ser em português brasileiro**
- Use linguagem acessível e inclusiva
- Mantenha o tom educacional e acolhedor da comunidade

### Posts do Blog
Os posts devem seguir a estrutura de frontmatter:
```yaml
---
title: "Título do Post"
draft: false
date: YYYY-MM-DD
categories:
  - Institucional|Tutoriais|Projetos|Curiosidade
tags:
  - tag1
  - tag2
authors:
  - autor1
comments: true
---
```

### Convenções de Nomenclatura
- Arquivos de post: `YYYY_MM_DD_titulo_do_post.md`
- Imagens: organizadas em diretórios correspondentes ao post
- Branches: `feat/` para funcionalidades, `fix/` para correções

### Estrutura de Desenvolvimento
- `main` - Branch de produção (https://codaqui.dev)
- `develop` - Branch de desenvolvimento (https://raw.githack.com/codaqui/institucional/gh-pages-develop/index.html)
- Fluxo git-flow para desenvolvimento

## Ambiente de Desenvolvimento

### Configuração Local
```bash
# Criar ambiente virtual
python -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Configurar token GitHub (para plugins)
export GH_TOKEN=<TOKEN>

# Executar servidor local
mkdocs serve
```

### Dependências do Sistema
- **Ubuntu**: `apt-get install libcairo2-dev libfreetype6-dev libffi-dev libjpeg-dev libpng-dev libz-dev`
- **macOS**: `brew install cairo freetype libffi libjpeg libpng zlib`

## Funcionalidades do Site

### Seções Principais
- **Trilhas educacionais** - Conteúdo estruturado (Python, GitHub)
- **Blog** - Posts categorizados por tipo
- **Informações institucionais** - Equipe, ONG, código de conduta
- **Participação comunitária** - Como estudar, apoiar, mentoria

### Recursos Técnicos
- Sistema de comentários habilitado
- Analytics com Google Analytics
- Conformidade LGPD com consent de cookies
- Social cards automáticas
- Integração com redes sociais

## Comunidade e Canais

### Espaços de Comunicação
- **Site principal**: https://codaqui.dev
- **Discord**: Espaço para alunos
- **WhatsApp**: Comunidade geral
- **GitHub Discussions**: Discussões técnicas e propostas
- **Redes sociais**: Twitter, LinkedIn, Instagram, YouTube

### Fluxo de Contribuição
1. Discussão no GitHub → Issue técnica
2. Author da discussão cria PR
3. Branch `feat/` ou `fix/`
4. PR para `develop`

## Diretrizes para o Copilot

### Ao Trabalhar com Conteúdo
- **Sempre use português brasileiro**
- Mantenha o tom educacional e acessível
- Respeite a estrutura de frontmatter dos posts
- Verifique datas e metadados obrigatórios
- Preserve links e referências existentes

### Ao Fazer Alterações Técnicas
- Teste com `mkdocs serve` antes de commitar
- Verifique se não há erros de build
- Mantenha compatibilidade com plugins configurados
- Respeite a estrutura de navegação do `mkdocs.yml`

### Ao Trabalhar com Blog
- Use nomenclatura correta para arquivos
- Organize imagens nos diretórios apropriados
- Valide frontmatter obrigatório (title, date, categories, authors)
- Mantenha consistência nas categorias existentes

### Boas Práticas
- Prefira mudanças incrementais
- Documente alterações significativas
- Considere impacto na experiência do usuário
- Mantenha acessibilidade e performance
- Teste em diferentes dispositivos quando relevante

## Valores da Comunidade
- **Inclusão e diversidade** em tech
- **Aprendizado acessível** para todos
- **Colaboração** entre voluntários e alunos
- **Qualidade técnica** com propósito educacional
- **Transparência** como organização sem fins lucrativos