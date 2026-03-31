<!-- filepath: /home/Enderson.Menezes/Code/codaqui/institucional/docs//trilhas/python/page-11.md -->
# Iteradores e Geradores

## Introdução

Iteradores e geradores são componentes fundamentais da programação em Python que facilitam o processamento eficiente de sequências de dados. Enquanto os iteradores fornecem uma interface padronizada para percorrer coleções, os geradores oferecem uma maneira elegante e eficiente de criar iteradores com mínimo consumo de memória.

!!! info "Objetivos de Aprendizado"
    - Entender o protocolo de iteração em Python
    - Diferenciar entre iteráveis e iteradores
    - Aprender a criar e usar iteradores personalizados
    - Dominar o conceito e uso de geradores
    - Compreender expressões geradoras
    - Aplicar iteradores e geradores em situações práticas

## Protocolo de Iteração em Python

O protocolo de iteração é o fundamento para percorrer sequências em Python, como loops `for` e compreensões de lista.

=== "Iteráveis vs. Iteradores"
    ```python
    # Um iterável é qualquer objeto que pode ser percorrido
    # Exemplos: listas, tuplas, dicionários, strings, arquivos
    
    # Um iterador é um objeto que gerencia o estado da iteração
    # Um iterador sabe qual é o elemento atual e qual o próximo
    
    # Métodos necessários para um objeto ser iterador:
    # - __iter__(): retorna o próprio iterador
    # - __next__(): retorna o próximo item ou levanta StopIteration
    ```

=== "Como Funciona o Loop For"
    ```python
    # O loop for funciona assim por baixo dos panos:
    
    # Quando escrevemos:
    for item in minha_lista:
        print(item)
    
    # O Python na verdade faz:
    iterador = iter(minha_lista)  # Chama minha_lista.__iter__()
    while True:
        try:
            item = next(iterador)  # Chama iterador.__next__()
            print(item)
        except StopIteration:
            break  # Fim da iteração
    ```

=== "Manipulando Iteradores Manualmente"
    ```python
    # Criando um iterador a partir de um iterável
    numeros = [1, 2, 3, 4, 5]
    iterador = iter(numeros)
    
    # Obtendo valores manualmente
    print(next(iterador))  # 1
    print(next(iterador))  # 2
    print(next(iterador))  # 3
    
    # Percorrendo os itens restantes
    for numero in iterador:
        print(numero)  # 4, 5
    
    # Tentar obter mais valores resulta em StopIteration
    try:
        next(iterador)
    except StopIteration:
        print("Iteração concluída!")
    
    # Importante: iteradores são esgotáveis
    # Uma vez percorridos, não podem ser reutilizados
    for numero in iterador:
        print(numero)  # Não imprime nada, o iterador já foi esgotado
    ```

## Criando Iteradores Personalizados

Você pode criar seus próprios iteradores implementando os métodos `__iter__` e `__next__`.

=== "Iterador Simples"
    ```python
    class Contador:
        """Um iterador que conta de início até fim, pulando passo."""
        
        def __init__(self, inicio, fim, passo=1):
            self.inicio = inicio
            self.fim = fim
            self.passo = passo
            self.valor = inicio
            
        def __iter__(self):
            # Retorna o próprio objeto como iterador
            self.valor = self.inicio
            return self
            
        def __next__(self):
            # Verifica se a iteração deve terminar
            if (self.passo > 0 and self.valor > self.fim) or \
               (self.passo < 0 and self.valor < self.fim):
                raise StopIteration
                
            valor_atual = self.valor
            self.valor += self.passo
            return valor_atual
    
    # Usando o iterador personalizado
    contador = Contador(1, 10, 2)
    for numero in contador:
        print(numero)  # 1, 3, 5, 7, 9
    
    # Podemos reutilizar porque __iter__ reinicia o estado
    print("Contagem regressiva:")
    contador_reverso = Contador(10, 1, -2)
    for numero in contador_reverso:
        print(numero)  # 10, 8, 6, 4, 2
    ```

