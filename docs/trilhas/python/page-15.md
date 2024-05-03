# Testes com Python

## Resumo

Os testes servem para antecipar e corrigir falhas e bugs que apareceriam para o usuário final. Neste tópico iremos apresentar como fazer testes em um programa.

### Exemplos

Crie uma função que soma dois números inteiros:

```python
def soma(a, b):
    return a + b
```

Agora, crie um teste para essa função:

```python
def test_soma():
    assert soma(1, 2) == 3
    assert soma(0, 0) == 0
    assert soma(-1, 1) == 0
    assert soma(-1, -1) == -2
```

## Referências

- [Testes em Python parte I](https://dev.to/womakerscode/testes-em-python-parte-1-introducao-43ei)