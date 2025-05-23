# Expressões Lambdas e Funções Integradas

## Introdução

As expressões lambda são funções anônimas (sem nome) definidas em uma única linha de código, enquanto as funções integradas (built-in) são ferramentas poderosas que vêm pré-instaladas com Python. Juntas, elas permitem escrever código mais conciso, expressivo e eficiente.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito e a sintaxe de expressões lambda
    - Aprender a usar lambdas com funções de ordem superior
    - Explorar as funções integradas mais úteis do Python
    - Combinar lambdas com funções integradas para tarefas comuns
    - Aplicar essas ferramentas em situações práticas

## Expressões Lambda

Expressões lambda são funções anônimas e compactas, definidas usando a palavra-chave `lambda`.

=== "Sintaxe Básica"
    ```python
    # lambda argumentos: expressão
    ```

=== "Comparação com Funções Regulares"
    ```python
    # Função tradicional
    def quadrado(x):
        return x ** 2
    
    # Equivalente com lambda
    quadrado_lambda = lambda x: x ** 2
    
    print(quadrado(5))         # 25
    print(quadrado_lambda(5))  # 25
    ```

=== "Múltiplos Argumentos"
    ```python
    # Lambda com múltiplos argumentos
    soma = lambda a, b: a + b
    multiplicacao = lambda a, b, c: a * b * c
    
    print(soma(3, 5))              # 8
    print(multiplicacao(2, 3, 4))  # 24
    
    # Argumentos padrão
    saudacao = lambda nome, msg="Olá": f"{msg}, {nome}!"
    print(saudacao("Maria"))            # Olá, Maria!
    print(saudacao("João", "Bem-vindo"))  # Bem-vindo, João!
    ```

=== "Expressões Condicionais"
    ```python
    # Lambda com operador ternário
    par_impar = lambda x: "Par" if x % 2 == 0 else "Ímpar"
    
    print(par_impar(4))  # Par
    print(par_impar(7))  # Ímpar
    
    # Verificando faixa de valores
    faixa_etaria = lambda idade: "Criança" if idade < 12 else "Adolescente" if idade < 18 else "Adulto"
    
    print(faixa_etaria(8))   # Criança
    print(faixa_etaria(15))  # Adolescente
    print(faixa_etaria(25))  # Adulto
    ```

!!! warning "Limitações das Lambdas"
    As expressões lambda têm limitações importantes:
    
    - São restritas a uma única expressão (sem múltiplas instruções)
    - Não podem conter comandos como `return`, `pass`, `assert` ou atribuições
    - Devem ser usadas para operações simples; para lógica complexa, use funções regulares

## Lambdas com Funções de Ordem Superior

Lambdas são particularmente úteis com funções que aceitam outras funções como argumentos (funções de ordem superior).

=== "map()"
    ```python
    # map(função, iterável) - aplica a função a cada elemento do iterável
    numeros = [1, 2, 3, 4, 5]
    
    # Quadrado de cada número
    quadrados = list(map(lambda x: x**2, numeros))
    print(quadrados)  # [1, 4, 9, 16, 25]
    
    # Usando com múltiplos iteráveis
    lista1 = [1, 2, 3]
    lista2 = [10, 20, 30]
    soma_listas = list(map(lambda x, y: x + y, lista1, lista2))
    print(soma_listas)  # [11, 22, 33]
    
    # Convertendo tipos
    valores = ['1', '2', '3', '4']
    numeros = list(map(int, valores))  # O mesmo que: list(map(lambda x: int(x), valores))
    print(numeros)  # [1, 2, 3, 4]
    ```

=== "filter()"
    ```python
    # filter(função, iterável) - filtra elementos baseado em uma função
    numeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    
    # Filtrando números pares
    pares = list(filter(lambda x: x % 2 == 0, numeros))
    print(pares)  # [2, 4, 6, 8, 10]
    
    # Filtrando strings não vazias
    palavras = ["python", "", "lambda", None, "filter", ""]
    nao_vazias = list(filter(None, palavras))  # Filtra valores "falsy" (None, "", 0, etc.)
    print(nao_vazias)  # ["python", "lambda", "filter"]
    
    # Filtrando dicionários
    pessoas = [
        {"nome": "Ana", "idade": 25},
        {"nome": "Carlos", "idade": 17},
        {"nome": "Maria", "idade": 30},
        {"nome": "João", "idade": 16}
    ]
    maiores = list(filter(lambda p: p["idade"] >= 18, pessoas))
    print([p["nome"] for p in maiores])  # ["Ana", "Maria"]
    ```

