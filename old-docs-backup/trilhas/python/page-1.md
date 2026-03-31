# Variáveis e Tipos de Dados em Python

## Introdução

Python é uma linguagem de programação de alto nível, interpretada, de propósito geral e fácil de aprender, conhecida por sua simplicidade e legibilidade. Uma das primeiras coisas que você aprenderá ao programar em Python são as variáveis e os diferentes tipos de dados disponíveis.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito de variáveis em Python
    - Conhecer os principais tipos de dados
    - Praticar a criação e manipulação de variáveis
    - Compreender as regras de nomenclatura de variáveis

### Por que Python?

Python se tornou uma das linguagens de programação mais populares do mundo por vários motivos:

1. **Sintaxe clara e legível**: O código Python é fácil de ler e escrever
2. **Versatilidade**: Útil para desenvolvimento web, análise de dados, IA, automação, etc.
3. **Grande comunidade**: Extensa documentação e bibliotecas para quase qualquer tarefa
4. **Multiplataforma**: Funciona em Windows, macOS, Linux e outros sistemas

## O que são Variáveis?

Uma variável é um espaço na memória do computador destinado a um dado que é alterado durante a execução do algoritmo. Para funcionar corretamente, as variáveis precisam ser definidas por nomes e tipos. Em Python, diferente de outras linguagens como C ou Java, não é necessário declarar explicitamente o tipo da variável - ele é inferido automaticamente pelo interpretador.

=== "Conceito"
    ```python
    # Criando variáveis em Python
    nome = "Maria"       # (1)
    idade = 25           # (2)
    altura = 1.65        # (3)
    estudante = True     # (4)
    ```

    1. Uma variável do tipo string (texto) - `str`
    2. Uma variável do tipo inteiro - `int`
    3. Uma variável do tipo ponto flutuante - `float`
    4. Uma variável do tipo booleano - `bool`

!!! info "Tipagem Dinâmica"
    Python é uma linguagem de **tipagem dinâmica**, o que significa que você não precisa declarar o tipo da variável ao criá-la. O interpretador infere o tipo baseado no valor atribuído.
    
    === "Conceito"
        ```python
        x = 10        # x é um inteiro
        x = "Python"  # Agora x é uma string
        ```

    Isso oferece flexibilidade, mas também exige cuidado para evitar erros relacionados a tipos.

### Regras para Nomes de Variáveis em Python

???+ note "Regras Importantes"
    - **Devem começar** com uma letra ou underscore (`_`)
    - **Podem conter** letras, números e underscores
    - **Não podem** começar com um número
    - São **case-sensitive** (`idade`, `Idade` e `IDADE` são variáveis diferentes)
    - **Não podem** ser palavras reservadas da linguagem (como `if`, `for`, `while`, etc.)

!!! example "Exemplos de nomes válidos e inválidos"
    === "Nomes Válidos"
        ```python
        idade = 25
        _contador = 0
        nome_completo = "João Silva"
        Usuario1 = "Maria"
        CONSTANTE = 3.14
        ```
    
    === "Nomes Inválidos"
        ```python
        1nome = "Pedro"    # Não pode começar com número
        nome-completo = "Ana"  # Não pode conter hífen
        for = 10           # Não pode ser palavra reservada
        ```

---

## Tipos de Dados Básicos em Python

Python possui diversos tipos de dados incorporados que podem ser organizados nas seguintes categorias:

### 1. Tipos Numéricos

=== "Inteiros (int)"
    ```python
    idade = 25
    quantidade_produtos = 100
    temperatura_negativa = -10
    ```
    Representam números inteiros positivos ou negativos, sem parte decimal.

=== "Ponto Flutuante (float)"
    ```python
    altura = 1.75
    pi = 3.14159
    temperatura = -2.5
    ```
    Representam números reais, com parte decimal.

=== "Complexos (complex)"
    ```python
    numero = 1 + 2j
    impedancia = 3 - 4j
    ```
    Usados principalmente em cálculos matemáticos e engenharia.

!!! info "Saiba mais"
    Os números em Python podem ser manipulados com vários operadores matemáticos como `+`, `-`, `*`, `/`, `//` (divisão inteira), `%` (resto da divisão) e `**` (potência).
    
    [Documentação oficial sobre tipos numéricos](https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex){:target="_blank"}

### 2. Texto (str)

!!! example "Exemplos de strings"
    ```python
    nome = "Python"
    mensagem = 'Olá, mundo!'
    texto_longo = """Este é um texto
    que ocupa várias
    linhas."""
    ```

As strings em Python são coleções de caracteres delimitadas por aspas simples ou duplas. Podem ser manipuladas de várias formas:

=== "Conceito"
    ```python
    nome = "Python"
    sobrenome = "Programming"

    # Concatenação
    nome_completo = nome + " " + sobrenome  # "Python Programming"

    # Repetição
    repetir = nome * 3  # "PythonPythonPython"

    # Indexação (acessando caracteres individuais)
    primeira_letra = nome[0]  # "P" (1)
    ultima_letra = nome[-1]   # "n" (2)

    # Fatiamento (slicing) - obtendo partes da string
    tres_primeiras = nome[0:3]  # "Pyt" (3)
    ```

    1. Em Python, o índice começa em 0, então o primeiro caractere é acessado com [0]
    2. Índices negativos contam a partir do final da string, com [-1] representando o último caractere
    3. O fatiamento [0:3] retorna do índice 0 até o índice 2 (o índice final não é incluído)

!!! tip "Dica: Métodos de string úteis"
    Python oferece muitos métodos úteis para manipular strings:
    
    === "Conceito"
        ```python
        texto = "python é incrível"
        print(texto.upper())         # PYTHON É INCRÍVEL
        print(texto.capitalize())    # Python é incrível
        print(texto.replace("é", "é muito"))  # python é muito incrível
        print(texto.split())         # ['python', 'é', 'incrível']
        print(len(texto))            # 17 (comprimento da string)
        ```

[Documentação oficial sobre strings](https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str){:target="_blank"}

### 3. Booleanos (bool)

Os booleanos representam valores de verdade e podem ser apenas `True` (Verdadeiro) ou `False` (Falso).

=== "Conceito"
    ```python
    python_e_facil = True
    terra_e_plana = False

    # Operações lógicas
    resultado1 = python_e_facil and terra_e_plana  # False (1)
    resultado2 = python_e_facil or terra_e_plana   # True  (2)
    resultado3 = not terra_e_plana                # True  (3)
    ```

    1. O operador `and` retorna `True` apenas se ambas as condições forem verdadeiras
    2. O operador `or` retorna `True` se pelo menos uma das condições for verdadeira
    3. O operador `not` inverte o valor booleano

!!! warning "Atenção"
    Em Python, valores diferentes podem ser convertidos implicitamente para booleanos:
    
    === "Conceito"
        ```python
        # Valores que são considerados False:
        print(bool(0))        # False - zero inteiro
        print(bool(0.0))      # False - zero flutuante
        print(bool(""))       # False - string vazia
        print(bool([]))       # False - lista vazia
        print(bool({}))       # False - dicionário vazio
        print(bool(None))     # False - valor None
        
        # Todos os outros valores são considerados True:
        print(bool(1))        # True - inteiro não-zero
        print(bool(-1))       # True - inteiro negativo
        print(bool("False"))  # True - string não-vazia, mesmo que o conteúdo seja "False"
        print(bool([0]))      # True - lista não-vazia, mesmo com valores "falsos" dentro
        ```

