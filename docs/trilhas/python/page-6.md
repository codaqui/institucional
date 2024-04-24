# Comprehensions em Python

## Resumo

Comprehensions são uma forma concisa de criar coleções em Python. Elas permitem que você crie listas, dicionários e conjuntos de forma mais simples e legível. Nesta aula, iremos estudar como utilizar comprehensions em Python.

### Exemplos

Comprehensions são definidas com colchetes `[]`, chaves `{}` ou parênteses `()`, seguidos de uma expressão e um loop `for`.

```python
# Lista de números pares até 10
pares = [x for x in range(10) if x % 2 == 0]

# Dicionário de nome e idade para cada pessoa
pessoas = {"João": 25, "Maria": 30, "José": 35}
pessoas_invertido = {idade: nome for nome, idade in pessoas.items()}
```

## Referências

- [Comprehensions no Python](https://pythonacademy.com.br/blog/list-comprehensions-no-python)

- [Comprehension](https://pythonhelp.wordpress.com/2011/03/01/list-comprehension/)