=== "sorted()"
    ```python
    # sorted(iterável, key=None, reverse=False) - retorna uma lista ordenada
    numeros = [5, 2, 8, 1, 9]
    
    # Ordenação simples
    ordenados = sorted(numeros)
    print(ordenados)  # [1, 2, 5, 8, 9]
    
    # Ordenação reversa
    decrescente = sorted(numeros, reverse=True)
    print(decrescente)  # [9, 8, 5, 2, 1]
    
    # Ordenando strings por comprimento
    palavras = ["python", "lambda", "funções", "integradas"]
    por_tamanho = sorted(palavras, key=lambda s: len(s))
    print(por_tamanho)  # ["lambda", "python", "funções", "integradas"]
    
    # Ordenando objetos complexos
    alunos = [
        {"nome": "Ana", "nota": 8.5},
        {"nome": "Carlos", "nota": 7.0},
        {"nome": "Maria", "nota": 9.0}
    ]
    por_nota = sorted(alunos, key=lambda aluno: aluno["nota"], reverse=True)
    print([a["nome"] for a in por_nota])  # ["Maria", "Ana", "Carlos"]
    ```

=== "reduce()"
    ```python
    from functools import reduce
    
    # reduce(função, iterável[, inicial]) - aplica função cumulativamente aos elementos
    numeros = [1, 2, 3, 4, 5]
    
    # Soma de todos os elementos
    soma = reduce(lambda x, y: x + y, numeros)
    print(soma)  # 15
    
    # Produto de todos os elementos
    produto = reduce(lambda x, y: x * y, numeros)
    print(produto)  # 120
    
    # Com valor inicial
    soma_mais_10 = reduce(lambda x, y: x + y, numeros, 10)
    print(soma_mais_10)  # 25
    
    # Encontrando o máximo
    maximo = reduce(lambda x, y: x if x > y else y, numeros)
    print(maximo)  # 5
    ```

## Funções Integradas (Built-in)

Python possui diversas funções integradas que são extremamente úteis para operações comuns.

=== "Manipulação de Iteráveis"
    ```python
    # len() - retorna o número de itens
    print(len([1, 2, 3, 4]))  # 4
    print(len("Python"))      # 6
    
    # sum() - soma elementos de um iterável
    print(sum([1, 2, 3, 4]))         # 10
    print(sum([1, 2, 3, 4], 100))    # 110 (100 é o valor inicial)
    
    # max() e min() - valor máximo e mínimo
    print(max([5, 2, 8, 1]))  # 8
    print(min([5, 2, 8, 1]))  # 1
    
    # Com key function
    palavras = ["python", "é", "incrível"]
    print(max(palavras, key=len))  # incrível
    print(min(palavras, key=len))  # é
    
    # any() e all() - verificam se pelo menos um ou todos os elementos são verdadeiros
    print(any([False, False, True]))  # True
    print(all([True, True, False]))   # False
    ```

=== "Conversão de Tipos"
    ```python
    # int(), float(), str(), bool() - conversões básicas
    print(int("123"))         # 123
    print(float("3.14"))      # 3.14
    print(str(42))            # "42"
    print(bool(0))            # False
    
    # list(), tuple(), set(), dict() - conversões de coleções
    print(list("Python"))                # ['P', 'y', 't', 'h', 'o', 'n']
    print(tuple([1, 2, 3]))              # (1, 2, 3)
    print(set([1, 2, 2, 3, 3, 3]))       # {1, 2, 3}
    print(dict([("a", 1), ("b", 2)]))    # {'a': 1, 'b': 2}
    ```

=== "Funções Matemáticas"
    ```python
    # abs() - valor absoluto
    print(abs(-10))  # 10
    
    # round() - arredondamento
    print(round(3.14159, 2))  # 3.14
    print(round(3.5))         # 4
    
    # pow() - potência
    print(pow(2, 3))      # 8
    print(pow(2, 3, 5))   # 3 (2^3 % 5)
    
    # divmod() - divisão e módulo
    print(divmod(13, 5))  # (2, 3) - quociente e resto
    ```

=== "Funções de Sequência"
    ```python
    # enumerate() - adiciona contador a um iterável
    frutas = ["maçã", "banana", "laranja"]
    for i, fruta in enumerate(frutas):
        print(f"{i}: {fruta}")
    # 0: maçã
    # 1: banana
    # 2: laranja
    
    # zip() - combina iteráveis em tuplas
    nomes = ["Ana", "Carlos", "Maria"]
    idades = [25, 30, 22]
    for nome, idade in zip(nomes, idades):
        print(f"{nome} tem {idade} anos")
    # Ana tem 25 anos
    # Carlos tem 30 anos
    # Maria tem 22 anos
    
    # reversed() - inverte uma sequência
    for fruta in reversed(frutas):
        print(fruta)
    # laranja
    # banana
    # maçã
    ```

