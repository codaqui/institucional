# Trabalhando com Módulos

## Introdução

Módulos são arquivos Python contendo código reutilizável - funções, classes e variáveis - que podem ser importados e utilizados em outros programas. Eles são fundamentais para organizar código, promover reutilização e evitar conflitos de nomes em projetos grandes.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito e importância de módulos em Python
    - Aprender a criar e importar módulos personalizados
    - Explorar diferentes formas de importação
    - Conhecer os módulos mais úteis da biblioteca padrão
    - Compreender namespaces e escopo em módulos
    - Gerenciar pacotes com o sistema de pacotes do Python

## Conceitos Básicos de Módulos

=== "O que são Módulos"
    ```python
    # Um módulo é simplesmente um arquivo .py
    # Ele pode conter definições de funções, classes e variáveis
    # Também pode incluir código executável
    
    # Exemplo - arquivo matematica.py
    def somar(a, b):
        return a + b
        
    def subtrair(a, b):
        return a - b
        
    PI = 3.14159
    
    # Este código será executado quando o módulo for importado
    print("Módulo matemática importado!")
    ```

=== "Importando Módulos"
    ```python
    # Importando um módulo
    import matematica
    
    # Usando funções do módulo
    resultado1 = matematica.somar(10, 5)
    resultado2 = matematica.subtrair(10, 5)
    
    print(f"Soma: {resultado1}")       # Soma: 15
    print(f"Subtração: {resultado2}")  # Subtração: 5
    print(f"PI: {matematica.PI}")      # PI: 3.14159
    ```

=== "Importando com Alias"
    ```python
    # Importando um módulo com um alias (apelido)
    import matematica as math
    
    # Agora usamos o alias em vez do nome completo
    resultado = math.somar(10, 5)
    print(f"Soma: {resultado}")  # Soma: 15
    ```

=== "Importando Itens Específicos"
    ```python
    # Importando apenas funções ou variáveis específicas
    from matematica import somar, PI
    
    # Agora podemos usar diretamente, sem o prefixo do módulo
    resultado = somar(10, 5)
    print(f"Soma: {resultado}")  # Soma: 15
    print(f"PI: {PI}")           # PI: 3.14159
    
    # Importando tudo de um módulo (não recomendado em geral)
    from matematica import *
    
    # Agora todas as funções e variáveis estão disponíveis diretamente
    # Mas isso pode causar conflitos de nomes inesperados
    ```

## Criando Módulos Personalizados

Vamos aprender a criar e organizar nossos próprios módulos.

=== "Estrutura Básica"
    ```python
    # Arquivo: utils.py
    
    """Módulo de funções utilitárias.
    
    Este módulo contém funções auxiliares para manipulação de texto e números.
    """
    
    # Variáveis do módulo
    VERSAO = "1.0.0"
    AUTOR = "Seu Nome"
    
    # Funções
    def formatar_nome(nome):
        """Formata um nome para ter iniciais maiúsculas."""
        return nome.title()
    
    def calcular_media(numeros):
        """Calcula a média de uma lista de números."""
        return sum(numeros) / len(numeros)
    
    # Classe
    class Contador:
        """Uma classe simples para contagem."""
        def __init__(self, valor_inicial=0):
            self.valor = valor_inicial
            
        def incrementar(self, incremento=1):
            self.valor += incremento
            return self.valor
    ```

=== "Usando o Módulo"
    ```python
    # Importando o módulo que criamos
    import utils
    
    # Usando as funções
    nome = utils.formatar_nome("josé da silva")
    print(nome)  # José Da Silva
    
    media = utils.calcular_media([10, 20, 30, 40])
    print(f"Média: {media}")  # Média: 25.0
    
    # Criando uma instância da classe
    contador = utils.Contador(10)
    contador.incrementar(5)
    print(f"Contador: {contador.valor}")  # Contador: 15
    
    # Acessando variáveis do módulo
    print(f"Versão: {utils.VERSAO}")  # Versão: 1.0.0
    print(f"Autor: {utils.AUTOR}")    # Autor: Seu Nome
    ```

