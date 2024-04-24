# Trabalhando com Módulos

## Resumo

Módulos são arquivos que contêm funções, classes e variáveis que podem ser importadas em outros arquivos Python. Neste tópico, iremos aprender como criar e utilizar módulos em Python.

### Exemplos

Para criar um módulo, basta criar um arquivo com extensão `.py` e definir as funções, classes e variáveis que deseja exportar. Por exemplo, o arquivo `matematica.py` pode conter as seguintes funções:

```python
# file: matematica.py

def somar(a, b):
    return a + b

def subtrair(a, b):
    return a - b
```

Para utilizar o módulo `matematica.py` em outro arquivo, basta importá-lo com a palavra-chave `import`:

```python
import matematica

print(matematica.somar(2, 3))  # Saída: 5
print(matematica.subtrair(5, 2))  # Saída: 3
```

## Referências

- [Como criar um módulo](https://www.pythonprogressivo.net/2018/07/import-Como-Criar-Importar-Usar-Modulo-Python-Curso.html)

- [Módulos-Executando módulos como scripts](https://docs.python.org/pt-br/3/tutorial/modules.html)
