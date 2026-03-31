# Funções em Python

## Introdução

Funções são blocos de código reutilizáveis que realizam uma tarefa específica. Elas permitem organizar o código, evitar repetições e facilitar a manutenção. As funções são um dos conceitos fundamentais da programação e um pilar da programação modular.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito e a importância das funções
    - Aprender a definir e chamar funções
    - Compreender parâmetros e argumentos
    - Explorar o retorno de valores
    - Dominar técnicas avançadas como funções anônimas (lambda)
    - Aplicar funções em situações práticas

## Definindo Funções

Em Python, funções são definidas com a palavra-chave `def`, seguida do nome da função e de parênteses que podem conter parâmetros.

=== "Sintaxe Básica"
    ```python
    def nome_da_funcao(parametro1, parametro2, ...):
        """Docstring: documentação da função."""
        # Corpo da função
        # Código que será executado quando a função for chamada
        return valor  # Opcional
    ```

=== "Exemplo Simples"
    ```python
    def saudacao():
        """Imprime uma saudação simples."""
        print("Olá, mundo!")
    
    # Chamando a função
    saudacao()  # Saída: Olá, mundo!
    ```

!!! tip "Boas Práticas"
    - Use nomes descritivos para funções (verbos que indiquem ação)
    - Siga a convenção snake_case para nomes de funções em Python
    - Inclua docstrings para documentar o propósito da função
    - Mantenha funções pequenas e focadas em uma única tarefa

## Parâmetros e Argumentos

Parâmetros são variáveis listadas na definição da função. Argumentos são os valores reais passados para a função quando ela é chamada.

=== "Parâmetros Posicionais"
    ```python
    def somar(a, b):
        """Soma dois números e retorna o resultado."""
        return a + b
    
    # Chamando com argumentos posicionais
    resultado = somar(5, 3)  # resultado = 8
    ```

=== "Parâmetros Nomeados"
    ```python
    def saudacao(nome, mensagem):
        """Cria uma saudação personalizada."""
        return f"{mensagem}, {nome}!"
    
    # Argumentos nomeados (a ordem não importa)
    msg = saudacao(mensagem="Bom dia", nome="Ana")
    print(msg)  # Saída: Bom dia, Ana!
    
    # Misturando posicionais e nomeados
    # Posicionais vêm primeiro, depois os nomeados
    msg = saudacao("Carlos", mensagem="Boa tarde")
    print(msg)  # Saída: Boa tarde, Carlos!
    ```

### Parâmetros Padrão

Os parâmetros podem ter valores padrão que são usados quando um argumento não é fornecido.

=== "Conceito"
    ```python
    def saudacao(nome, mensagem="Olá"):
        """Cria uma saudação com mensagem padrão opcional."""
        return f"{mensagem}, {nome}!"
    
    print(saudacao("Maria"))         # Saída: Olá, Maria!
    print(saudacao("João", "Oi"))    # Saída: Oi, João!
    ```

!!! warning "Cuidado com Valores Padrão Mutáveis"
    Nunca use tipos mutáveis (como listas ou dicionários) como valores padrão. Eles são avaliados apenas uma vez, quando a função é definida.
    
    ```python
    # Problemático:
    def adicionar_item(item, lista=[]):
        lista.append(item)
        return lista
    
    # Correto:
    def adicionar_item(item, lista=None):
        if lista is None:
            lista = []
        lista.append(item)
        return lista
    ```

### Número Variável de Argumentos

Python permite definir funções que aceitam um número variável de argumentos.

=== "*args (Argumentos Posicionais)"
    ```python
    def soma_tudo(*args):
        """Soma todos os argumentos posicionais."""
        total = 0
        for numero in args:
            total += numero
        return total
    
    print(soma_tudo(1, 2, 3))        # Saída: 6
    print(soma_tudo(1, 2, 3, 4, 5))  # Saída: 15
    ```

=== "**kwargs (Argumentos Nomeados)"
    ```python
    def info_pessoa(**kwargs):
        """Imprime informações sobre uma pessoa."""
        for chave, valor in kwargs.items():
            print(f"{chave}: {valor}")
    
    info_pessoa(nome="Ana", idade=30, profissao="Engenheira")
    # Saída:
    # nome: Ana
    # idade: 30
    # profissao: Engenheira
    ```

=== "Combinando Todos os Tipos"
    ```python
    def minha_funcao(arg1, arg2, *args, kwarg1="default", **kwargs):
        """Demonstra todos os tipos de argumentos."""
        print(f"arg1: {arg1}")
        print(f"arg2: {arg2}")
        print(f"args: {args}")
        print(f"kwarg1: {kwarg1}")
        print(f"kwargs: {kwargs}")
    
    minha_funcao(1, 2, 3, 4, 5, kwarg1="personalizado", x=10, y=20)
    # Saída:
    # arg1: 1
    # arg2: 2
    # args: (3, 4, 5)
    # kwarg1: personalizado
    # kwargs: {'x': 10, 'y': 20}
    ```

