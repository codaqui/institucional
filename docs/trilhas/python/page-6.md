# Comprehensions em Python

## Introdução

Comprehensions são construções sintáticas poderosas que permitem criar coleções de forma concisa e expressiva. Elas combinam a criação de elementos e sua filtragem em uma única linha de código, tornando o código mais legível e eficiente.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito de comprehensions em Python
    - Dominar list comprehensions para criar listas de forma eficiente
    - Aprender a usar dictionary comprehensions para manipular dicionários
    - Explorar set comprehensions para criar conjuntos sem repetição
    - Compreender generator expressions para processamento eficiente em memória
    - Aplicar comprehensions em problemas práticos

## List Comprehensions

List comprehensions permitem criar listas de forma concisa, combinando um loop `for` com uma expressão.

=== "Sintaxe Básica"
    ```python
    # [expressão for item in iterável]
    # ou
    # [expressão for item in iterável if condição]
    ```

=== "Exemplos Simples"
    ```python
    # Lista com os quadrados dos números de 0 a 9
    quadrados = [x**2 for x in range(10)]
    print(quadrados)  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    
    # Lista com números pares até 10
    pares = [x for x in range(11) if x % 2 == 0]
    print(pares)  # [0, 2, 4, 6, 8, 10]
    
    # Lista com comprimento de cada palavra
    palavras = ["Python", "é", "incrível"]
    comprimentos = [len(palavra) for palavra in palavras]
    print(comprimentos)  # [6, 1, 9]
    ```

=== "Com Condições"
    ```python
    # Lista com classificação de números
    numeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    classificacao = ["Par" if x % 2 == 0 else "Ímpar" for x in numeros]
    print(classificacao)  # ['Ímpar', 'Par', 'Ímpar', 'Par', 'Ímpar', 'Par', 'Ímpar', 'Par', 'Ímpar', 'Par']
    
    # Filtrando números primos (simplificado)
    def eh_primo(n):
        if n <= 1:
            return False
        if n <= 3:
            return True
        if n % 2 == 0 or n % 3 == 0:
            return False
        i = 5
        while i * i <= n:
            if n % i == 0 or n % (i + 2) == 0:
                return False
            i += 6
        return True
    
    primos = [x for x in range(1, 31) if eh_primo(x)]
    print(primos)  # [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    ```

=== "Comprehensions Aninhadas"
    ```python
    # Matriz 3x3 usando comprehensions aninhadas
    matriz = [[i * 3 + j + 1 for j in range(3)] for i in range(3)]
    print(matriz)  # [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    
    # Todos os pares (x,y) onde x e y são dígitos
    pares_coordenadas = [(x, y) for x in range(10) for y in range(10)]
    print(pares_coordenadas[:5])  # [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)]
    
    # Matriz transposta usando comprehensions
    matriz = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    transposta = [[linha[i] for linha in matriz] for i in range(3)]
    print(transposta)  # [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
    ```

!!! tip "Quando Usar List Comprehensions"
    Use list comprehensions quando precisar criar uma nova lista a partir de um iterável existente. Elas são mais eficientes e legíveis do que loops `for` tradicionais para tarefas simples de transformação ou filtragem.

## Dictionary Comprehensions

Dictionary comprehensions permitem criar dicionários de forma concisa, usando uma sintaxe semelhante às list comprehensions.

=== "Sintaxe Básica"
    ```python
    # {chave_expressão: valor_expressão for item in iterável}
    # ou
    # {chave_expressão: valor_expressão for item in iterável if condição}
    ```

=== "Exemplos Simples"
    ```python
    # Dicionário de número -> quadrado
    quadrados = {x: x**2 for x in range(6)}
    print(quadrados)  # {0: 0, 1: 1, 2: 4, 3: 9, 4: 16, 5: 25}
    
    # Dicionário de palavra -> comprimento
    palavras = ["Python", "é", "incrível"]
    comprimentos = {palavra: len(palavra) for palavra in palavras}
    print(comprimentos)  # {'Python': 6, 'é': 1, 'incrível': 9}
    ```

=== "Transformando Dicionários"
    ```python
    # Invertendo um dicionário (chave <-> valor)
    pessoas = {"João": 25, "Maria": 30, "José": 35}
    pessoas_invertido = {idade: nome for nome, idade in pessoas.items()}
    print(pessoas_invertido)  # {25: 'João', 30: 'Maria', 35: 'José'}
    
    # Convertendo todas as chaves para maiúsculas
    frutas = {"maçã": "vermelha", "banana": "amarela", "uva": "roxa"}
    frutas_maiusculas = {k.upper(): v for k, v in frutas.items()}
    print(frutas_maiusculas)  # {'MAÇÃ': 'vermelha', 'BANANA': 'amarela', 'UVA': 'roxa'}
    ```