[Documentação oficial sobre booleanos](https://docs.python.org/3/library/stdtypes.html#truth-value-testing){:target="_blank"}

### 4. Coleções

Python oferece diversos tipos de coleções para armazenar múltiplos valores:

=== "Listas (list)"
    ```python
    frutas = ["maçã", "banana", "laranja"]  # (1)
    numeros = [1, 2, 3, 4, 5]               # (2)
    misturada = [1, "dois", 3.0, True]      # (3)
    
    # Acessando elementos
    primeira_fruta = frutas[0]  # "maçã"
    
    # Modificando elementos
    frutas[1] = "morango"  # Agora a lista é ["maçã", "morango", "laranja"]
    
    # Adicionando elementos
    frutas.append("uva")  # Adiciona ao final
    frutas.insert(1, "pêra")  # Insere na posição 1
    
    # Removendo elementos
    frutas.remove("maçã")  # Remove pelo valor
    ultima_fruta = frutas.pop()  # Remove e retorna o último item
    ```
    
    1. Lista de strings
    2. Lista de números
    3. Lista com diferentes tipos de dados
    
    Coleções ordenadas e **mutáveis**. Podem conter elementos de diferentes tipos.

=== "Tuplas (tuple)"
    ```python
    coordenadas = (10, 20)           # (1)
    cores_rgb = (255, 0, 0)          # (2)
    singleton = (42,)                # (3)
    
    # Acessando elementos (semelhante às listas)
    x = coordenadas[0]  # 10
    y = coordenadas[1]  # 20
    
    # Diferentemente das listas, não podemos modificar elementos:
    # coordenadas[0] = 15  # Isso geraria um erro!
    
    # Desempacotamento de tuplas
    r, g, b = cores_rgb  # r=255, g=0, b=0
    ```
    
    1. Tupla com dois elementos
    2. Tupla com três elementos 
    3. A vírgula é necessária para tuplas de um elemento
    
    Coleções ordenadas e **imutáveis** (não podem ser alteradas após criação).

=== "Dicionários (dict)"
    ```python
    pessoa = {"nome": "Ana", "idade": 30, "profissao": "Engenheira"}  # (1)
    config = {"debug": True, "max_connections": 100}                  # (2)
    
    # Acessando valores
    nome = pessoa["nome"]  # "Ana"
    
    # Método seguro para acessar (não gera erro se a chave não existir)
    email = pessoa.get("email", "não informado")  # "não informado"
    
    # Adicionando ou modificando valores
    pessoa["email"] = "ana@exemplo.com"
    
    # Removendo valores
    del pessoa["profissao"]
    
    # Iterando sobre o dicionário
    for chave in pessoa:
        print(f"{chave}: {pessoa[chave]}")
    
    # Obtendo chaves e valores
    todas_chaves = pessoa.keys()
    todos_valores = pessoa.values()
    ```
    
    1. Dicionário com strings e números como valores
    2. Dicionário com booleano e número como valores
    
    Coleções de pares **chave-valor**. As chaves devem ser únicas e imutáveis.

=== "Conjuntos (set)"
    ```python
    vogais = {"a", "e", "i", "o", "u"}                # (1)
    numeros_primos = {2, 3, 5, 7, 11, 13}             # (2)
    
    # Não permite elementos duplicados
    letras = {"a", "b", "a", "c"}  # Será {"a", "b", "c"}
    
    # Adicionando elementos
    vogais.add("y")  # Em alguns idiomas, y pode ser considerada uma vogal
    
    # Removendo elementos
    vogais.remove("y")
    
    # Operações de conjuntos
    conjunto1 = {1, 2, 3, 4}
    conjunto2 = {3, 4, 5, 6}
    
    uniao = conjunto1 | conjunto2        # {1, 2, 3, 4, 5, 6}
    intersecao = conjunto1 & conjunto2   # {3, 4}
    diferenca = conjunto1 - conjunto2    # {1, 2}
    ```
    
    1. Conjunto de vogais
    2. Conjunto de números primos
    
    Coleções **não ordenadas** de itens **únicos**.

!!! tip "Recursos Adicionais"
    - [Documentação sobre listas](https://docs.python.org/3/tutorial/datastructures.html#more-on-lists){:target="_blank"}
    - [Documentação sobre tuplas](https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences){:target="_blank"}
    - [Documentação sobre dicionários](https://docs.python.org/3/tutorial/datastructures.html#dictionaries){:target="_blank"}
    - [Documentação sobre conjuntos](https://docs.python.org/3/tutorial/datastructures.html#sets){:target="_blank"}

### 5. None

O tipo `None` em Python representa a ausência de valor ou um valor nulo.

=== "Conceito"
    ```python
    # None é frequentemente usado para inicializar variáveis
    resultado = None
    
    # Verificando se uma variável é None
    if resultado is None:  # (1)
        print("Ainda não temos um resultado")
    
    # Funções que não retornam valor explicitamente retornam None
    def funcao_sem_retorno():
        print("Esta função não retorna nada explicitamente")
    
    valor = funcao_sem_retorno()
    print(valor)  # Imprime: None
    ```
    
    1. Para verificar se uma variável é `None`, use o operador `is` em vez de `==`

[Documentação oficial sobre None](https://docs.python.org/3/library/constants.html#None){:target="_blank"}

## Resumo

Nesta aula, você aprendeu sobre:

- **Variáveis** em Python - espaços na memória para armazenar dados
- **Tipos de dados básicos**:
  - Números: `int`, `float`, `complex`
  - Strings: `str`
  - Booleanos: `bool`
  - Coleções: `list`, `tuple`, `dict`, `set`
- **Regras para nomes de variáveis** 
- Como **verificar o tipo** de uma variável usando a função `type()`

!!! success "Parabéns!"
    Você agora tem uma base sólida sobre variáveis e tipos de dados em Python! Na próxima aula, vamos explorar estruturas lógicas e condicionais.

!!! info "Recursos de aprendizado"
    Não se esqueça de consultar a [documentação oficial do Python](https://docs.python.org/3/){:target="_blank"} para aprofundar seus conhecimentos. A seção de [Tutorial](https://docs.python.org/3/tutorial/index.html){:target="_blank"} é especialmente útil para iniciantes.

## Próximos Passos

Continue aprofundando seus conhecimentos em Python! Na próxima aula, vamos explorar estruturas lógicas e condicionais com `if`, `else` e `elif`.

[Avance para a próxima aula →](/trilhas/python/page-2)