=== "Iterador Mais Complexo"
    ```python
    class FibonacciIterator:
        """Iterador que gera a sequência de Fibonacci até n."""
        
        def __init__(self, n):
            self.n = n  # Quantidade máxima de números
            self.gerados = 0
            self.a = 0
            self.b = 1
            
        def __iter__(self):
            self.gerados = 0
            self.a = 0
            self.b = 1
            return self
            
        def __next__(self):
            if self.gerados >= self.n:
                raise StopIteration
                
            if self.gerados == 0:
                self.gerados += 1
                return 0
            elif self.gerados == 1:
                self.gerados += 1
                return 1
            else:
                resultado = self.a + self.b
                self.a, self.b = self.b, resultado
                self.gerados += 1
                return resultado
    
    # Usando o iterador Fibonacci
    fib = FibonacciIterator(8)
    for numero in fib:
        print(numero, end=" ")  # 0 1 1 2 3 5 8 13
    
    print()
    
    # Convertendo para lista
    fib = FibonacciIterator(10)
    fibonacci_lista = list(fib)
    print(fibonacci_lista)  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
    ```

=== "Padrão Iterador-Iterável Separado"
    ```python
    class ListaInvertidaIteravel:
        """Iterável que percorre os elementos na ordem inversa."""
        
        def __init__(self, dados):
            self.dados = dados
            
        def __iter__(self):
            # Retorna um novo iterador a cada chamada
            return ListaInvertidaIterador(self.dados)
            
    
    class ListaInvertidaIterador:
        """Iterador que percorre os elementos na ordem inversa."""
        
        def __init__(self, dados):
            self.dados = dados
            self.indice = len(dados)
            
        def __iter__(self):
            return self
            
        def __next__(self):
            if self.indice <= 0:
                raise StopIteration
                
            self.indice -= 1
            return self.dados[self.indice]
    
    # Usando o padrão iterador-iterável
    minha_lista = [1, 2, 3, 4, 5]
    invertida = ListaInvertidaIteravel(minha_lista)
    
    # Podemos usar várias vezes porque cada uso cria um novo iterador
    print("Primeira iteração:")
    for item in invertida:
        print(item, end=" ")  # 5 4 3 2 1
    
    print("\nSegunda iteração:")
    for item in invertida:
        print(item, end=" ")  # 5 4 3 2 1
    ```

!!! tip "Separação Iterável-Iterador"
    A separação dos conceitos de iterável e iterador permite reutilizar o iterável múltiplas vezes, criando um novo iterador a cada iteração. Isso é o que acontece com objetos embutidos do Python como listas, que podem ser percorridos várias vezes.

## Geradores

Geradores são uma forma simplificada de criar iteradores usando funções em vez de classes. Eles usam a palavra-chave `yield` para retornar valores sob demanda.

=== "Funções Geradoras Básicas"
    ```python
    # Função geradora simples
    def contador(inicio, fim, passo=1):
        """Gerador que conta de início até fim, pulando passo."""
        valor = inicio
        
        # Lógica diferente dependendo da direção
        if passo > 0:
            while valor <= fim:
                yield valor
                valor += passo
        else:
            while valor >= fim:
                yield valor
                valor += passo
    
    # Usando o gerador
    for numero in contador(1, 10, 2):
        print(numero, end=" ")  # 1 3 5 7 9
    
    print()
    
    # Outro exemplo: gerador de Fibonacci
    def fibonacci(n):
        """Gera os primeiros n números da sequência de Fibonacci."""
        a, b = 0, 1
        gerados = 0
        
        while gerados < n:
            yield a
            a, b = b, a + b
            gerados += 1
    
    # Usando o gerador Fibonacci
    for numero in fibonacci(8):
        print(numero, end=" ")  # 0 1 1 2 3 5 8 13
    
    print()
    ```

