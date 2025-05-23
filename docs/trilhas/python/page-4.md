# Coleções em Python

## Introdução

As coleções em Python são estruturas de dados que permitem armazenar múltiplos itens em uma única variável. Estas estruturas funcionam como contêineres e oferecem diferentes formas de organizar e manipular dados, cada uma com características específicas de acesso, mutabilidade e ordenação.

!!! info "Objetivos de Aprendizado"
    - Entender os diferentes tipos de coleções disponíveis em Python
    - Aprender a utilizar listas, tuplas, dicionários e conjuntos
    - Compreender quando usar cada tipo de coleção
    - Dominar os métodos e operações disponíveis para cada coleção
    - Aplicar coleções em situações práticas

## Tipos de Coleções

Python oferece quatro tipos principais de coleções:

1. **Listas** - Coleções ordenadas e mutáveis
2. **Tuplas** - Coleções ordenadas e imutáveis
3. **Dicionários** - Coleções não-ordenadas (em versões < 3.7) de pares chave-valor
4. **Conjuntos** - Coleções não-ordenadas de itens únicos

## Listas (Lists)

Listas são coleções ordenadas e mutáveis, permitindo itens duplicados.

=== "Criação de Listas"
    ```python
    # Diferentes maneiras de criar listas
    numeros = [1, 2, 3, 4, 5]
    frutas = ["maçã", "banana", "laranja"]
    misturada = [1, "Python", True, 3.14]
    vazia = []
    
    # Criando listas com a função list()
    lista_de_string = list("Python")  # ['P', 'y', 't', 'h', 'o', 'n']
    lista_de_range = list(range(5))   # [0, 1, 2, 3, 4]
    ```

=== "Acessando Elementos"
    ```python
    frutas = ["maçã", "banana", "laranja", "uva", "pêra"]
    
    # Indexação começa em 0
    primeira = frutas[0]  # "maçã"
    terceira = frutas[2]  # "laranja"
    
    # Índices negativos contam de trás para frente
    ultima = frutas[-1]    # "pêra"
    penultima = frutas[-2]  # "uva"
    
    # Fatiamento (slicing)
    primeiras_tres = frutas[0:3]    # ["maçã", "banana", "laranja"]
    do_inicio = frutas[:2]          # ["maçã", "banana"]
    ate_o_fim = frutas[2:]          # ["laranja", "uva", "pêra"]
    copia_completa = frutas[:]      # Cria uma cópia da lista
    pulo_dois = frutas[::2]         # ["maçã", "laranja", "pêra"] (passo 2)
    invertida = frutas[::-1]        # ["pêra", "uva", "laranja", "banana", "maçã"]
    ```

=== "Modificando Listas"
    ```python
    frutas = ["maçã", "banana", "laranja"]
    
    # Alterando um elemento específico
    frutas[1] = "morango"  # ["maçã", "morango", "laranja"]
    
    # Adicionando elementos
    frutas.append("uva")          # Adiciona ao final: ["maçã", "morango", "laranja", "uva"]
    frutas.insert(1, "abacaxi")   # Insere na posição 1: ["maçã", "abacaxi", "morango", "laranja", "uva"]
    frutas.extend(["pêra", "limão"])  # Adiciona vários: ["maçã", "abacaxi", "morango", "laranja", "uva", "pêra", "limão"]
    
    # Removendo elementos
    frutas.remove("morango")      # Remove por valor: ["maçã", "abacaxi", "laranja", "uva", "pêra", "limão"]
    item_removido = frutas.pop(1)  # Remove por índice e retorna: "abacaxi"
    ultimo = frutas.pop()         # Remove e retorna o último item: "limão"
    del frutas[0]                 # Remove por índice, sem retornar: ["laranja", "uva", "pêra"]
    
    # Operações comuns
    frutas.clear()                # Esvazia a lista: []
    ```

