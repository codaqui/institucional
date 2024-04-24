# Debugando e Tratando Erros

## Resumo

O Python possui um conjunto de ferramentas para ajudar a identificar e corrigir erros no código. Nesta aula, iremos estudar como utilizar o depurador do Python e como tratar exceções.

### Exemplos:

ValueError:

```python
try:
    numero = int(input("Digite um número: "))
except ValueError:
    print("O valor digitado não é um número inteiro.")
```

ZeroDivisionError:

```python
try:
    resultado = 10 / 0
except ZeroDivisionError:
    print("Não é possível dividir por zero.")
```

## Referências

- [Erros de sintaxe (Syntax errors)](https://panda.ime.usp.br/panda/static/pensepy/Appendices/app_a.html)

- [Entendendo melhor as mensagens de erro](https://pythonhelp.wordpress.com/2012/12/31/deu-erro-e-agora-o-que-eu-faco/)