## Retorno de Valores

A instrução `return` é usada para especificar o valor que uma função deve retornar. Uma função pode retornar zero, um ou múltiplos valores.

=== "Sem Retorno Explícito"
    ```python
    def saudacao(nome):
        """Imprime uma saudação e não retorna valor explícito."""
        print(f"Olá, {nome}!")
    
    # A função retorna None implicitamente
    resultado = saudacao("Maria")
    print(f"Valor retornado: {resultado}")  # Saída: Valor retornado: None
    ```

=== "Retornando um Valor"
    ```python
    def quadrado(numero):
        """Retorna o quadrado de um número."""
        return numero ** 2
    
    resultado = quadrado(5)
    print(f"O quadrado de 5 é {resultado}")  # Saída: O quadrado de 5 é 25
    ```

=== "Retornando Múltiplos Valores"
    ```python
    def minmax(numeros):
        """Retorna o menor e o maior valor de uma sequência."""
        return min(numeros), max(numeros)
    
    # Desempacotamento de tupla
    menor, maior = minmax([5, 2, 8, 1, 9])
    print(f"Menor: {menor}, Maior: {maior}")  # Saída: Menor: 1, Maior: 9
    ```

=== "Retorno Condicional"
    ```python
    def divisao_segura(a, b):
        """Divide a por b, tratando divisão por zero."""
        if b == 0:
            return "Erro: Divisão por zero"
        return a / b
    
    print(divisao_segura(10, 2))  # Saída: 5.0
    print(divisao_segura(10, 0))  # Saída: Erro: Divisão por zero
    ```

## Escopo de Variáveis

As variáveis em Python têm diferentes escopos (visibilidade), dependendo de onde são definidas.

=== "Escopo Local vs. Global"
    ```python
    # Variável global
    x = 10
    
    def funcao():
        # Variável local
        y = 5
        print(f"Dentro da função - x: {x}, y: {y}")
    
    funcao()  # Saída: Dentro da função - x: 10, y: 5
    
    # A variável y não está disponível aqui
    print(f"Fora da função - x: {x}")
    # print(f"y: {y}")  # Erro: NameError: name 'y' is not defined
    ```

=== "Modificando Variáveis Globais"
    ```python
    contador = 0
    
    def incrementar():
        global contador  # Declara que contador se refere à variável global
        contador += 1
        print(f"Contador dentro da função: {contador}")
    
    print(f"Contador antes: {contador}")  # Saída: Contador antes: 0
    incrementar()                         # Saída: Contador dentro da função: 1
    print(f"Contador depois: {contador}") # Saída: Contador depois: 1
    ```

=== "Escopo Nonlocal"
    ```python
    def externa():
        x = 10
        
        def interna():
            nonlocal x  # Refere-se à variável x da função externa
            x += 5
            print(f"x dentro da função interna: {x}")
        
        print(f"x antes da função interna: {x}")
        interna()
        print(f"x depois da função interna: {x}")
    
    externa()
    # Saída:
    # x antes da função interna: 10
    # x dentro da função interna: 15
    # x depois da função interna: 15
    ```

## Funções Anônimas (Lambda)

Funções lambda são pequenas funções anônimas definidas com a palavra-chave `lambda`. Elas podem ter qualquer número de argumentos, mas apenas uma expressão.

=== "Sintaxe Básica"
    ```python
    # lambda argumentos: expressão
    quadrado = lambda x: x ** 2
    
    print(quadrado(5))  # Saída: 25
    ```

=== "Uso com Funções de Ordem Superior"
    ```python
    # Ordenando uma lista de tuplas pelo segundo elemento
    pares = [(1, 'um'), (3, 'três'), (2, 'dois'), (4, 'quatro')]
    
    # Usando lambda como função de chave para sorted()
    pares_ordenados = sorted(pares, key=lambda x: x[1])
    print(pares_ordenados)  # [(4, 'quatro'), (2, 'dois'), (3, 'três'), (1, 'um')]
    
    # Usando com filter()
    numeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    pares = list(filter(lambda x: x % 2 == 0, numeros))
    print(pares)  # [2, 4, 6, 8, 10]
    
    # Usando com map()
    quadrados = list(map(lambda x: x ** 2, numeros))
    print(quadrados)  # [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
    ```

!!! info "Quando Usar Lambda vs. Funções Regulares"
    Use lambdas para funções simples e de uso único. Para lógica mais complexa ou código reutilizável, prefira funções regulares definidas com `def`.

## Recursividade

Uma função recursiva é uma função que chama a si mesma dentro de sua definição.

