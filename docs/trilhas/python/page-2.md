# Estruturas Lógicas e Condicionais em Python

## Introdução

As estruturas condicionais permitem que um programa execute diferentes comandos de acordo com as condições estabelecidas. Elas são fundamentais para criar programas que precisam tomar decisões baseadas em condições específicas.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito de expressões booleanas
    - Aprender a utilizar estruturas condicionais `if`, `else` e `elif`
    - Compreender operadores de comparação e lógicos
    - Praticar a criação de código com fluxo condicional

!!! tip "Dica"
    Quer saber como comentar ou "descomentar" várias linhas de código ao mesmo tempo? Use ++ctrl+"/"++ no Windows e Linux, ou ++cmd+"/"++ no MacOS.

## Operadores de Comparação

Operadores de comparação são usados para comparar valores e retornam valores booleanos (`True` ou `False`):

=== "Conceito"
    ```python
    # Operadores de comparação
    a = 10
    b = 5
    
    print(a == b)  # Igual a (False)
    print(a != b)  # Diferente de (True)
    print(a > b)   # Maior que (True)
    print(a < b)   # Menor que (False)
    print(a >= b)  # Maior ou igual a (True)
    print(a <= b)  # Menor ou igual a (False)
    ```

## Operadores Lógicos

Operadores lógicos combinam expressões booleanas:

=== "Conceito"
    ```python
    # Operadores lógicos
    x = True
    y = False
    
    print(x and y)  # AND lógico (False)
    print(x or y)   # OR lógico (True)
    print(not x)    # NOT lógico (False)
    ```

## Estruturas Condicionais

### if, else e elif

A estrutura `if` permite executar um bloco de código apenas se uma condição for verdadeira.

=== "Estrutura básica"
    ```python
    if condição:
        # código a ser executado se a condição for verdadeira
    else:
        # código a ser executado se a condição for falsa
    ```

=== "Exemplo Simples"
    ```python
    # Verificando se um número é par ou ímpar
    numero = 10
    
    if numero % 2 == 0:
        print("O número é par.")
    else:
        print("O número é ímpar.")
    ```

### Estruturas condicionais aninhadas

Podemos usar `elif` (abreviação de "else if") para verificar múltiplas condições:

=== "Estrutura com elif"
    ```python
    # Verificando a faixa etária
    idade = 18
    
    if idade < 12:
        print("Criança")
    elif idade < 18:
        print("Adolescente")
    elif idade < 65:
        print("Adulto")
    else:
        print("Idoso")
    ```

### Operador ternário

Python também suporta uma sintaxe compacta para condicionais simples:

=== "Conceito"
    ```python
    # Sintaxe: valor_se_verdadeiro if condição else valor_se_falso
    idade = 20
    status = "Maior de idade" if idade >= 18 else "Menor de idade"
    print(status)  # Saída: Maior de idade
    ```

## Avaliação de Expressões Booleanas

Python considera certos valores como "falsos" em contextos booleanos:

=== "Valores Falsos"
    ```python
    # Valores avaliados como False:
    if False:
        print("Nunca executado")
    
    if None:
        print("Nunca executado")
    
    if 0:
        print("Nunca executado")
    
    if "":  # String vazia
        print("Nunca executado")
    
    if []:  # Lista vazia
        print("Nunca executado")
    
    # Qualquer outro valor é considerado True
    if 1:
        print("Executado")  # Será impresso
    
    if "texto":
        print("Executado")  # Será impresso
    ```

!!! warning "Cuidado com comparações"
    Tenha cuidado ao comparar valores em Python, especialmente com tipos diferentes. Por exemplo, `0 == False` retorna `True`, mas `0 is False` retorna `False` porque são objetos diferentes.

## Exemplos Práticos

=== "Classificação de Notas"
    ```python
    # Sistema de classificação de notas
    nota = 85
    
    if nota >= 90:
        conceito = "A"
    elif nota >= 80:
        conceito = "B"
    elif nota >= 70:
        conceito = "C"
    elif nota >= 60:
        conceito = "D"
    else:
        conceito = "F"
    
    print(f"Nota: {nota}, Conceito: {conceito}")  # Saída: Nota: 85, Conceito: B
    ```

=== "Verificação de Ano Bissexto"
    ```python
    # Verificando se um ano é bissexto
    ano = 2024
    
    if (ano % 4 == 0 and ano % 100 != 0) or (ano % 400 == 0):
        print(f"{ano} é um ano bissexto.")
    else:
        print(f"{ano} não é um ano bissexto.")
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Operadores de comparação** para avaliar relações entre valores
- **Operadores lógicos** para combinar expressões booleanas
- **Estruturas condicionais** `if`, `else` e `elif` para controlar o fluxo do programa
- **Expressões ternárias** para condicionais simples em uma única linha
- **Valores considerados falsos** em contextos booleanos

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre expressões condicionais](https://docs.python.org/3/tutorial/controlflow.html#if-statements){:target="_blank"}
    - [Documentação sobre operadores de comparação](https://docs.python.org/3/library/stdtypes.html#comparisons){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos estruturas de repetição (loops) como `for` e `while`, que permitem executar blocos de código repetidamente.

[Avance para a próxima aula →](/trilhas/python/page-3)

[← Voltar para Variáveis e Tipos de Dados](/trilhas/python/page-1)