=== "Estado e Fluxo de Execução"
    ```python
    def demonstracao_yield():
        """Demonstra como o yield pausa a execução."""
        print("Iniciando o gerador")
        yield 1
        print("Depois do primeiro yield")
        yield 2
        print("Depois do segundo yield")
        yield 3
        print("Gerador terminado")
    
    # Usando o gerador para entender o fluxo
    gerador = demonstracao_yield()
    
    # Cada next() executa até o próximo yield
    print("Chamando next() pela primeira vez")
    print(next(gerador))  # Imprime "Iniciando o gerador" e retorna 1
    
    print("Chamando next() pela segunda vez")
    print(next(gerador))  # Imprime "Depois do primeiro yield" e retorna 2
    
    print("Chamando next() pela terceira vez")
    print(next(gerador))  # Imprime "Depois do segundo yield" e retorna 3
    
    try:
        print("Chamando next() pela quarta vez")
        print(next(gerador))  # Levanta StopIteration após imprimir "Gerador terminado"
    except StopIteration:
        print("Gerador esgotado!")
    ```

=== "Geradores Infinitos"
    ```python
    def numeros_primos():
        """Gerador infinito de números primos."""
        
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
        
        n = 2
        while True:  # Loop infinito
            if eh_primo(n):
                yield n
            n += 1
    
    # Usando o gerador infinito (com cuidado!)
    primos = numeros_primos()
    
    # Obtendo os primeiros 10 primos
    primeiros_primos = [next(primos) for _ in range(10)]
    print(primeiros_primos)  # [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    
    # Para geradores infinitos, use ferramentas como islice
    import itertools
    proximos_primos = list(itertools.islice(numeros_primos(), 10, 20))
    print(proximos_primos)  # [31, 37, 41, 43, 47, 53, 59, 61, 67, 71]
    ```

=== "Enviando Valores para Geradores"
    ```python
    def gerador_eco():
        """Um gerador que ecoa o valor enviado a ele."""
        valor = yield "Pronto para receber"
        
        while True:
            if valor is None:
                valor = yield "Envie algo!"
            else:
                valor = yield f"Eco: {valor}"
    
    # Usando o método send()
    eco = gerador_eco()
    
    # Primeiro next() para iniciar o gerador (vai até o primeiro yield)
    primeira_msg = next(eco)
    print(primeira_msg)  # Pronto para receber
    
    # Enviando valores
    print(eco.send("Olá"))        # Eco: Olá
    print(eco.send("Python"))     # Eco: Python
    print(eco.send(None))         # Envie algo!
    print(eco.send(42))           # Eco: 42
    
    # Fechando um gerador
    eco.close()
    
    try:
        next(eco)
    except StopIteration:
        print("Gerador fechado")
    ```

## Expressões Geradoras

As expressões geradoras são semelhantes às compreensões de lista, mas retornam um gerador em vez de uma lista, economizando memória.

=== "Compreensão de Lista vs. Expressão Geradora"
    ```python
    import sys
    
    # Compreensão de lista (cria toda a lista na memória)
    lista = [x ** 2 for x in range(1000000)]
    
    # Expressão geradora (calcula valores sob demanda)
    gerador = (x ** 2 for x in range(1000000))
    
    # Comparando o uso de memória
    print(f"Tamanho da lista: {sys.getsizeof(lista)} bytes")        # ~8MB
    print(f"Tamanho do gerador: {sys.getsizeof(gerador)} bytes")    # ~112 bytes
    
    # Ambos podem ser usados em loops
    lista_pequena = [x for x in range(5)]  # [0, 1, 2, 3, 4]
    gerador_pequeno = (x for x in range(5))
    
    for num in lista_pequena:
        print(num, end=" ")  # 0 1 2 3 4
    
    print()
    
    for num in gerador_pequeno:
        print(num, end=" ")  # 0 1 2 3 4
    
    print()
    ```

=== "Encadeamento de Geradores"
    ```python
    # Geradores podem ser encadeados para criar pipelines de processamento
    
    # Exemplo: pipeline para processar números
    numeros = range(1, 11)  # 1 a 10
    
    # Filtrar pares, elevar ao quadrado, e somar 1
    pares = (x for x in numeros if x % 2 == 0)           # 2, 4, 6, 8, 10
    quadrados = (x**2 for x in pares)                    # 4, 16, 36, 64, 100
    resultados = (x + 1 for x in quadrados)              # 5, 17, 37, 65, 101
    
    # O cálculo só acontece quando o gerador é consumido
    for resultado in resultados:
        print(resultado, end=" ")  # 5 17 37 65 101
    
    print()
    
    # Também podemos usar funções embutidas que consomem iteráveis
    numeros = range(1, 11)
    resultado = sum((x**2 for x in numeros if x % 2 == 0))
    print(f"Soma dos quadrados dos números pares: {resultado}")  # 220
    ```