=== "Métodos de Listas"
    ```python
    numeros = [3, 1, 4, 1, 5, 9, 2, 6]
    
    # Ordenação
    numeros.sort()                 # [1, 1, 2, 3, 4, 5, 6, 9]
    numeros.sort(reverse=True)     # [9, 6, 5, 4, 3, 2, 1, 1]
    
    # Não modifica a lista original
    ordenada = sorted(numeros)     # Retorna uma nova lista ordenada
    
    # Invertendo
    numeros.reverse()              # Inverte a ordem dos elementos
    
    # Contagem e localização
    contagem = numeros.count(1)    # Retorna quantas vezes 1 aparece
    indice = numeros.index(5)      # Retorna o índice da primeira ocorrência de 5
    
    # Comprimento
    tamanho = len(numeros)         # Retorna o número de elementos na lista
    ```

!!! tip "Dica: Compreensão de Listas"
    As compreensões de listas (list comprehensions) oferecem uma forma concisa e elegante de criar listas:
    
    ```python
    # Criando uma lista com os quadrados dos números de 1 a 10
    quadrados = [x**2 for x in range(1, 11)]  # [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
    
    # Filtrando apenas números pares
    pares = [x for x in range(1, 11) if x % 2 == 0]  # [2, 4, 6, 8, 10]
    
    # Criando uma matriz 3x3
    matriz = [[i * 3 + j + 1 for j in range(3)] for i in range(3)]
    # [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    ```

## Tuplas (Tuples)

Tuplas são coleções ordenadas e imutáveis, permitindo itens duplicados. Uma vez criada, uma tupla não pode ser modificada.

=== "Criação de Tuplas"
    ```python
    # Diferentes formas de criar tuplas
    coordenadas = (10, 20)
    cores = ("vermelho", "verde", "azul")
    misturada = (1, "Python", True)
    
    # Tupla de um elemento (precisa da vírgula)
    singleton = (42,)  # Sem a vírgula seria apenas um inteiro entre parênteses
    
    # Criando tuplas com a função tuple()
    tupla_de_lista = tuple([1, 2, 3])  # (1, 2, 3)
    tupla_de_string = tuple("Python")  # ('P', 'y', 't', 'h', 'o', 'n')
    
    # Tupla sem parênteses (empacotamento)
    pessoa = "João", 30, "Engenheiro"  # ("João", 30, "Engenheiro")
    ```

=== "Acessando Elementos"
    ```python
    cores = ("vermelho", "verde", "azul", "amarelo", "roxo")
    
    # Acessando elementos (semelhante às listas)
    primeira_cor = cores[0]     # "vermelho"
    ultima_cor = cores[-1]      # "roxo"
    
    # Fatiamento (slicing)
    primeiras_tres = cores[0:3]  # ("vermelho", "verde", "azul")
    
    # Tentando modificar uma tupla gera um erro
    # cores[0] = "preto"  # TypeError: 'tuple' object does not support item assignment
    ```

=== "Desempacotamento de Tuplas"
    ```python
    # Desempacotamento - atribuindo elementos a variáveis
    pessoa = ("João", 30, "Engenheiro")
    nome, idade, profissao = pessoa  # nome="João", idade=30, profissao="Engenheiro"
    
    # Usando _ para ignorar valores
    coordenadas = (10, 20, 30)
    x, _, z = coordenadas  # x=10, z=30, ignorando o valor do meio
    
    # Desempacotando com *
    numeros = (1, 2, 3, 4, 5)
    primeiro, *meio, ultimo = numeros  # primeiro=1, meio=[2, 3, 4], ultimo=5
    ```

=== "Operações com Tuplas"
    ```python
    cores1 = ("vermelho", "verde")
    cores2 = ("azul", "amarelo")
    
    # Concatenação
    todas_cores = cores1 + cores2  # ("vermelho", "verde", "azul", "amarelo")
    
    # Repetição
    repetida = cores1 * 3  # ("vermelho", "verde", "vermelho", "verde", "vermelho", "verde")
    
    # Verificando se um elemento existe
    tem_verde = "verde" in cores1  # True
    
    # Contagem e localização (mesmos métodos das listas)
    contagem = todas_cores.count("verde")  # Retorna quantas vezes "verde" aparece
    indice = todas_cores.index("azul")     # Retorna o índice da primeira ocorrência de "azul"
    ```

!!! info "Por que usar Tuplas?"
    - Tuplas são imutáveis, o que as torna adequadas para dados que não devem ser alterados.
    - Podem ser usadas como chaves de dicionários (listas não podem).
    - Geralmente mais rápidas que listas para operações comuns.
    - Indicam claramente que os dados não devem ser modificados.

