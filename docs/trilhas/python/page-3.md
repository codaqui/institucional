# Estruturas de Repetição em Python

## Introdução

Estruturas de repetição, também conhecidas como loops, são blocos de código que permitem executar instruções repetidamente, até que uma condição específica seja atingida. Elas são fundamentais para automatizar tarefas repetitivas e processar coleções de dados.

!!! info "Objetivos de Aprendizado"
    - Entender os diferentes tipos de estruturas de repetição em Python
    - Aprender a usar loops `for` para iteração sobre sequências
    - Dominar loops `while` para repetições baseadas em condições
    - Compreender comandos de controle como `break` e `continue`
    - Aplicar loops em situações práticas

## Loop For

O loop `for` em Python é usado para iterar sobre uma sequência (como lista, tupla, dicionário, conjunto ou string) ou outros objetos iteráveis.

=== "Sintaxe Básica"
    ```python
    for item in sequência:
        # código a ser executado para cada item
    ```

=== "Iterando sobre uma Lista"
    ```python
    frutas = ["maçã", "banana", "laranja"]
    for fruta in frutas:
        print(fruta)
    ```

=== "Iterando sobre uma String"
    ```python
    palavra = "Python"
    for letra in palavra:
        print(letra)
    ```

### Função range()

A função `range()` é frequentemente usada com loops `for` para gerar uma sequência de números:

=== "Conceito"
    ```python
    # range(stop) - começa em 0, vai até stop-1
    for i in range(5):
        print(i)  # Imprime 0, 1, 2, 3, 4
    
    # range(start, stop) - começa em start, vai até stop-1
    for i in range(2, 6):
        print(i)  # Imprime 2, 3, 4, 5
    
    # range(start, stop, step) - começa em start, vai até stop-1, incrementando de step em step
    for i in range(1, 10, 2):
        print(i)  # Imprime 1, 3, 5, 7, 9
    ```

### Enumerate

A função `enumerate()` adiciona um contador a um iterável, retornando pares de índice e valor:

=== "Conceito"
    ```python
    animais = ["gato", "cachorro", "pássaro"]
    for indice, animal in enumerate(animais):
        print(f"Índice {indice}: {animal}")
        
    # Saída:
    # Índice 0: gato
    # Índice 1: cachorro
    # Índice 2: pássaro
    ```

## Loop While

O loop `while` repete um bloco de código enquanto uma condição especificada for verdadeira:

=== "Sintaxe Básica"
    ```python
    while condição:
        # código a ser executado enquanto a condição for verdadeira
    ```

=== "Exemplo Simples"
    ```python
    contador = 0
    while contador < 5:
        print(contador)
        contador += 1  # Importante: incrementar o contador para evitar loop infinito
    ```

!!! warning "Cuidado com Loops Infinitos"
    Sempre certifique-se de que a condição do loop `while` eventualmente se tornará falsa, caso contrário, você criará um loop infinito que só será interrompido forçando a interrupção do programa.

## Controle de Fluxo em Loops

### break

A instrução `break` interrompe a execução do loop, mesmo que a condição ainda seja verdadeira:

=== "Conceito"
    ```python
    for i in range(10):
        if i == 5:
            break  # Sai do loop quando i é 5
        print(i)   # Imprime apenas 0, 1, 2, 3, 4
    ```

### continue

A instrução `continue` pula a iteração atual e continua com a próxima:

=== "Conceito"
    ```python
    for i in range(10):
        if i % 2 == 0:  # Se i for par
            continue    # Pula para a próxima iteração
        print(i)        # Imprime apenas números ímpares: 1, 3, 5, 7, 9
    ```

### else em Loops

Python permite usar uma cláusula `else` com loops. O bloco de código no `else` é executado quando o loop termina normalmente (sem `break`):

=== "Conceito"
    ```python
    for i in range(5):
        print(i)
    else:
        print("Loop concluído normalmente")
    
    # Com break
    for i in range(5):
        if i == 3:
            break
        print(i)
    else:
        print("Este texto não será impresso porque o loop foi interrompido por break")
    ```

## Loops Aninhados

Podemos ter um loop dentro de outro loop, criando loops aninhados:

=== "Conceito"
    ```python
    # Criando uma matriz 3x3
    for i in range(3):  # Loop externo
        for j in range(3):  # Loop interno
            print(f"({i},{j})", end=" ")
        print()  # Nova linha após cada linha da matriz
    
    # Saída:
    # (0,0) (0,1) (0,2) 
    # (1,0) (1,1) (1,2) 
    # (2,0) (2,1) (2,2) 
    ```

## Compreensão de Lista (List Comprehension)

Python oferece uma sintaxe concisa para criar listas baseadas em listas existentes, chamada list comprehension:

=== "Conceito"
    ```python
    # Forma tradicional com loop for
    quadrados = []
    for i in range(1, 6):
        quadrados.append(i**2)
    print(quadrados)  # [1, 4, 9, 16, 25]
    
    # Usando list comprehension
    quadrados = [i**2 for i in range(1, 6)]
    print(quadrados)  # [1, 4, 9, 16, 25]
    
    # List comprehension com condição
    pares = [i for i in range(1, 11) if i % 2 == 0]
    print(pares)  # [2, 4, 6, 8, 10]
    ```

!!! tip "Dica"
    List comprehensions tornam o código mais conciso e frequentemente mais legível para operações simples. No entanto, para lógica complexa, um loop tradicional pode ser mais claro.

## Exemplos Práticos

### Calculando a Soma dos Números

=== "Usando for"
    ```python
    # Soma dos números de 1 a 10
    soma = 0
    for num in range(1, 11):
        soma += num
    print(f"A soma dos números de 1 a 10 é: {soma}")  # 55
    ```

=== "Usando while"
    ```python
    # Soma dos números de 1 a 10
    soma = 0
    num = 1
    while num <= 10:
        soma += num
        num += 1
    print(f"A soma dos números de 1 a 10 é: {soma}")  # 55
    ```

### Encontrando Números Primos

=== "Conceito"
    ```python
    # Verificando se um número é primo
    def eh_primo(n):
        if n <= 1:
            return False
        if n <= 3:
            return True
        if n % 2 == 0 or n % 3 == 0:
            return False
        i = 5
        while i * i <= n:
            if n % i == 0 ou n % (i + 2) == 0:
                return False
            i += 6
        return True
    
    # Encontrando números primos de 1 a 20
    primos = []
    for i in range(1, 21):
        if eh_primo(i):
            primos.append(i)
    
    print(f"Números primos de 1 a 20: {primos}")  # [2, 3, 5, 7, 11, 13, 17, 19]
    ```

### Iterando sobre Estruturas de Dados

=== "Iterando sobre Dicionários"
    ```python
    pessoa = {
        "nome": "Ana",
        "idade": 28,
        "profissão": "Engenheira"
    }
    
    # Iterando sobre chaves
    for chave in pessoa:
        print(chave)
    
    # Iterando sobre valores
    for valor in pessoa.values():
        print(valor)
    
    # Iterando sobre pares chave-valor
    for chave, valor in pessoa.items():
        print(f"{chave}: {valor}")
    ```

=== "Iterando sobre Listas Aninhadas"
    ```python
    matriz = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
    ]
    
    # Acessando cada elemento da matriz
    for linha in matriz:
        for elemento em linha:
            print(elemento, end=" ")
        print()  # Nova linha após cada linha da matriz
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Loops `for`** para iterar sobre sequências como listas, strings e ranges
- **Loops `while`** para repetições baseadas em condições
- **Comandos de controle** como `break` e `continue` para modificar o fluxo do loop
- **Função `range()`** para gerar sequências numéricas
- **List comprehensions** como uma forma concisa de criar listas
- **Loops aninhados** para trabalhar com estruturas de dados multidimensionais

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre loops for](https://docs.python.org/3/tutorial/controlflow.html#for-statements){:target="_blank"}
    - [Documentação oficial sobre loops while](https://docs.python.org/3/reference/compound_stmts.html#the-while-statement){:target="_blank"}
    - [Documentação sobre list comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions){:target="_blank"}

## Próximos Passos

Na próxima aula, aprenderemos sobre funções em Python, que nos permitem organizar o código em blocos reutilizáveis.

[Avance para a próxima aula →](/docs/trilhas/python/page-4.md)

[← Voltar para Estruturas Lógicas e Condicionais](/docs/trilhas/python/page-2.md)