=== "Geradores como Argumentos de Funções"
    ```python
    # Muitas funções aceitam iteráveis, incluindo geradores
    
    # Exemplo: funções embutidas
    numeros = range(1, 101)
    
    # Com compreensões de lista
    multiplos_3_lista = [n for n in numeros if n % 3 == 0]
    print(f"Soma (lista): {sum(multiplos_3_lista)}")  # 1683
    print(f"Máximo (lista): {max(multiplos_3_lista)}")  # 99
    
    # Com expressões geradoras
    multiplos_3_gerador = (n for n in numeros if n % 3 == 0)
    print(f"Soma (gerador): {sum(multiplos_3_gerador)}")  # 1683
    
    # ATENÇÃO: gerador já foi consumido por sum()!
    # A próxima linha retornaria um erro ou resultado inesperado
    # print(f"Máximo (gerador): {max(multiplos_3_gerador)}")  # Não funciona!
    
    # Para usar várias vezes, crie novos geradores:
    print(f"Máximo: {max(n for n in numeros if n % 3 == 0)}")  # 99
    ```

## O Módulo itertools

O módulo `itertools` oferece ferramentas poderosas para trabalhar com iteradores.

=== "Funções de Combinação"
    ```python
    import itertools
    
    # product: produto cartesiano (todas as combinações)
    dados = [1, 2]
    faces = [1, 2, 3, 4, 5, 6]
    
    # Todas as combinações possíveis ao jogar dois dados
    jogadas = list(itertools.product(dados, faces))
    print(f"Jogadas possíveis: {len(jogadas)}")  # 12
    print(jogadas[:5])  # [(1, 1), (1, 2), (1, 3), (1, 4), (1, 5)]
    
    # permutations: todas as permutações (ordem importa)
    letras = ['A', 'B', 'C']
    permutacoes = list(itertools.permutations(letras))
    print(f"Permutações: {len(permutacoes)}")  # 6
    print(permutacoes)  # [('A', 'B', 'C'), ('A', 'C', 'B'), ..., ('C', 'B', 'A')]
    
    # combinations: combinações sem repetição (ordem não importa)
    combinacoes = list(itertools.combinations(letras, 2))
    print(f"Combinações de 2 letras: {len(combinacoes)}")  # 3
    print(combinacoes)  # [('A', 'B'), ('A', 'C'), ('B', 'C')]
    
    # combinations_with_replacement: combinações com repetição
    comb_rep = list(itertools.combinations_with_replacement(letras, 2))
    print(f"Combinações com repetição: {len(comb_rep)}")  # 6
    print(comb_rep)  # [('A', 'A'), ('A', 'B'), ('A', 'C'), ('B', 'B'), ('B', 'C'), ('C', 'C')]
    ```

=== "Funções de Filtragem"
    ```python
    import itertools
    
    # islice: fatiar um iterável
    numeros = itertools.count(1)  # Gerador infinito de números
    primeiros = list(itertools.islice(numeros, 5))  # Primeiros 5 números
    print(primeiros)  # [1, 2, 3, 4, 5]
    
    # Pulando elementos
    letras = "ABCDEFGHIJ"
    selecionadas = list(itertools.islice(letras, 1, 8, 2))  # Início, fim, passo
    print(selecionadas)  # ['B', 'D', 'F', 'H']
    
    # filterfalse: filtra elementos que NÃO satisfazem o predicado
    numeros = range(10)
    impares = list(itertools.filterfalse(lambda x: x % 2 == 0, numeros))
    print(impares)  # [1, 3, 5, 7, 9]
    
    # dropwhile e takewhile: descarta/pega elementos enquanto a condição for True
    valores = [1, 3, 5, 8, 7, 9, 2, 4]
    
    # Descarta enquanto for ímpar, depois pega todos
    resultado1 = list(itertools.dropwhile(lambda x: x % 2 == 1, valores))
    print(resultado1)  # [8, 7, 9, 2, 4]
    
    # Pega enquanto for menor que 7, depois descarta todos
    resultado2 = list(itertools.takewhile(lambda x: x < 7, valores))
    print(resultado2)  # [1, 3, 5]
    ```