## Dicionários (Dictionaries)

Dicionários são coleções de pares chave-valor, não-ordenadas (antes do Python 3.7) ou ordenadas (a partir do Python 3.7) pela ordem de inserção, mutáveis e sem duplicatas nas chaves.

=== "Criação de Dicionários"
    ```python
    # Diferentes formas de criar dicionários
    pessoa = {"nome": "Ana", "idade": 30, "profissao": "Engenheira"}
    pontos = {1: "A", 2: "B", 3: "C"}
    misturado = {"chave": 1, 2: "valor", "lista": [1, 2, 3]}
    vazio = {}
    
    # Criando com a função dict()
    pessoa2 = dict(nome="Carlos", idade=25, profissao="Médico")
    
    # Criando a partir de sequências de pares
    items = [("a", 1), ("b", 2), ("c", 3)]
    meu_dict = dict(items)
    ```

=== "Acessando e Modificando"
    ```python
    pessoa = {"nome": "Ana", "idade": 30, "profissao": "Engenheira"}
    
    # Acessando valores
    nome = pessoa["nome"]  # "Ana"
    
    # Se a chave não existir, gera KeyError
    # email = pessoa["email"]  # KeyError
    
    # Método seguro para acessar (não gera erro se a chave não existir)
    email = pessoa.get("email")  # None
    email = pessoa.get("email", "não informado")  # "não informado" (valor padrão)
    
    # Modificando valores existentes
    pessoa["idade"] = 31
    
    # Adicionando novos pares chave-valor
    pessoa["email"] = "ana@exemplo.com"
    
    # Removendo pares
    profissao = pessoa.pop("profissao")  # Remove e retorna: "Engenheira"
    del pessoa["idade"]  # Remove sem retornar
    
    # Limpando o dicionário
    pessoa.clear()  # {}
    ```

=== "Métodos de Dicionários"
    ```python
    pessoa = {"nome": "Ana", "idade": 30, "profissao": "Engenheira"}
    
    # Obter todas as chaves
    chaves = pessoa.keys()  # dict_keys(['nome', 'idade', 'profissao'])
    
    # Obter todos os valores
    valores = pessoa.values()  # dict_values(['Ana', 30, 'Engenheira'])
    
    # Obter todos os pares chave-valor como tuplas
    itens = pessoa.items()  # dict_items([('nome', 'Ana'), ('idade', 30), ('profissao', 'Engenheira')])
    
    # Atualizar o dicionário com outro dicionário
    pessoa.update({"email": "ana@exemplo.com", "telefone": "123456789"})
    
    # Obter e remover um item, com valor padrão se a chave não existir
    hobbie = pessoa.pop("hobbie", "Não informado")
    
    # Obter valor, criando a chave se não existir
    endereco = pessoa.setdefault("endereco", "Desconhecido")
    ```

=== "Iterando sobre Dicionários"
    ```python
    pessoa = {"nome": "Ana", "idade": 30, "profissao": "Engenheira"}
    
    # Iterando sobre as chaves (comportamento padrão)
    for chave in pessoa:
        print(chave, pessoa[chave])
    
    # Iterando sobre os valores
    for valor in pessoa.values():
        print(valor)
    
    # Iterando sobre pares chave-valor
    for chave, valor in pessoa.items():
        print(f"{chave}: {valor}")
    ```

!!! tip "Dica: Compreensão de Dicionários"
    Assim como as listas, os dicionários também possuem compreensões:
    
    ```python
    # Criando um dicionário com números e seus quadrados
    quadrados = {x: x**2 for x in range(1, 6)}  # {1: 1, 2: 4, 3: 9, 4: 16, 5: 25}
    
    # Filtrando itens
    maiores = {k: v for k, v in quadrados.items() if v > 10}  # {4: 16, 5: 25}
    ```

## Conjuntos (Sets)

Conjuntos são coleções não-ordenadas, mutáveis e sem itens duplicados.