=== "Exemplo: Fatorial"
    ```python
    def fatorial(n):
        """Calcula o fatorial de n recursivamente."""
        if n <= 1:
            return 1
        return n * fatorial(n - 1)
    
    print(fatorial(5))  # Saída: 120 (5! = 5 * 4 * 3 * 2 * 1)
    ```

=== "Exemplo: Fibonacci"
    ```python
    def fibonacci(n):
        """Retorna o n-ésimo número da sequência de Fibonacci."""
        if n <= 0:
            return 0
        elif n == 1:
            return 1
        else:
            return fibonacci(n - 1) + fibonacci(n - 2)
    
    # Primeiros 10 números de Fibonacci
    for i in range(10):
        print(fibonacci(i), end=" ")  # Saída: 0 1 1 2 3 5 8 13 21 34
    ```

!!! warning "Cuidado com Recursão Profunda"
    Python tem um limite padrão para a profundidade da recursão (normalmente 1000). Para cálculos complexos, considere abordagens iterativas ou otimizações como memoização.

## Funções como Objetos de Primeira Classe

Em Python, funções são objetos de primeira classe, o que significa que podem ser:
- Atribuídas a variáveis
- Passadas como argumentos para outras funções
- Retornadas por outras funções
- Armazenadas em estruturas de dados

=== "Funções como Variáveis"
    ```python
    def saudacao(nome):
        return f"Olá, {nome}!"
    
    # Atribuindo função a uma variável
    f = saudacao
    
    # Chamando através da variável
    print(f("Maria"))  # Saída: Olá, Maria!
    ```

=== "Funções como Argumentos"
    ```python
    def aplicar_operacao(func, valor):
        """Aplica uma função a um valor e retorna o resultado."""
        return func(valor)
    
    def dobro(x):
        return x * 2
    
    def quadrado(x):
        return x ** 2
    
    print(aplicar_operacao(dobro, 5))     # Saída: 10
    print(aplicar_operacao(quadrado, 5))  # Saída: 25
    ```

=== "Funções Retornando Funções"
    ```python
    def criar_multiplicador(fator):
        """Retorna uma função que multiplica pelo fator especificado."""
        def multiplicar(x):
            return x * fator
        return multiplicar
    
    duplicar = criar_multiplicador(2)
    triplicar = criar_multiplicador(3)
    
    print(duplicar(5))   # Saída: 10
    print(triplicar(5))  # Saída: 15
    ```

## Decoradores

Decoradores são funções que modificam o comportamento de outras funções. Eles permitem estender ou alterar o comportamento de funções sem modificar seu código.

=== "Conceito Básico"
    ```python
    def meu_decorador(func):
        def wrapper():
            print("Algo antes da função original")
            func()
            print("Algo depois da função original")
        return wrapper
    
    @meu_decorador
    def funcao():
        print("Função original executada")
    
    # Chamando a função decorada
    funcao()
    # Saída:
    # Algo antes da função original
    # Função original executada
    # Algo depois da função original
    ```

=== "Decorador com Argumentos"
    ```python
    def meu_decorador(func):
        def wrapper(*args, **kwargs):
            print("Antes da função")
            resultado = func(*args, **kwargs)
            print("Depois da função")
            return resultado
        return wrapper
    
    @meu_decorador
    def soma(a, b):
        print(f"Somando {a} + {b}")
        return a + b
    
    resultado = soma(3, 5)
    print(f"Resultado: {resultado}")
    # Saída:
    # Antes da função
    # Somando 3 + 5
    # Depois da função
    # Resultado: 8
    ```

=== "Decorador com Argumentos Próprios"
    ```python
    def repetir(n):
        def decorador(func):
            def wrapper(*args, **kwargs):
                for _ in range(n):
                    resultado = func(*args, **kwargs)
                return resultado
            return wrapper
        return decorador
    
    @repetir(3)
    def saudacao(nome):
        print(f"Olá, {nome}!")
        return nome
    
    saudacao("Maria")
    # Saída:
    # Olá, Maria!
    # Olá, Maria!
    # Olá, Maria!
    ```

## Geradores

Geradores são funções especiais que retornam um iterador. Eles usam a palavra-chave `yield` em vez de `return` para fornecer valores um por vez, mantendo o estado da função entre chamadas.

=== "Função Geradora Básica"
    ```python
    def contagem(maximo):
        """Gera números de 1 até 'maximo'."""
        n = 1
        while n <= maximo:
            yield n
            n += 1
    
    # Usando o gerador
    for numero in contagem(5):
        print(numero, end=" ")  # Saída: 1 2 3 4 5
    
    # Ou convertendo para lista
    numeros = list(contagem(5))
    print(numeros)  # Saída: [1, 2, 3, 4, 5]
    ```