=== "Geradores Infinitos"
    ```python
    import itertools
    
    # count: conta a partir de um número (parecido com range, mas infinito)
    contador = itertools.count(10, 2)  # Começa em 10, incrementa de 2 em 2
    print(list(itertools.islice(contador, 5)))  # [10, 12, 14, 16, 18]
    
    # cycle: cicla por um iterável indefinidamente
    ciclico = itertools.cycle(['A', 'B', 'C'])
    print([next(ciclico) for _ in range(7)])  # ['A', 'B', 'C', 'A', 'B', 'C', 'A']
    
    # repeat: repete um elemento n vezes (ou infinitamente)
    repetido = itertools.repeat('X', 5)
    print(list(repetido))  # ['X', 'X', 'X', 'X', 'X']
    ```

=== "Combinadores"
    ```python
    import itertools
    
    # chain: concatena iteráveis
    letras = ['A', 'B', 'C']
    numeros = [1, 2, 3]
    combinados = list(itertools.chain(letras, numeros))
    print(combinados)  # ['A', 'B', 'C', 1, 2, 3]
    
    # zip_longest: como zip, mas continua até o iterável mais longo terminar
    nomes = ['Ana', 'Carlos', 'Maria', 'Pedro']
    idades = [25, 30, 22]
    
    # O zip normal para no iterável mais curto
    print(list(zip(nomes, idades)))  # [('Ana', 25), ('Carlos', 30), ('Maria', 22)]
    
    # zip_longest usa o valor fillvalue para os elementos faltantes
    resultado = list(itertools.zip_longest(nomes, idades, fillvalue='Desconhecido'))
    print(resultado)  # [('Ana', 25), ('Carlos', 30), ('Maria', 22), ('Pedro', 'Desconhecido')]
    
    # groupby: agrupa elementos consecutivos por uma chave
    animais = ['cachorro', 'gato', 'coelho', 'cobra', 'camelo', 'galinha']
    
    # Agrupando por primeira letra
    animais_ordenados = sorted(animais, key=lambda x: x[0])  # Importante ordenar primeiro!
    for letra, grupo in itertools.groupby(animais_ordenados, key=lambda x: x[0]):
        print(f"Animais com {letra}: {list(grupo)}")
    # Animais com c: ['cachorro', 'camelo', 'cobra', 'coelho']
    # Animais com g: ['galinha']
    # Animais com g: ['gato']
    ```

## Aplicações Práticas

=== "Processamento de Arquivos Grandes"
    ```python
    def processar_arquivo_grande(nome_arquivo, tamanho_bloco=4096):
        """Lê um arquivo grande em blocos para economizar memória."""
        with open(nome_arquivo, 'r', encoding='utf-8') as arquivo:
            while True:
                bloco = arquivo.read(tamanho_bloco)
                if not bloco:
                    break
                yield bloco
    
    # Conta linha em um arquivo muito grande
    def contar_linhas(nome_arquivo):
        total = sum(bloco.count('\n') for bloco in processar_arquivo_grande(nome_arquivo))
        return total + 1  # +1 se o arquivo não terminar com quebra de linha
    
    # Procura texto em um arquivo grande
    def procurar_texto(nome_arquivo, texto):
        """Encontra todas as ocorrências de um texto em um arquivo grande."""
        for i, bloco in enumerate(processar_arquivo_grande(nome_arquivo)):
            posicoes = [j for j in range(len(bloco)) if bloco.startswith(texto, j)]
            for pos in posicoes:
                posicao_absoluta = i * 4096 + pos
                yield posicao_absoluta
    ```

