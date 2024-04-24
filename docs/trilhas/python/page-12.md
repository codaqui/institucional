# Decoradores

## Resumo

Decoradores são funções que envolvem outras funções ou métodos para adicionar funcionalidades extras. Eles são uma maneira poderosa de modificar ou estender o comportamento de funções sem alterar seu código.

### Exemplos

```python
def decorador(funcao):
    def funcao_decorada():
        print("Antes da função")
        funcao()
        print("Depois da função")
    return funcao_decorada

@decorador
def funcao():
    print("Função original")
```

## Referências

- [Decoradores por Python Iluminado](https://pythoniluminado.netlify.app/decoradores)

- [Decoradores por Python WIKI](https://wiki.python.org.br/Decoradores_Python_(Python_Decorators))

- [Como funcionam os decoradores em Python?](https://pt.stackoverflow.com/questions/23628/como-funcionam-decoradores-em-python)