=== "Módulo como Script"
    ```python
    # Os módulos também podem ser executados diretamente como scripts
    # Arquivo: conversor.py
    
    def celsius_para_fahrenheit(celsius):
        return (celsius * 9/5) + 32
    
    def fahrenheit_para_celsius(fahrenheit):
        return (fahrenheit - 32) * 5/9
    
    if __name__ == "__main__":
        # Este código só é executado quando o arquivo é rodado diretamente
        # não quando ele é importado como módulo
        print("Conversor de temperatura")
        temp_c = float(input("Digite a temperatura em Celsius: "))
        temp_f = celsius_para_fahrenheit(temp_c)
        print(f"{temp_c}°C equivale a {temp_f:.1f}°F")
    ```

!!! tip "O bloco `if __name__ == \"__main__\":`"
    Quando um módulo é executado diretamente (como um script), a variável especial `__name__` tem o valor `"__main__"`.
    Quando o mesmo arquivo é importado como um módulo, `__name__` contém o nome do módulo.
    
    Isso permite que você crie código que se comporta diferentemente quando importado versus quando executado diretamente.

## Namespaces e Escopo

Módulos ajudam a organizar o código em namespaces separados, evitando conflitos de nomes.

=== "Namespaces"
    ```python
    # Arquivo: geometria.py
    def calcular_area(base, altura):
        return base * altura
    
    # Arquivo: estatistica.py
    def calcular_media(valores):
        return sum(valores) / len(valores)
    
    # Arquivo: principal.py
    import geometria
    import estatistica
    
    # Mesmo que ambos os módulos tenham funções com nomes diferentes,
    # elas estão em namespaces separados
    area = geometria.calcular_area(5, 10)
    media = estatistica.calcular_media([10, 20, 30])
    
    print(f"Área: {area}")        # Área: 50
    print(f"Média: {media}")      # Média: 20.0
    ```

=== "Variáveis Especiais"
    ```python
    # Todo módulo tem variáveis especiais
    
    # __name__: nome do módulo ou "__main__" se executado diretamente
    # __file__: caminho completo para o arquivo do módulo
    # __doc__: docstring do módulo
    
    # Arquivo: info_modulo.py
    """Este é um módulo de exemplo para demonstrar variáveis especiais."""
    
    def mostrar_info():
        print(f"Nome do módulo: {__name__}")
        print(f"Arquivo: {__file__}")
        print(f"Docstring: {__doc__}")
    
    if __name__ == "__main__":
        mostrar_info()
    ```

## Organização em Pacotes

Pacotes são diretórios que contêm múltiplos módulos, permitindo uma organização hierárquica.

=== "Estrutura de um Pacote"
    ```
    meu_pacote/
    ├── __init__.py          # Torna o diretório um pacote Python
    ├── modulo1.py
    ├── modulo2.py
    └── subpacote/
        ├── __init__.py
        └── modulo3.py
    ```

=== "Arquivo __init__.py"
    ```python
    # meu_pacote/__init__.py
    """Pacote de exemplo com funções úteis."""
    
    # Podemos definir o que será importado quando alguém fizer:
    # from meu_pacote import *
    __all__ = ['modulo1', 'modulo2']
    
    # Também podemos importar e expor funções específicas de submódulos
    from .modulo1 import funcao_util
    from .modulo2 import CONSTANTE
    
    # Definir variáveis de nível de pacote
    VERSAO = '1.0.0'
    ```

=== "Importando de Pacotes"
    ```python
    # Importando módulos de um pacote
    import meu_pacote.modulo1
    from meu_pacote import modulo2
    from meu_pacote.subpacote import modulo3
    
    # Usando funções específicas
    meu_pacote.modulo1.funcao_a()
    modulo2.funcao_b()
    
    # Importando funções específicas
    from meu_pacote.modulo1 import funcao_a
    from meu_pacote.subpacote.modulo3 import funcao_c
    
    # Usando as funções diretamente
    funcao_a()
    funcao_c()
    ```

## Módulos da Biblioteca Padrão

Python vem com uma vasta biblioteca padrão. Vamos explorar alguns dos módulos mais úteis.

=== "math"
    ```python
    import math
    
    # Constantes
    print(math.pi)       # 3.141592653589793
    print(math.e)        # 2.718281828459045
    
    # Funções matemáticas
    print(math.sqrt(16))         # 4.0 (raiz quadrada)
    print(math.log10(100))       # 2.0 (logaritmo base 10)
    print(math.sin(math.radians(90)))  # 1.0 (seno de 90 graus)
    print(math.ceil(4.2))        # 5 (arredondamento para cima)
    print(math.floor(4.8))       # 4 (arredondamento para baixo)
    print(math.gcd(12, 8))       # 4 (maior divisor comum)
    ```