=== "Gerador com Expressão"
    ```python
    # Expressão geradora (semelhante à compreensão de lista, mas com parênteses)
    quadrados = (x**2 for x in range(1, 6))
    
    print(next(quadrados))  # Saída: 1
    print(next(quadrados))  # Saída: 4
    
    # Iterando sobre os valores restantes
    for valor in quadrados:
        print(valor, end=" ")  # Saída: 9 16 25
    ```

!!! tip "Vantagens dos Geradores"
    - Eficiência de memória: geram valores sob demanda, não armazenam todos na memória
    - Úteis para sequências infinitas ou muito grandes
    - Mantêm o estado entre chamadas

## Funções Integradas (Built-in)

Python possui diversas funções integradas que são sempre disponíveis.

=== "Funções Comuns"
    ```python
    # len() - comprimento de um objeto
    print(len("Python"))  # Saída: 6
    
    # range() - sequência de números
    lista = list(range(1, 6))
    print(lista)  # Saída: [1, 2, 3, 4, 5]
    
    # type() - tipo do objeto
    print(type(123))      # Saída: <class 'int'>
    print(type("texto"))  # Saída: <class 'str'>
    
    # map() - aplica função a cada item de um iterável
    numeros = [1, 2, 3, 4]
    quadrados = list(map(lambda x: x**2, numeros))
    print(quadrados)  # Saída: [1, 4, 9, 16]
    
    # filter() - filtra itens por uma função
    numeros = [1, 2, 3, 4, 5, 6]
    pares = list(filter(lambda x: x % 2 == 0, numeros))
    print(pares)  # Saída: [2, 4, 6]
    
    # sorted() - retorna lista ordenada
    frutas = ["banana", "maçã", "laranja"]
    ordenadas = sorted(frutas)
    print(ordenadas)  # Saída: ['banana', 'laranja', 'maçã']
    ```

!!! info "Lista Completa"
    Consulte a [documentação oficial](https://docs.python.org/3/library/functions.html){:target="_blank"} para uma lista completa das funções integradas em Python.

## Boas Práticas

=== "Princípio da Responsabilidade Única"
    ```python
    # RUIM: função faz várias coisas
    def processar_dados(dados):
        # Limpa dados
        # Calcula estatísticas
        # Gera gráficos
        # Salva resultados
        pass
    
    # BOM: funções separadas para cada responsabilidade
    def limpar_dados(dados):
        return dados_limpos
    
    def calcular_estatisticas(dados_limpos):
        return estatisticas
    
    def gerar_graficos(estatisticas):
        return graficos
    
    def salvar_resultados(estatisticas, graficos):
        pass
    ```

=== "Documentação Clara"
    ```python
    def calcular_media(numeros):
        """
        Calcula a média aritmética de uma sequência de números.
        
        Args:
            numeros (list): Uma lista de números.
            
        Returns:
            float: A média aritmética dos números.
            
        Raises:
            ValueError: Se a lista estiver vazia.
            
        Examples:
            >>> calcular_media([1, 2, 3, 4, 5])
            3.0
        """
        if not numeros:
            raise ValueError("A lista não pode estar vazia")
        return sum(numeros) / len(numeros)
    ```

=== "Tratamento de Erros"
    ```python
    def dividir(a, b):
        """Divide a por b com tratamento de erro."""
        try:
            return a / b
        except ZeroDivisionError:
            print("Erro: Divisão por zero!")
            return None
    
    print(dividir(10, 2))  # Saída: 5.0
    print(dividir(10, 0))  # Saída: Erro: Divisão por zero! None
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Definição de funções** com a palavra-chave `def`
- **Parâmetros e argumentos**, incluindo argumentos posicionais, nomeados e valores padrão
- **Número variável de argumentos** com `*args` e `**kwargs`
- **Retorno de valores** com a instrução `return`
- **Escopo de variáveis** (local, global e nonlocal)
- **Funções anônimas** (lambda) para expressões simples
- **Recursividade** para resolver problemas que se decompõem em problemas menores
- **Funções como objetos** de primeira classe
- **Decoradores** para modificar o comportamento de funções
- **Geradores** para criar iteradores de forma eficiente
- **Funções integradas** do Python
- **Boas práticas** para escrever funções claras e eficientes

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre funções](https://docs.python.org/3/tutorial/controlflow.html#defining-functions){:target="_blank"}
    - [Documentação sobre funções integradas](https://docs.python.org/3/library/functions.html){:target="_blank"}
    - [Python PEP 8 - Guia de Estilo](https://peps.python.org/pep-0008/#function-and-variable-names){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos a programação orientada a objetos em Python, incluindo classes, objetos, herança e polimorfismo.

[Avance para a próxima aula →](/trilhas/python/page-6)

[← Voltar para Coleções](/trilhas/python/page-4)