=== "Criação de Conjuntos"
    ```python
    # Diferentes formas de criar conjuntos
    frutas = {"maçã", "banana", "laranja"}
    numeros = {1, 2, 3, 4, 5}
    
    # Duplicatas são automaticamente removidas
    letras = {"a", "b", "c", "a", "d", "b"}  # {"a", "b", "c", "d"}
    
    # Conjunto vazio (não pode usar {}, que cria um dicionário vazio)
    vazio = set()
    
    # Criando a partir de outras sequências
    vogais = set("aeiou")  # {"a", "e", "i", "o", "u"}
    unicos = set([1, 2, 2, 3, 3, 3, 4])  # {1, 2, 3, 4}
    ```

=== "Operações com Conjuntos"
    ```python
    # Adicionando elementos
    frutas = {"maçã", "banana", "laranja"}
    frutas.add("uva")  # {"maçã", "banana", "laranja", "uva"}
    
    # Adicionando múltiplos elementos
    frutas.update(["pêra", "abacaxi"])  # {"maçã", "banana", "laranja", "uva", "pêra", "abacaxi"}
    
    # Removendo elementos
    frutas.remove("banana")  # Gera erro se o elemento não existir
    frutas.discard("manga")  # Não gera erro se o elemento não existir
    elemento = frutas.pop()  # Remove e retorna um elemento arbitrário
    
    # Limpando o conjunto
    frutas.clear()  # set()
    ```

=== "Operações Matemáticas"
    ```python
    A = {1, 2, 3, 4, 5}
    B = {4, 5, 6, 7, 8}
    
    # União (elementos em A ou B)
    union = A | B  # ou A.union(B)
    # {1, 2, 3, 4, 5, 6, 7, 8}
    
    # Interseção (elementos em A e B)
    intersection = A & B  # ou A.intersection(B)
    # {4, 5}
    
    # Diferença (elementos em A, mas não em B)
    difference = A - B  # ou A.difference(B)
    # {1, 2, 3}
    
    # Diferença simétrica (elementos em A ou B, mas não em ambos)
    symmetric_difference = A ^ B  # ou A.symmetric_difference(B)
    # {1, 2, 3, 6, 7, 8}
    ```

=== "Operações de Comparação"
    ```python
    A = {1, 2, 3}
    B = {1, 2, 3, 4, 5}
    C = {1, 2, 3}
    
    # Verificando se um conjunto é subconjunto de outro
    print(A.issubset(B))  # True
    print(A <= B)         # True
    
    # Verificando se um conjunto é superconjunto de outro
    print(B.issuperset(A))  # True
    print(B >= A)           # True
    
    # Verificando igualdade
    print(A == C)  # True
    
    # Verificando se conjuntos são disjuntos (não têm elementos em comum)
    D = {6, 7, 8}
    print(A.isdisjoint(D))  # True
    ```

!!! warning "Restrições de Conjuntos"
    - Apenas itens imutáveis (como strings, números e tuplas) podem ser elementos de conjuntos.
    - Listas, dicionários e outros conjuntos não podem ser elementos de conjuntos.
    - Conjuntos não têm índices, portanto você não pode acessar elementos por posição.

## Collections Module

O módulo `collections` oferece alternativas e extensões às coleções padrão do Python:

=== "Counter"
    ```python
    from collections import Counter
    
    # Contando ocorrências de elementos
    texto = "mississippi"
    contagem = Counter(texto)  # Counter({'i': 4, 's': 4, 'p': 2, 'm': 1})
    
    # Elementos mais comuns
    mais_comuns = contagem.most_common(2)  # [('i', 4), ('s', 4)]
    
    # Operações matemáticas
    c1 = Counter("aaabbc")
    c2 = Counter("bcccdd")
    print(c1 + c2)  # Counter({'c': 5, 'b': 3, 'a': 3, 'd': 2})
    print(c1 - c2)  # Counter({'a': 3, 'b': 1})
    ```

=== "defaultdict"
    ```python
    from collections import defaultdict
    
    # Dicionário com valor padrão para chaves inexistentes
    contagem = defaultdict(int)  # Valor padrão: 0
    
    texto = "mississippi"
    for letra in texto:
        contagem[letra] += 1  # Mesmo para chaves que não existiam antes
    
    print(dict(contagem))  # {'m': 1, 'i': 4, 's': 4, 'p': 2}
    
    # Com outros tipos
    lista_padrao = defaultdict(list)
    lista_padrao['frutas'].append('maçã')  # Não precisa inicializar a lista
    ```