=== "random"
    ```python
    import random
    
    # Números aleatórios
    print(random.random())       # Número entre 0.0 e 1.0
    print(random.uniform(1, 10)) # Número decimal entre 1 e 10
    print(random.randint(1, 10)) # Inteiro entre 1 e 10
    
    # Seleções aleatórias
    lista = ["maçã", "banana", "laranja", "uva"]
    print(random.choice(lista))            # Um item aleatório
    print(random.sample(lista, 2))         # Lista de 2 itens sem repetição
    print(random.choices(lista, k=3))      # Lista de 3 itens com possível repetição
    
    # Embaralhando uma lista
    numeros = [1, 2, 3, 4, 5]
    random.shuffle(numeros)
    print(numeros)  # Lista embaralhada
    ```

=== "datetime"
    ```python
    from datetime import datetime, date, time, timedelta
    
    # Data e hora atual
    agora = datetime.now()
    print(agora)  # 2023-05-10 15:30:45.123456
    
    # Criando objetos de data e hora
    d = date(2023, 5, 10)
    t = time(15, 30, 45)
    dt = datetime(2023, 5, 10, 15, 30, 45)
    
    print(d)  # 2023-05-10
    print(t)  # 15:30:45
    
    # Formatando data e hora
    print(dt.strftime("%d/%m/%Y %H:%M"))  # 10/05/2023 15:30
    
    # Convertendo string para data/hora
    data_str = "21/07/2022"
    data_convertida = datetime.strptime(data_str, "%d/%m/%Y")
    print(data_convertida)  # 2022-07-21 00:00:00
    
    # Operações com datas
    amanha = agora + timedelta(days=1)
    uma_semana_atras = agora - timedelta(days=7)
    print(f"Amanhã: {amanha.date()}")
    print(f"Uma semana atrás: {uma_semana_atras.date()}")
    ```

=== "os e sys"
    ```python
    import os
    import sys
    
    # Informações do sistema
    print(sys.platform)        # Ex: 'linux', 'win32', 'darwin'
    print(sys.version)         # Versão do Python
    
    # Argumentos de linha de comando
    print(sys.argv)            # Lista de argumentos (incluindo o nome do script)
    
    # Variáveis de ambiente
    print(os.environ.get('HOME'))     # Diretório home do usuário
    print(os.environ.get('PATH'))     # Variável PATH
    
    # Manipulação de caminhos
    caminho = os.path.join('pasta', 'subpasta', 'arquivo.txt')
    print(caminho)  # 'pasta/subpasta/arquivo.txt' (adaptado ao sistema)
    
    # Verificando arquivos e diretórios
    print(os.path.exists('arquivo.txt'))      # Verifica se existe
    print(os.path.isfile('arquivo.txt'))      # Verifica se é arquivo
    print(os.path.isdir('diretorio'))         # Verifica se é diretório
    
    # Listar conteúdo de um diretório
    print(os.listdir('.'))     # Lista arquivos no diretório atual
    
    # Criar e remover diretórios
    os.makedirs('nova_pasta/subpasta', exist_ok=True)  # Cria diretório
    os.rmdir('pasta_vazia')      # Remove diretório vazio
    ```

=== "json e csv"
    ```python
    import json
    import csv
    
    # Trabalhando com JSON
    dados = {
        "nome": "João",
        "idade": 30,
        "cidades": ["São Paulo", "Rio de Janeiro"]
    }
    
    # Convertendo para string JSON
    json_str = json.dumps(dados, indent=4)
    print(json_str)
    
    # Escrevendo para arquivo
    with open('dados.json', 'w') as arquivo:
        json.dump(dados, arquivo, indent=4)
    
    # Lendo de string
    dados_carregados = json.loads(json_str)
    print(dados_carregados["nome"])  # João
    
    # Lendo de arquivo
    with open('dados.json', 'r') as arquivo:
        dados_do_arquivo = json.load(arquivo)
    
    # Trabalhando com CSV
    # Escrevendo em CSV
    with open('dados.csv', 'w', newline='') as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["Nome", "Idade", "Cidade"])
        escritor.writerow(["João", 30, "São Paulo"])
        escritor.writerow(["Maria", 25, "Rio de Janeiro"])
    
    # Lendo de CSV
    with open('dados.csv', 'r') as arquivo:
        leitor = csv.reader(arquivo)
        for linha in leitor:
            print(linha)
    
    # Usando DictReader e DictWriter
    with open('dados.csv', 'r') as arquivo:
        leitor = csv.DictReader(arquivo)
        for linha in leitor:
            print(f"{linha['Nome']} tem {linha['Idade']} anos")
    ```