=== "Com Filtragem"
    ```python
    # Filtrando itens caros
    produtos = {"notebook": 3500, "celular": 1500, "mouse": 50, "teclado": 100}
    itens_caros = {k: v for k, v in produtos.items() if v > 1000}
    print(itens_caros)  # {'notebook': 3500, 'celular': 1500}
    
    # Selecionando apenas frutas vermelhas
    frutas = {"maçã": "vermelha", "banana": "amarela", "morango": "vermelha"}
    frutas_vermelhas = {k: v for k, v in frutas.items() if v == "vermelha"}
    print(frutas_vermelhas)  # {'maçã': 'vermelha', 'morango': 'vermelha'}
    ```

## Set Comprehensions

Set comprehensions permitem criar conjuntos (sets) de forma concisa, eliminando automaticamente duplicatas.

=== "Sintaxe Básica"
    ```python
    # {expressão for item in iterável}
    # ou
    # {expressão for item in iterável if condição}
    ```

=== "Exemplos"
    ```python
    # Conjunto de quadrados
    quadrados = {x**2 for x in range(10)}
    print(quadrados)  # {0, 1, 4, 9, 16, 25, 36, 49, 64, 81}
    
    # Extraindo vogais únicas de um texto
    texto = "Python é uma linguagem de programação incrível"
    vogais = {letra.lower() for letra in texto if letra.lower() in "aeiou"}
    print(vogais)  # {'a', 'e', 'i', 'o', 'u'}
    
    # Valores únicos de uma lista (removendo duplicatas)
    numeros = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
    unicos = {x for x in numeros}
    print(unicos)  # {1, 2, 3, 4}
    ```

=== "Com Filtragem"
    ```python
    # Números pares únicos
    numeros = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
    pares_unicos = {x for x in numeros if x % 2 == 0}
    print(pares_unicos)  # {2, 4}
    
    # Primeiras letras de cada palavra (únicas)
    frase = "o rato roeu a roupa do rei de roma"
    iniciais = {palavra[0] for palavra in frase.split()}
    print(iniciais)  # {'o', 'r', 'a', 'd'}
    ```

## Generator Expressions

Generator expressions são semelhantes às list comprehensions, mas geram itens sob demanda, economizando memória.

=== "Sintaxe Básica"
    ```python
    # (expressão for item in iterável)
    # ou
    # (expressão for item in iterável if condição)
    ```

=== "Comparação com List Comprehension"
    ```python
    import sys
    
    # List comprehension (cria toda a lista na memória)
    lista = [x for x in range(10000)]
    
    # Generator expression (gera valores sob demanda)
    gerador = (x for x in range(10000))
    
    # Comparando o uso de memória
    print(f"Tamanho da lista: {sys.getsizeof(lista)} bytes")
    print(f"Tamanho do gerador: {sys.getsizeof(gerador)} bytes")
    
    # O gerador só calcula valores quando solicitado
    print(next(gerador))  # 0
    print(next(gerador))  # 1
    ```

=== "Uso Eficiente"
    ```python
    # Processando um arquivo grande linha por linha
    def ler_arquivo_grande(arquivo):
        with open(arquivo, 'r') as f:
            return (linha.strip() for linha in f)
    
    # Isso seria mais eficiente que:
    # def ler_arquivo_grande(arquivo):
    #     with open(arquivo, 'r') as f:
    #         return [linha.strip() for linha in f]
    
    # Somando números grandes sem usar muita memória
    soma = sum(x for x in range(10000000))
    print(soma)  # 49999995000000
    ```

!!! warning "Cuidado com a Reutilização"
    Geradores só podem ser percorridos uma vez. Após esgotar todos os elementos, não é possível reiniciar sem criar um novo gerador.
    
    ```python
    numeros = (x for x in range(5))
    for n in numeros:
        print(n, end=" ")  # 0 1 2 3 4
    
    print("\nTentando usar novamente:")
    for n in numeros:
        print(n, end=" ")  # Não imprime nada, o gerador já foi esgotado
    ```

## Casos de Uso Práticos

=== "Processamento de Dados"
    ```python
    # Filtrando dados de uma lista de dicionários
    alunos = [
        {"nome": "João", "nota": 8.5, "aprovado": True},
        {"nome": "Maria", "nota": 9.0, "aprovado": True},
        {"nome": "Pedro", "nota": 5.5, "aprovado": False},
        {"nome": "Ana", "nota": 7.0, "aprovado": True}
    ]
    
    # Nomes dos alunos aprovados
    aprovados = [aluno["nome"] for aluno in alunos if aluno["aprovado"]]
    print(aprovados)  # ['João', 'Maria', 'Ana']
    
    # Média das notas
    media = sum(aluno["nota"] for aluno in alunos) / len(alunos)
    print(f"Média: {media:.1f}")  # Média: 7.5
    
    # Melhor aluno
    melhor_aluno = max(alunos, key=lambda aluno: aluno["nota"])
    print(f"Melhor aluno: {melhor_aluno['nome']}")  # Melhor aluno: Maria
    ```

