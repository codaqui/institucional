# Herança e Polimorfismo

## Resumo

Herança é um mecanismo importante quando um grupo de classes apresenta a mesma interface, mas a implementação interna dos métodos é diferente. Polimorfismo é a capacidade que uma subclasse tem de ter métodos com o mesmo nome de sua superclasse, e o programa saber qual método deve ser invocado, especificamente.

### Exemplos

Imagine que estamos programando seres vivos, que depois podem ser Humanos ou Macacos. Ambos seres vivos têm a capacidade de respirar, mas cada um deles respira de uma forma diferente.

```python
class SerVivo:
    def respirar(self):
        pass

class Humano(SerVivo):
    def respirar(self):
        print("Respirando como um humano")

class Macaco(SerVivo):
    def respirar(self):
        print("Respirando como um macaco")
```

## Referências

- [Polimorfismo - O que é e como usar?](https://www.pythonprogressivo.net/2018/11/Polimorfismo-O-que-Como-Usar-Como-fazer.html)

- [Entendendo o Super() do Python](https://medium.com/code-rocket-blog/entendendo-o-super-do-python-da17ee8d26ca)

- [Conceitos de Polimorfismo em POO](https://www.devmedia.com.br/conceitos-e-exemplos-polimorfismo-programacao-orientada-a-objetos/18701)