## Instalando e Gerenciando Pacotes

Python tem um sistema de pacotes rico, permitindo instalar módulos externos.

=== "pip"
    ```bash
    # pip é o gerenciador de pacotes padrão do Python
    
    # Instalando um pacote
    pip install requests
    
    # Instalando versão específica
    pip install requests==2.25.1
    
    # Instalando múltiplos pacotes
    pip install requests pandas matplotlib
    
    # Instalando de um arquivo requirements.txt
    pip install -r requirements.txt
    
    # Listando pacotes instalados
    pip list
    
    # Atualizando um pacote
    pip install --upgrade requests
    
    # Desinstalando um pacote
    pip uninstall requests
    ```

=== "Ambientes Virtuais"
    ```bash
    # Os ambientes virtuais isolam dependências para diferentes projetos
    
    # Criando um ambiente virtual
    python -m venv meu_ambiente
    
    # Ativando o ambiente virtual
    # No Windows:
    meu_ambiente\Scripts\activate
    
    # No Linux/Mac:
    source meu_ambiente/bin/activate
    
    # Desativando o ambiente
    deactivate
    
    # Dentro do ambiente, você pode instalar pacotes normalmente
    pip install requests
    ```

=== "Usando Pacotes Instalados"
    ```python
    # Depois de instalar o pacote 'requests'
    import requests
    
    # Fazendo uma requisição HTTP
    resposta = requests.get('https://api.github.com/events')
    
    # Verificando o status da resposta
    print(f"Status code: {resposta.status_code}")
    
    # Acessando o conteúdo como JSON
    if resposta.status_code == 200:
        dados = resposta.json()
        print(f"Número de eventos: {len(dados)}")
    ```

## Criando Pacotes Distribuíveis

Você pode criar seus próprios pacotes para distribuição.

=== "Estrutura de Projeto"
    ```
    meu_projeto/
    ├── LICENSE
    ├── README.md
    ├── pyproject.toml
    ├── src/
    │   └── meu_pacote/
    │       ├── __init__.py
    │       ├── modulo1.py
    │       └── modulo2.py
    ├── tests/
    │   ├── __init__.py
    │   └── test_meu_pacote.py
    └── docs/
        └── index.md
    ```

=== "pyproject.toml"
    ```toml
    [build-system]
    requires = ["setuptools>=42", "wheel"]
    build-backend = "setuptools.build_meta"
    
    [project]
    name = "meu-pacote"
    version = "0.1.0"
    description = "Descrição do meu pacote"
    readme = "README.md"
    authors = [{name = "Seu Nome", email = "seu_email@exemplo.com"}]
    license = {text = "MIT"}
    classifiers = [
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ]
    requires-python = ">=3.7"
    dependencies = [
        "requests>=2.25.0",
    ]
    
    [project.urls]
    "Homepage" = "https://github.com/seu-usuario/meu-pacote"
    "Bug Tracker" = "https://github.com/seu-usuario/meu-pacote/issues"
    ```

=== "Criando a Distribuição"
    ```bash
    # Instalando ferramentas de build
    pip install build
    
    # Criando a distribuição (wheel e source)
    python -m build
    
    # O resultado estará em dist/
    # - meu_pacote-0.1.0-py3-none-any.whl (formato wheel)
    # - meu_pacote-0.1.0.tar.gz (formato source)
    
    # Instalando localmente para testes
    pip install dist/meu_pacote-0.1.0-py3-none-any.whl
    
    # Publicando no PyPI (Python Package Index)
    pip install twine
    twine upload dist/*
    ```

## Boas Práticas

