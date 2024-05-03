# Manipulação de Arquivos

## Resumo

A manipulação de arquivos é uma tarefa comum em muitos programas. Em Python, você pode ler e escrever arquivos de texto de forma simples e eficiente. Nesta aula, iremos estudar como manipular arquivos em Python, principalmente arquivos TXT, JSON e CSV.

### Exemplos

Para abrir um arquivo em Python, você pode utilizar a função `open()` passando o nome do arquivo e o modo de abertura. Por exemplo, para abrir um arquivo chamado `dados.txt` em modo de leitura, você pode fazer o seguinte:

```python
with open("dados.txt", "r") as arquivo:
    conteudo = arquivo.read()
    print(conteudo)
```

Lembrando que uma linguagem de programação é um conjunto de acordos, cada extensão de arquivo tem um significado e seu acordo. Por exemplo arquivos JSON:
    
```python
import json
with open("dados.json", "r") as arquivo:
    conteudo = json.load(arquivo)
    print(conteudo)
    print(type(conteudo))
```

Assim como os arquivos CSV, significam Comma Separated Values, ou seja, valores separados por vírgula:

```python
import csv
with open("dados.csv", "r") as arquivo:
    leitor = csv.reader(arquivo)
    for linha in leitor:
        print(linha)
```

## Referências

- [Abrindo, fechando e lendo arquivos (Com exercícios)](https://panda.ime.usp.br/pensepy/static/pensepy/10-Arquivos/files.html)
- [Como escrever e salvar arquivos JSON em Python](https://academiahopper.com.br/trabalhando-com-arquivos-em-python/)
- [Manipulando arquivos - FreeCodeCamp](https://www.freecodecamp.org/portuguese/news/como-escrever-em-um-arquivo-em-python-open-read-append-e-outras-funcoes-de-manipulacao-explicadas/)

