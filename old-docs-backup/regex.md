---
hide:
  - navigation
  - toc
---
# Expressões Regulares (Regex)

## O que são Expressões Regulares?

As **Expressões Regulares** (ou **Regex**) são sequências de caracteres que formam um padrão de busca. Elas são uma ferramenta poderosa para encontrar, validar, extrair e manipular texto de forma precisa e eficiente.

## Conceitos Básicos

### Metacaracteres Fundamentais

- **`.`** - Corresponde a qualquer caractere (exceto quebra de linha)
- **`*`** - Zero ou mais ocorrências do caractere anterior
- **`+`** - Uma ou mais ocorrências do caractere anterior
- **`?`** - Zero ou uma ocorrência do caractere anterior
- **`^`** - Início da linha
- **`$`** - Fim da linha
- **`[]`** - Conjunto de caracteres
- **`()`** - Grupo de captura
- **`|`** - Operador OU

### Classes de Caracteres

- **`\d`** - Qualquer dígito (0-9)
- **`\w`** - Qualquer caractere de palavra (a-z, A-Z, 0-9, _)
- **`\s`** - Qualquer espaço em branco
- **`\D`** - Qualquer não-dígito
- **`\W`** - Qualquer não-caractere de palavra
- **`\S`** - Qualquer não-espaço em branco

## Exemplos Práticos

<div class="grid cards" markdown>