=== "Pipeline de Processamento de Dados"
    ```python
    # Pipeline para análise de logs
    import re
    
    def ler_arquivo_log(nome_arquivo):
        """Gerador que lê um arquivo de log linha por linha."""
        with open(nome_arquivo, 'r') as arquivo:
            for linha in arquivo:
                yield linha.strip()
    
    def filtrar_erros(linhas):
        """Filtra apenas linhas com erros."""
        for linha in linhas:
            if "ERROR" in linha:
                yield linha
    
    def extrair_codigo_erro(linhas_erro):
        """Extrai o código de erro de cada linha."""
        padrao = r"ERROR (\d+):"
        for linha in linhas_erro:
            match = re.search(padrao, linha)
            if match:
                yield int(match.group(1))
    
    def contar_erros(codigos_erro):
        """Conta a frequência de cada código de erro."""
        contagem = {}
        for codigo in codigos_erro:
            contagem[codigo] = contagem.get(codigo, 0) + 1
        return contagem
    
    # Uso do pipeline
    def analisar_erros_log(nome_arquivo):
        linhas = ler_arquivo_log(nome_arquivo)
        linhas_erro = filtrar_erros(linhas)
        codigos = extrair_codigo_erro(linhas_erro)
        return contar_erros(codigos)
    
    # Resultado: {404: 23, 500: 12, 403: 5}
    ```

=== "Simulações e Modelagem"
    ```python
    import random
    
    def simulacao_clima(dias):
        """Simula o clima por um número específico de dias."""
        # Estados possíveis: ensolarado, nublado, chuvoso
        estado_atual = random.choice(["ensolarado", "nublado", "chuvoso"])
        
        # Probabilidades de transição (simplificadas)
        transicoes = {
            "ensolarado": {"ensolarado": 0.7, "nublado": 0.3, "chuvoso": 0.0},
            "nublado": {"ensolarado": 0.3, "nublado": 0.4, "chuvoso": 0.3},
            "chuvoso": {"ensolarado": 0.1, "nublado": 0.4, "chuvoso": 0.5}
        }
        
        for _ in range(dias):
            yield estado_atual
            
            # Determina o próximo estado
            probabilidades = transicoes[estado_atual]
            estados = list(probabilidades.keys())
            chances = list(probabilidades.values())
            estado_atual = random.choices(estados, weights=chances)[0]
    
    # Simulando 10 dias
    previsao = list(simulacao_clima(10))
    print(f"Previsão para 10 dias: {previsao}")
    
    # Análise da simulação
    contagem = {}
    for clima in previsao:
        contagem[clima] = contagem.get(clima, 0) + 1
    
    print("Distribuição do clima:")
    for clima, dias in contagem.items():
        print(f"{clima}: {dias} dias ({dias/10*100:.1f}%)")
    ```

## Boas Práticas e Padrões

=== "Quando Usar Geradores"
    ```python
    # Use geradores quando:
    
    # 1. Processando grandes volumes de dados
    # Ruim: números grandes demais para memória
    # numeros_grandes = [n for n in range(10**10) if n % 42 == 0]
    
    # Bom: processa sob demanda
    numeros_grandes = (n for n in range(10**10) if n % 42 == 0)
    
    # 2. Trabalhando com dados infinitos
    def todos_os_numeros():
        n = 0
        while True:
            yield n
            n += 1
    
    # 3. Criando pipelines de processamento
    def ler_dados(arquivo):
        with open(arquivo) as f:
            for linha in f:
                yield linha.strip()
    
    def filtrar_dados(linhas, filtro):
        for linha in linhas:
            if filtro in linha:
                yield linha
    
    def processar(linhas):
        for linha in linhas:
            yield linha.upper()
    
    # Uso: pipeline de processamento
    dados = ler_dados("dados.txt")
    filtrados = filtrar_dados(dados, "importante")
    resultado = processar(filtrados)
    ```