=== "Transformação de Dados"
    ```python
    # Convertendo dados de um formato para outro
    dados_csv = [
        "id,nome,idade",
        "1,João,25",
        "2,Maria,30",
        "3,Pedro,22"
    ]
    
    # Converter para lista de dicionários
    cabecalho = dados_csv[0].split(',')
    registros = [dict(zip(cabecalho, linha.split(','))) for linha in dados_csv[1:]]
    
    print(registros)
    # [{'id': '1', 'nome': 'João', 'idade': '25'}, 
    #  {'id': '2', 'nome': 'Maria', 'idade': '30'}, 
    #  {'id': '3', 'nome': 'Pedro', 'idade': '22'}]
    
    # Converter para outro formato
    json_like = {f"pessoa_{r['id']}": {"nome": r["nome"], "idade": int(r["idade"])} for r in registros}
    print(json_like)
    # {'pessoa_1': {'nome': 'João', 'idade': 25}, 
    #  'pessoa_2': {'nome': 'Maria', 'idade': 30}, 
    #  'pessoa_3': {'nome': 'Pedro', 'idade': 22}}
    ```

=== "Criação de Matrizes"
    ```python
    # Matriz de identidade 4x4
    identidade = [[1 if i == j else 0 for j in range(4)] for i in range(4)]
    for linha in identidade:
        print(linha)
    # [1, 0, 0, 0]
    # [0, 1, 0, 0]
    # [0, 0, 1, 0]
    # [0, 0, 0, 1]
    
    # Criando uma matriz de distância (cada célula contém a distância de Manhattan entre pontos)
    pontos = [(i, j) for i in range(3) for j in range(3)]
    matriz_distancia = {(p1, p2): abs(p1[0] - p2[0]) + abs(p1[1] - p2[1]) 
                        for p1 in pontos for p2 in pontos if p1 != p2}
    
    # Exibindo algumas distâncias
    print(f"Distância de (0,0) a (2,2): {matriz_distancia[((0,0), (2,2))]}")  # 4
    print(f"Distância de (1,0) a (0,2): {matriz_distancia[((1,0), (0,2))]}")  # 3
    ```

## Desempenho e Boas Práticas

=== "Desempenho"
    ```python
    import time
    
    # Comparando desempenho: loop tradicional vs. comprehension
    
    # Método 1: loop tradicional
    def metodo_loop(n):
        resultado = []
        for i in range(n):
            resultado.append(i * i)
        return resultado
    
    # Método 2: list comprehension
    def metodo_comprehension(n):
        return [i * i for i in range(n)]
    
    # Teste de desempenho
    n = 1000000
    
    inicio = time.time()
    resultado1 = metodo_loop(n)
    fim = time.time()
    print(f"Loop tradicional: {fim - inicio:.4f} segundos")
    
    inicio = time.time()
    resultado2 = metodo_comprehension(n)
    fim = time.time()
    print(f"List comprehension: {fim - inicio:.4f} segundos")
    
    # List comprehension geralmente é mais rápido
    ```

=== "Boas Práticas"
    ```python
    # 1. Mantenha as comprehensions simples e legíveis
    
    # Ruim: comprehension complexa e difícil de entender
    resultado = [x**2 for x in [y for y in range(10) if y % 2 == 0] if x > 5]
    
    # Melhor: dividir em passos
    pares = [y for y in range(10) if y % 2 == 0]
    resultado = [x**2 for x in pares if x > 5]
    
    # 2. Use generator expressions para grandes conjuntos de dados
    
    # Ruim para grandes conjuntos: carrega tudo na memória
    # sum([x**2 for x in range(10000000)])
    
    # Melhor: processa sob demanda
    # sum(x**2 for x in range(10000000))
    
    # 3. Evite efeitos colaterais nas comprehensions
    
    # Ruim: modificando estado externo
    total = 0
    [total := total + x for x in range(5)]  # Não faça isso!
    
    # Melhor: uso funcional
    total = sum(x for x in range(5))
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **List comprehensions** para criar listas de forma concisa e expressiva
- **Dictionary comprehensions** para transformar e criar dicionários eficientemente
- **Set comprehensions** para criar conjuntos sem duplicatas
- **Generator expressions** para processamento eficiente em memória
- **Casos de uso práticos** para comprehensions
- **Boas práticas** e considerações de desempenho

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre list comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions){:target="_blank"}
    - [Documentação oficial sobre generators](https://docs.python.org/3/tutorial/classes.html#generators){:target="_blank"}
    - [PEP 202 - List Comprehensions](https://peps.python.org/pep-0202/){:target="_blank"}
    - [PEP 274 - Dict Comprehensions](https://peps.python.org/pep-0274/){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos expressões lambda e funções integradas em Python, que complementam perfeitamente o uso de comprehensions.

[Avance para a próxima aula →](/docs/trilhas/python/page-7.md)

[← Voltar para Funções](/docs/trilhas/python/page-5.md)