=== "Funções de Inspeção"
    ```python
    # type() - retorna o tipo de um objeto
    print(type(42))        # <class 'int'>
    print(type("Python"))  # <class 'str'>
    
    # isinstance() - verifica se um objeto é de um tipo específico
    print(isinstance(42, int))          # True
    print(isinstance("Python", (int, str)))  # True
    
    # dir() - lista atributos de um objeto
    print(dir("Python"))  # Lista todos os métodos e atributos de uma string
    
    # help() - mostra documentação de um objeto
    # help(str)  # Mostra a documentação do tipo str
    ```

## Combinando Lambdas e Funções Integradas

A combinação de expressões lambda com funções integradas permite criar soluções elegantes e eficientes.

=== "Processamento de Dados"
    ```python
    # Transformando e filtrando dados
    dados = [
        {"nome": "Ana", "idade": 25, "cidade": "São Paulo"},
        {"nome": "Bruno", "idade": 17, "cidade": "Rio de Janeiro"},
        {"nome": "Carlos", "idade": 32, "cidade": "São Paulo"},
        {"nome": "Diana", "idade": 15, "cidade": "Curitiba"},
        {"nome": "Eduardo", "idade": 28, "cidade": "Rio de Janeiro"}
    ]
    
    # Filtrar maiores de idade e extrair seus nomes
    maiores = list(map(lambda p: p["nome"], 
                     filter(lambda p: p["idade"] >= 18, dados)))
    print(maiores)  # ['Ana', 'Carlos', 'Eduardo']
    
    # Agrupar por cidade
    from collections import defaultdict
    por_cidade = defaultdict(list)
    for pessoa in dados:
        por_cidade[pessoa["cidade"]].append(pessoa["nome"])
    print(dict(por_cidade))
    # {'São Paulo': ['Ana', 'Carlos'], 'Rio de Janeiro': ['Bruno', 'Eduardo'], 'Curitiba': ['Diana']}
    
    # Média de idade por cidade
    medias = {cidade: sum(p["idade"] for p in dados if p["cidade"] == cidade) / 
                     len([p for p in dados if p["cidade"] == cidade])
              for cidade in por_cidade}
    print(medias)
    # {'São Paulo': 28.5, 'Rio de Janeiro': 22.5, 'Curitiba': 15.0}
    ```

=== "Ordenação Personalizada"
    ```python
    # Ordenando strings ignorando case
    palavras = ["Banana", "abacaxi", "Laranja", "maçã"]
    ordenadas = sorted(palavras, key=lambda s: s.lower())
    print(ordenadas)  # ['abacaxi', 'Banana', 'Laranja', 'maçã']
    
    # Ordenando por múltiplos critérios
    alunos = [
        {"nome": "Ana", "nota": 8.5, "faltas": 2},
        {"nome": "Carlos", "nota": 8.5, "faltas": 4},
        {"nome": "Maria", "nota": 9.0, "faltas": 0},
        {"nome": "João", "nota": 7.0, "faltas": 1}
    ]
    
    # Primeiro por nota (decrescente), depois por faltas (crescente)
    ordenados = sorted(alunos, key=lambda a: (-a["nota"], a["faltas"]))
    for a in ordenados:
        print(f"{a['nome']}: nota {a['nota']}, faltas {a['faltas']}")
    # Maria: nota 9.0, faltas 0
    # Ana: nota 8.5, faltas 2
    # Carlos: nota 8.5, faltas 4
    # João: nota 7.0, faltas 1
    ```

=== "Cálculos Funcionais"
    ```python
    # Calculando estatísticas de forma funcional
    notas = [8.5, 7.0, 9.5, 6.5, 8.0, 7.5]
    
    # Média
    media = sum(notas) / len(notas)
    print(f"Média: {media:.2f}")  # Média: 7.83
    
    # Variância (usando abordagem funcional)
    variancia = sum(map(lambda x: (x - media) ** 2, notas)) / len(notas)
    print(f"Variância: {variancia:.2f}")  # Variância: 0.94
    
    # Desvio padrão
    desvio_padrao = variancia ** 0.5
    print(f"Desvio padrão: {desvio_padrao:.2f}")  # Desvio padrão: 0.97
    
    # Notas normalizadas (z-score)
    normalizadas = list(map(lambda x: (x - media) / desvio_padrao, notas))
    print(f"Normalizadas: {[round(n, 2) for n in normalizadas]}")
    # Normalizadas: [0.69, -0.86, 1.72, -1.37, 0.17, -0.35]
    ```