-   :material-email:{ .lg .middle } __Validação de E-mail__

    ---

    Padrão básico para validar endereços de e-mail:
    
    ```regex
    ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
    ```
    
    **Explicação:**
    - `^` - Início da string
    - `[a-zA-Z0-9._%+-]+` - Um ou mais caracteres válidos antes do @
    - `@` - O símbolo @ literal
    - `[a-zA-Z0-9.-]+` - Um ou mais caracteres válidos para o domínio
    - `\.` - O ponto literal
    - `[a-zA-Z]{2,}` - Pelo menos 2 letras para a extensão
    - `$` - Fim da string

    [🔗 Testar no Regex101](https://regex101.com/r/lX9bEY/1)

-   :material-phone:{ .lg .middle } __Telefone Brasileiro__

    ---

    Padrão para telefones brasileiros com DDD:
    
    ```regex
    ^\(?([1-9]{2})\)?\s?9?[0-9]{4}-?[0-9]{4}$
    ```
    
    **Explicação:**
    - `^\(?` - Início, parêntese opcional
    - `([1-9]{2})` - DDD com 2 dígitos de 1-9
    - `\)?\s?` - Parêntese de fechamento e espaço opcionais
    - `9?` - Nono dígito opcional (celular)
    - `[0-9]{4}-?[0-9]{4}$` - 4 dígitos, hífen opcional, 4 dígitos

    [🔗 Testar no Regex101](https://regex101.com/r/SZn64j/1)

-   :material-credit-card:{ .lg .middle } __CPF__

    ---

    Padrão para validar formato de CPF:
    
    ```regex
    ^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$
    ```
    
    **Explicação:**
    - `^\d{3}` - Início com 3 dígitos
    - `\.?` - Ponto opcional
    - `\d{3}` - 3 dígitos
    - `\.?` - Ponto opcional
    - `\d{3}` - 3 dígitos
    - `-?` - Hífen opcional
    - `\d{2}$` - 2 dígitos e fim

    [🔗 Testar no Regex101](https://regex101.com/r/Ce0nlo/1)

-   :material-web:{ .lg .middle } __URL/Link__

    ---

    Padrão para validar URLs:
    
    ```regex
    ^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$
    ```
    
    **Explicação:**
    - `^https?` - Protocolo HTTP ou HTTPS
    - `:\/\/` - ://
    - `(www\.)?` - www. opcional
    - `[-a-zA-Z0-9@:%._\+~#=]{1,256}` - Domínio
    - `\.` - Ponto literal
    - `[a-zA-Z0-9()]{1,6}` - Extensão do domínio
    - Resto: parâmetros e caminhos opcionais

    [🔗 Testar no Regex101](https://regex101.com/r/TK2P2g/1)

-   :material-calendar:{ .lg .middle } __Data (DD/MM/AAAA)__

    ---

    Padrão para datas no formato brasileiro:
    
    ```regex
    ^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/([0-9]{4})$
    ```
    
    **Explicação:**
    - `^(0[1-9]|[12][0-9]|3[01])` - Dia de 01 a 31
    - `\/` - Barra literal
    - `(0[1-9]|1[0-2])` - Mês de 01 a 12
    - `\/` - Barra literal
    - `([0-9]{4})$` - Ano com 4 dígitos

    [🔗 Testar no Regex101](https://regex101.com/r/Nc1O9M/1)

-   :material-clock:{ .lg .middle } __Horário (HH:MM)__

    ---

    Padrão para horários em formato 24h:
    
    ```regex
    ^([01]?[0-9]|2[0-3]):[0-5][0-9]$
    ```
    
    **Explicação:**
    - `^([01]?[0-9]|2[0-3])` - Horas de 00 a 23
    - `:` - Dois pontos literal
    - `[0-5][0-9]$` - Minutos de 00 a 59

    [🔗 Testar no Regex101](https://regex101.com/r/3tTg75/1)

</div>

## Exemplos Avançados

<div class="grid cards" markdown>

-   :material-code-tags:{ .lg .middle } __Extrair Tags HTML__

    ---

    Padrão para extrair conteúdo de tags HTML:
    
    ```regex
    <([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)
    ```
    
    **Funcionalidade:** Captura tags HTML completas com seus conteúdos

    [🔗 Testar no Regex101](https://regex101.com/r/RfXncO/1)

-   :material-ip:{ .lg .middle } __Endereço IP__

    ---

    Padrão para validar endereços IPv4:
    
    ```regex
    ^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$
    ```
    
    **Funcionalidade:** Valida IPs de 0.0.0.0 a 255.255.255.255

    [🔗 Testar no Regex101](https://regex101.com/r/Kp1R6r/1)

-   :material-key:{ .lg .middle } __Senha Forte__

    ---

    Padrão para validar senhas seguras:
    
    ```regex
    ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$
    ```
    
    **Requisitos:** Mínimo 8 caracteres, maiúscula, minúscula, número e símbolo

    [🔗 Testar no Regex101](https://regex101.com/r/ZDVyAd/1)

</div>

## Dicas Importantes

### ✅ Boas Práticas
- **Teste sempre** suas regex com diferentes casos
- **Use grupos** para capturar partes específicas
- **Seja específico** - evite padrões muito genéricos
- **Documente** regex complexas com comentários

### ⚠️ Cuidados
- **Performance** - regex complexas podem ser lentas
- **Escape** caracteres especiais quando necessário
- **Validação completa** - regex não substitui validação de negócio
- **Legibilidade** - prefira clareza à brevidade extrema

## Ferramentas Úteis

<div class="grid cards" markdown>

-   :material-tools:{ .lg .middle } __Regex101__

    ---

    Melhor ferramenta online para testar e debugar expressões regulares
    
    [🔗 Acessar Regex101](https://regex101.com/)

-   :material-book:{ .lg .middle } __RegexLearn__

    ---

    Tutorial interativo para aprender regex passo a passo
    
    [🔗 Acessar RegexLearn](https://regexlearn.com/)

-   :material-library:{ .lg .middle } __RegexLib__

    ---

    Biblioteca de expressões regulares prontas para uso
    
    [🔗 Acessar RegexLib](http://regexlib.com/)

</div>

---

## 🎯 Próximos Passos

1. **Pratique** com os exemplos no Regex101
2. **Experimente** modificar os padrões
3. **Crie** suas próprias regex para casos específicos
4. **Compartilhe** suas descobertas com a comunidade

---

_Esta página faz parte do projeto **CODAQUI** - uma iniciativa para democratizar o conhecimento em tecnologia._