=== "Organização de Código"
    ```python
    # Estrutura recomendada para módulos
    
    """Docstring do módulo - descreva o propósito do módulo aqui."""
    
    # Imports da biblioteca padrão
    import os
    import sys
    
    # Imports de pacotes de terceiros
    import requests
    
    # Imports de módulos locais
    from .utils import helper
    
    # Constantes globais
    MAX_TAMANHO = 100
    NOME_PADRAO = "exemplo"
    
    # Classes
    class MinhaClasse:
        """Docstring da classe."""
        pass
    
    # Funções
    def minha_funcao():
        """Docstring da função."""
        pass
    
    # Código para execução direta
    if __name__ == "__main__":
        minha_funcao()
    ```

=== "Importações"
    ```python
    # Recomendado
    import math
    import os.path  # Submódulo específico
    from datetime import datetime
    
    # Não recomendado (exceto em casos específicos)
    from math import *  # Importa tudo, pode causar conflitos
    
    # OK para módulos que são projetados para isso
    from numpy import *  # numpy é projetado para uso com wildcard import
    
    # Imports relativos (dentro de um pacote)
    from . import modulo_irmao       # Módulo no mesmo pacote
    from .subpacote import modulo    # Módulo em um subpacote
    from .. import modulo_pai        # Módulo no pacote pai
    ```

=== "Arquivos __init__.py"
    ```python
    # meu_pacote/__init__.py
    
    """
    Meu Pacote - Descrição curta do pacote.
    
    Descrição mais detalhada que pode ocupar
    múltiplas linhas sobre o pacote.
    """
    
    # Definir versão do pacote
    __version__ = '0.1.0'
    
    # Expor classes/funções públicas para uso direto
    from .modulo1 import FuncaoUtil, ClasseImportante
    from .modulo2 import CONSTANTE_GLOBAL
    
    # Definir __all__ para controlar 'from pacote import *'
    __all__ = [
        'FuncaoUtil',
        'ClasseImportante',
        'CONSTANTE_GLOBAL',
    ]
    ```

## Exercícios Práticos

=== "Exercício 1: Criando um Módulo"
    Crie um módulo chamado `calculadora.py` com as seguintes funções:
    
    - `somar(a, b)`: retorna a soma de dois números
    - `subtrair(a, b)`: retorna a subtração de dois números
    - `multiplicar(a, b)`: retorna a multiplicação de dois números
    - `dividir(a, b)`: retorna a divisão de dois números, tratando divisão por zero
    
    Depois, crie um arquivo `main.py` que importa e usa essas funções.

=== "Exercício 2: Módulo de Utilidades"
    Crie um módulo `utils.py` com as seguintes funcionalidades:
    
    - Uma função `validar_email(email)` que verifica se um email é válido
    - Uma função `formatar_cpf(cpf)` que formata um CPF como XXX.XXX.XXX-XX
    - Uma constante `VERSAO` com o valor '1.0.0'
    
    Importe e use essas funcionalidades em um arquivo de teste.

=== "Exercício 3: Pacote Simples"
    Crie um pacote chamado `geometria` com a seguinte estrutura:
    
    ```
    geometria/
    ├── __init__.py
    ├── retangulo.py  (área, perímetro)
    ├── circulo.py    (área, circunferência)
    └── triangulo.py  (área pelo método de Heron)
    ```
    
    Cada módulo deve ter funções apropriadas para calcular áreas e outras propriedades. No arquivo `__init__.py`, importe e exponha as funções principais.

## Resumo

Nesta aula, você aprendeu sobre:

- **Módulos** em Python e como eles organizam o código
- Como **criar e importar** seus próprios módulos
- Diferentes **técnicas de importação** (`import`, `from...import`, aliases)
- A importância de `__name__ == "__main__"` para módulos executáveis
- Criação e organização de **pacotes** Python
- Os principais módulos da **biblioteca padrão**
- Como **instalar e gerenciar** pacotes externos com pip
- **Boas práticas** para organização de código em módulos e pacotes

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre módulos](https://docs.python.org/3/tutorial/modules.html){:target="_blank"}
    - [Guia do Python Packaging Authority](https://packaging.python.org/en/latest/tutorials/packaging-projects/){:target="_blank"}
    - [Índice de Pacotes Python (PyPI)](https://pypi.org/){:target="_blank"}
    - [Biblioteca Padrão Python](https://docs.python.org/3/library/){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos como trabalhar com arquivos em Python, incluindo leitura, escrita e manipulação de diferentes formatos.

[Avance para a próxima aula →](/docs/trilhas/python/page-10)

[← Voltar para Debugging e Tratamento de Erros](/docs/trilhas/python/page-8)