=== "Filtragem Avançada"
    ```python
    # Filtrando dados com múltiplas condições
    produtos = [
        {"nome": "Notebook", "preco": 3500, "estoque": 5, "categoria": "Eletrônicos"},
        {"nome": "Monitor", "preco": 1200, "estoque": 10, "categoria": "Eletrônicos"},
        {"nome": "Teclado", "preco": 150, "estoque": 0, "categoria": "Periféricos"},
        {"nome": "Mouse", "preco": 80, "estoque": 15, "categoria": "Periféricos"},
        {"nome": "Headset", "preco": 250, "estoque": 8, "categoria": "Áudio"},
        {"nome": "Caixa de Som", "preco": 120, "estoque": 3, "categoria": "Áudio"}
    ]
    
    # Produtos disponíveis (em estoque) com preço abaixo de 200
    disponivel_barato = list(filter(
        lambda p: p["estoque"] > 0 and p["preco"] < 200, 
        produtos
    ))
    for p in disponivel_barato:
        print(f"{p['nome']} - R${p['preco']}")
    # Mouse - R$80
    # Caixa de Som - R$120
    
    # Produtos por categoria
    from itertools import groupby
    
    # Precisa ordenar primeiro para o groupby funcionar corretamente
    produtos_ordenados = sorted(produtos, key=lambda p: p["categoria"])
    
    for categoria, items in groupby(produtos_ordenados, key=lambda p: p["categoria"]):
        print(f"\nCategoria: {categoria}")
        for produto in items:
            print(f"  - {produto['nome']}: R${produto['preco']}")
    ```

## Boas Práticas

=== "Quando Usar Lambda"
    ```python
    # Use lambdas para expressões simples
    
    # Bom uso de lambda (expressão simples)
    numeros = [1, 2, 3, 4, 5]
    quadrados = list(map(lambda x: x**2, numeros))
    
    # Em vez de usar lambda para código complexo...
    ordenados = sorted(produtos, 
                     lambda p: (p["categoria"], -p["preco"], p["nome"]))
    
    # ...defina uma função nomeada para melhor legibilidade
    def ordem_produto(p):
        # Ordem: primeiro por categoria, depois por preço (decrescente), depois por nome
        return (p["categoria"], -p["preco"], p["nome"])
    
    ordenados = sorted(produtos, key=ordem_produto)
    ```

=== "Alternativas ao Lambda"
    ```python
    import operator
    from functools import partial
    
    numeros = [1, 2, 3, 4, 5]
    
    # Em vez de:
    pares = list(filter(lambda x: x % 2 == 0, numeros))
    
    # Use compreensão de lista (geralmente mais legível):
    pares = [x for x in numeros if x % 2 == 0]
    
    # Em vez de:
    soma = reduce(lambda x, y: x + y, numeros)
    produto = reduce(lambda x, y: x * y, numeros)
    
    # Use operadores do módulo operator:
    soma = reduce(operator.add, numeros)
    produto = reduce(operator.mul, numeros)
    
    # Função partial para criar funções especializadas
    incrementar = partial(operator.add, 1)
    print(incrementar(10))  # 11
    
    # Usando partial para funções de duas vias
    potencia_de_2 = partial(pow, 2)
    print(potencia_de_2(5))  # 32 (2^5)
    
    base_2 = partial(pow, base=2)
    print(base_2(5))  # 32 (2^5)
    ```

=== "Debugging"
    ```python
    # Lambdas podem ser difíceis de depurar, pois não têm nome
    
    # Estratégia 1: Atribuir a lambda a uma variável
    quadrado = lambda x: x**2
    # Agora se aparecer um erro, verá 'quadrado' no traceback
    
    # Estratégia 2: Converter para função regular para debug
    def quadrado_debug(x):
        result = x**2
        print(f"Quadrado de {x} = {result}")
        return result
    
    # Use temporariamente esta versão em vez da lambda
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Expressões lambda** para criar funções anônimas concisas
- **Funções de ordem superior** como `map()`, `filter()`, `sorted()` e `reduce()`
- **Funções integradas** do Python para manipulação de dados
- **Combinação de lambdas e funções integradas** para soluções elegantes
- **Boas práticas** para o uso eficiente de lambdas

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre funções integradas](https://docs.python.org/3/library/functions.html){:target="_blank"}
    - [Documentação sobre o módulo functools](https://docs.python.org/3/library/functools.html){:target="_blank"}
    - [PEP 8 - Guia de Estilo para Python](https://peps.python.org/pep-0008/){:target="_blank"}

## Próximos Passos

Na próxima aula, aprenderemos sobre depuração e tratamento de erros em Python, habilidades essenciais para desenvolver código robusto.

[Avance para a próxima aula →](//trilhas/python/page-8)

[← Voltar para Comprehensions](//trilhas/python/page-6)