=== "OrderedDict"
    ```python
    from collections import OrderedDict
    
    # Preserva a ordem de inserção (relevante para Python < 3.7)
    cores = OrderedDict()
    cores['vermelho'] = '#FF0000'
    cores['verde'] = '#00FF00'
    cores['azul'] = '#0000FF'
    
    # A ordem é preservada na iteração
    for cor, codigo in cores.items():
        print(f"{cor}: {codigo}")
    ```

=== "namedtuple"
    ```python
    from collections import namedtuple
    
    # Criando uma "classe" simples
    Ponto = namedtuple('Ponto', ['x', 'y'])
    
    p = Ponto(10, 20)
    print(p.x, p.y)  # 10 20
    
    # Também funciona como uma tupla normal
    print(p[0], p[1])  # 10 20
    
    # Desempacotando
    x, y = p
    print(x, y)  # 10 20
    ```

=== "deque"
    ```python
    from collections import deque
    
    # Fila de duas pontas (double-ended queue)
    fila = deque(['a', 'b', 'c'])
    
    # Adicionando elementos
    fila.append('d')         # ['a', 'b', 'c', 'd']
    fila.appendleft('z')     # ['z', 'a', 'b', 'c', 'd']
    
    # Removendo elementos
    ultimo = fila.pop()      # 'd'
    primeiro = fila.popleft() # 'z'
    
    # Rotacionando a fila
    fila.rotate(1)  # Move um lugar para a direita
    fila.rotate(-1)  # Move um lugar para a esquerda
    ```

## Escolhendo a Coleção Certa

Cada tipo de coleção tem suas próprias características e casos de uso ideais:

!!! info "Quando usar cada coleção"
    - **Listas**: Quando a ordem é importante e os elementos podem mudar
    - **Tuplas**: Para dados fixos, imutáveis e/ou heterogêneos
    - **Dicionários**: Quando você precisa associar valores a chaves para acesso rápido
    - **Conjuntos**: Quando você precisa garantir elementos únicos ou realizar operações de conjuntos

=== "Exemplos de Uso"
    ```python
    # Lista: Coleção ordenada de itens similares
    tarefas = ["Estudar Python", "Fazer exercícios", "Revisar código"]
    
    # Tupla: Representando estruturas fixas, como coordenadas
    ponto = (10, 20, 30)  # x, y, z
    
    # Dicionário: Armazenando informações relacionadas
    aluno = {
        "nome": "Maria",
        "idade": 22,
        "curso": "Ciência da Computação",
        "notas": [9.5, 8.0, 7.5]
    }
    
    # Conjunto: Removendo duplicatas e verificando pertinência
    tags = {"python", "programação", "código", "python"}  # Duplicata removida
    tem_java = "java" in tags  # Verificação rápida: False
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Listas**: Coleções ordenadas e mutáveis
- **Tuplas**: Coleções ordenadas e imutáveis
- **Dicionários**: Coleções de pares chave-valor, mutáveis e com chaves únicas
- **Conjuntos**: Coleções de elementos únicos, não-ordenadas e mutáveis
- **Módulo Collections**: Coleções especializadas como Counter, defaultdict e namedtuple
- **Operações** e **métodos** específicos para cada tipo de coleção
- **Compreensões** para criar listas e dicionários de forma concisa

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre listas](https://docs.python.org/3/tutorial/datastructures.html#more-on-lists){:target="_blank"}
    - [Documentação oficial sobre tuplas](https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences){:target="_blank"}
    - [Documentação oficial sobre dicionários](https://docs.python.org/3/tutorial/datastructures.html#dictionaries){:target="_blank"}
    - [Documentação oficial sobre conjuntos](https://docs.python.org/3/tutorial/datastructures.html#sets){:target="_blank"}
    - [Documentação do módulo Collections](https://docs.python.org/3/library/collections.html){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos funções em Python, que nos permitem organizar código em blocos reutilizáveis.

[Avance para a próxima aula →](/docs/trilhas/python/page-5)

[← Voltar para Estruturas de Repetição](/docs/trilhas/python/page-3)