=== "Iteradores vs. Geradores"
    ```python
    # Iteradores (classes) são ideais quando:
    # - Precisa de mais controle sobre o estado
    # - A lógica é complexa
    # - Precisa de vários métodos auxiliares
    
    # Geradores (funções) são ideais quando:
    # - A lógica é mais simples e linear
    # - Quer minimizar o código boilerplate
    # - Não precisa manter muito estado
    
    # Compare as duas implementações:
    
    # 1. Com classe iterador
    class Quadrados:
        def __init__(self, n):
            self.n = n
            self.i = 0
            
        def __iter__(self):
            self.i = 0
            return self
            
        def __next__(self):
            if self.i >= self.n:
                raise StopIteration
            resultado = self.i ** 2
            self.i += 1
            return resultado
    
    # 2. Com gerador
    def quadrados(n):
        for i in range(n):
            yield i ** 2
    
    # Ambos têm o mesmo resultado:
    print(list(Quadrados(5)))   # [0, 1, 4, 9, 16]
    print(list(quadrados(5)))   # [0, 1, 4, 9, 16]
    ```

=== "Patterns de Iteração"
    ```python
    # 1. Consumindo iteráveis par a par
    dados = [1, 2, 3, 4, 5, 6]
    pares = zip(dados[::2], dados[1::2])  # [(1, 2), (3, 4), (5, 6)]
    
    # 2. Consumindo iteráveis com janela deslizante
    def janela_deslizante(iterable, n=2):
        """Retorna uma janela deslizante de largura n sobre os dados."""
        iteraveis = [iter(iterable)] * n
        return zip(*iteraveis)
    
    # Exemplo: médias móveis
    dados = [1, 3, 5, 8, 11, 14, 16]
    janelas = list(janela_deslizante(dados, 3))
    print(janelas)  # [(1, 3, 5), (8, 11, 14)]
    
    # Para janelas sobrepostas, use itertools.islice
    from itertools import islice
    
    def janela_sobreposta(iterable, n=3):
        """Cria janelas sobrepostas de tamanho n."""
        it = iter(iterable)
        window = list(islice(it, n))
        yield tuple(window)
        
        for item in it:
            window = window[1:] + [item]
            yield tuple(window)
    
    # Exemplo: médias móveis com janelas sobrepostas
    sobrepostas = list(janela_sobreposta(dados, 3))
    print(sobrepostas)  # [(1, 3, 5), (3, 5, 8), (5, 8, 11), (8, 11, 14), (11, 14, 16)]
    
    # 3. Agrupando dados (semelhante a GROUP BY em SQL)
    from itertools import groupby
    
    # Dados ordenados por categoria
    dados = [
        ("fruta", "maçã"),
        ("fruta", "banana"),
        ("legume", "cenoura"),
        ("legume", "batata"),
        ("fruta", "uva")
    ]
    
    # Agrupa por categoria
    dados_ordenados = sorted(dados, key=lambda x: x[0])
    
    for categoria, itens in groupby(dados_ordenados, key=lambda x: x[0]):
        print(f"{categoria}: {list(item[1] for item in itens)}")
    # fruta: ['maçã', 'banana', 'uva']
    # legume: ['cenoura', 'batata']
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Protocolo de iteração** do Python e como ele funciona nos bastidores
- A diferença entre **iteráveis** e **iteradores**
- Como criar **iteradores personalizados** implementando `__iter__` e `__next__`
- **Geradores** como forma simplificada de criar iteradores
- **Expressões geradoras** como alternativas eficientes às compreensões de lista
- Ferramentas do módulo **itertools** para manipulação avançada de iteradores
- **Aplicações práticas** de iteradores e geradores
- **Boas práticas** e quando usar cada abordagem

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre iteradores](https://docs.python.org/3/tutorial/classes.html#iterators){:target="_blank"}
    - [Documentação oficial sobre geradores](https://docs.python.org/3/tutorial/classes.html#generators){:target="_blank"}
    - [Documentação do módulo itertools](https://docs.python.org/3/library/itertools.html){:target="_blank"}
    - [PEP 255 - Expressões Geradoras](https://peps.python.org/pep-0255/){:target="_blank"}
    - [PEP 289 - Expressões Geradoras](https://peps.python.org/pep-0289/){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos decoradores em Python, um poderoso mecanismo para modificar o comportamento de funções e classes.

[Avance para a próxima aula →](//trilhas/python/page-12)

[← Voltar para Manipulação de Arquivos](//trilhas/python/page-10)