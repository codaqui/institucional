# Atualizações e Recursos Recentes do Python

## Introdução

A linguagem Python continua evoluindo, com novas versões trazendo recursos, melhorias de desempenho e correções de segurança. Nesta aula, vamos explorar as principais características e funcionalidades introduzidas nas versões recentes do Python, além de discutir o processo de atualização e migração entre versões.

!!! info "Objetivos de Aprendizado"
    - Conhecer os principais recursos das versões recentes do Python
    - Entender as melhorias de sintaxe e funcionalidades adicionadas
    - Aprender como usar os novos recursos em projetos práticos
    - Compreender o ciclo de lançamento e suporte das versões do Python
    - Descobrir como migrar projetos para versões mais recentes

## Python 3.8

Python 3.8 foi lançado em outubro de 2019 e trouxe várias melhorias significativas para a linguagem.

=== "Expressões de Atribuição (Walrus Operator)"
    ```python
    # Antes do Python 3.8
    command = input("Digite um comando: ")
    while command != "quit":
        # Processar o comando
        print(f"Executando: {command}")
        command = input("Digite um comando: ")
    
    # Com Python 3.8 - Operador Walrus (:=)
    while (command := input("Digite um comando: ")) != "quit":
        print(f"Executando: {command}")
    
    # Outro exemplo útil
    # Antes
    import re
    text = "A idade de João é 25 anos"
    match = re.search(r'(\d+)', text)
    if match:
        age = int(match.group(1))
        print(f"Idade encontrada: {age}")
    
    # Depois
    if match := re.search(r'(\d+)', text):
        print(f"Idade encontrada: {int(match.group(1))}")
    
    # Em compreensões de lista
    data = [1, 2, 3, 4, 5]
    [x for x in data if (doubled := x * 2) > 5]  # [3, 4, 5]
    ```

=== "Parâmetros Posicionais"
    ```python
    # Python 3.8 introduziu uma sintaxe para especificar
    # parâmetros exclusivamente posicionais

    # A barra (/) indica que todos os parâmetros à esquerda 
    # são exclusivamente posicionais
    def calcular_potencia(base, expoente, /, multiplicador=1):
        return (base ** expoente) * multiplicador
    
    # Chamadas válidas
    calcular_potencia(2, 3)           # 2³ = 8
    calcular_potencia(2, 3, 2)        # 2³ * 2 = 16
    calcular_potencia(2, 3, multiplicador=2)  # 2³ * 2 = 16
    
    # Chamadas inválidas
    # calcular_potencia(base=2, expoente=3)  # Erro! base e expoente são posicionais
    
    # Combinando com parâmetros somente por nome (*)
    def funcao(pos1, pos2, /, pos_ou_kw, *, kw1, kw2):
        # pos1 e pos2: somente por posição
        # pos_ou_kw: por posição ou nome
        # kw1 e kw2: somente por nome
        pass
    
    # Exemplo prático
    def buscar_dados(tabela, id, /, *, campos=None, ordenar_por=None):
        # tabela e id são posicionais
        # campos e ordenar_por são somente por nome
        campos = campos or ["*"]
        ordem = f"ORDER BY {ordenar_por}" if ordenar_por else ""
        query = f"SELECT {', '.join(campos)} FROM {tabela} WHERE id = {id} {ordem}"
        return query
    
    # Uso
    buscar_dados("usuarios", 123, campos=["nome", "email"])
    # SELECT nome, email FROM usuarios WHERE id = 123 
    ```

=== "f-strings com = (Debug)"
    ```python
    # Python 3.8 melhorou as f-strings para depuração
    x = 10
    y = 20
    
    # Antes
    print(f"x = {x}, y = {y}")
    
    # Python 3.8+
    print(f"{x=}, {y=}")  # x=10, y=20
    
    # Funciona com expressões
    print(f"{x+y=}")  # x+y=30
    
    # Formato personalizado
    import math
    print(f"{math.pi=:.2f}")  # math.pi=3.14
    
    # Útil para depuração rápida
    nome = "Maria"
    idade = 30
    print(f"{nome=} tem {idade=} anos")  # nome='Maria' tem idade=30 anos
    ```

=== "Módulos Importantes"
    ```python
    # importlib.metadata (PEP 566)
    # Permite acessar os metadados dos pacotes instalados
    from importlib import metadata
    
    # Versão de um pacote instalado
    version = metadata.version("pip")
    print(f"Versão do pip: {version}")
    
    # Lista de pacotes instalados
    installed = metadata.distributions()
    print(f"Total de pacotes instalados: {len(list(installed))}")
    
    # TypedDict (PEP 589)
    # Dicionários com tipos de valor específicos para cada chave
    from typing import TypedDict
    
    class Pessoa(TypedDict):
        nome: str
        idade: int
        ativo: bool
    
    # Cria um dicionário do tipo Pessoa
    usuario: Pessoa = {
        "nome": "João", 
        "idade": 25, 
        "ativo": True
    }
    
    # Ferramentas de análise estática como mypy podem verificar
    # se os tipos estão corretos
    ```

=== "Outras Melhorias"
    ```python
    # Melhoria no módulo typing
    from typing import Literal, Final, Protocol
    
    # Literal para especificar valores exatos
    def mover(direcao: Literal["norte", "sul", "leste", "oeste"]) -> None:
        print(f"Movendo para {direcao}")
    
    mover("norte")  # OK
    # mover("nordeste")  # Erro de tipo
    
    # Final para declarar constantes
    MAX_CONEXOES: Final = 100
    # MAX_CONEXOES = 200  # Erro, não pode ser reatribuído
    
    # Protocol para tipagem estrutural (similar a interfaces)
    class Printable(Protocol):
        def __str__(self) -> str: ...
    
    def imprimir(obj: Printable) -> None:
        print(str(obj))
    
    # Qualquer objeto que implemente __str__ é compatível com Printable
    
    # Outros recursos:
    # - multiprocessing compartilhado agora usa memória compartilhada
    # - pickle suporta objetos maiores que 4GiB
    # - PYTHONIOENCODING não afeta mais stderr
    # - zoneinfo adicionado (PEP 615) para lidar com fusos horários
    ```

## Python 3.9

Python 3.9 foi lançado em outubro de 2020 e trouxe várias melhorias, incluindo novos operadores para dicionários e funcionalidades para strings.

=== "Operadores de União de Dicionários"
    ```python
    # Antes do Python 3.9
    x = {"a": 1, "b": 2}
    y = {"b": 3, "c": 4}
    
    # Criando a união com método update (modifica x)
    z1 = x.copy()
    z1.update(y)
    print(z1)  # {'a': 1, 'b': 3, 'c': 4}
    
    # Criando a união com desempacotamento
    z2 = {**x, **y}
    print(z2)  # {'a': 1, 'b': 3, 'c': 4}
    
    # Com Python 3.9 - Operador |
    # União (novo dicionário)
    z3 = x | y
    print(z3)  # {'a': 1, 'b': 3, 'c': 4}
    
    # Atualização (modifica x)
    x |= y
    print(x)  # {'a': 1, 'b': 3, 'c': 4}
    
    # Casos de uso práticos
    defaults = {"timeout": 30, "retries": 3, "backoff": 1.5}
    user_settings = {"timeout": 10}
    
    # Configuração final é a união de padrões e personalizações
    config = defaults | user_settings
    print(config)  # {'timeout': 10, 'retries': 3, 'backoff': 1.5}
    ```

=== "Métodos para Strings"
    ```python
    # Python 3.9 adiciona métodos para remover prefixos e sufixos
    
    # removeprefix() - Remove prefixo
    url = "https://codaqui.dev/python/aulas"
    
    # Antes
    if url.startswith("https://"):
        url_sem_protocolo = url[8:]  # Remove os primeiros 8 caracteres
    
    # Python 3.9
    url_sem_protocolo = url.removeprefix("https://")
    print(url_sem_protocolo)  # codaqui.dev/python/aulas
    
    # Se o prefixo não existir, retorna a string original
    print("Python".removeprefix("Java"))  # Python
    
    # removesuffix() - Remove sufixo
    arquivo = "documento.txt"
    
    # Antes
    if arquivo.endswith(".txt"):
        nome_sem_extensao = arquivo[:-4]  # Remove os últimos 4 caracteres
    
    # Python 3.9
    nome_sem_extensao = arquivo.removesuffix(".txt")
    print(nome_sem_extensao)  # documento
    
    # Exemplos adicionais
    caminho = "/home/usuario/arquivo.py"
    nome_arquivo = caminho.split("/")[-1].removesuffix(".py")
    print(nome_arquivo)  # arquivo
    
    # Limpando formatação de número de telefone
    telefone = "+55 (11) 98765-4321"
    digitos = telefone.removeprefix("+55 ").removeprefix("(").removesuffix("-4321")
    print(digitos)  # (11) 98765
    ```

=== "Anotações de Tipo"
    ```python
    # O módulo typing foi melhorado no Python 3.9
    
    # Antes do Python 3.9
    from typing import List, Dict, Tuple, Set
    
    def processar_dados(valores: List[int]) -> Dict[str, int]:
        return {"total": sum(valores)}
    
    # Python 3.9 - tipos genéricos diretamente dos tipos built-in
    def processar_dados_new(valores: list[int]) -> dict[str, int]:
        return {"total": sum(valores)}
    
    # Outros exemplos
    coordenadas: tuple[float, float] = (10.5, 20.3)
    nomes: set[str] = {"Alice", "Bob", "Charlie"}
    matriz: list[list[int]] = [[1, 2], [3, 4]]
    
    # Também funciona com tipos mais complexos
    mapa: dict[str, list[tuple[int, int]]] = {
        "pontos": [(0, 0), (1, 1), (2, 2)]
    }
    
    # O mesmo se aplica a palavras-chave especiais
    from typing import Optional, Union
    
    # Antes
    def funcao(valor: Optional[int] = None) -> Union[str, int]:
        if valor is None:
            return "Sem valor"
        return valor * 2
    
    # Obs: Optional e Union ainda são necessários
    # Apenas os contêineres genéricos foram simplificados
    ```

=== "Funções de Parser"
    ```python
    # O parser PEG mais rápido e mais flexível
    # Substitui o antigo parser LL(1)
    
    import ast
    
    # Análise de código como string
    código = """
    def soma(a, b):
        return a + b
    
    resultado = soma(10, 20)
    print(f"A soma é {resultado}")
    """
    
    # Constrói uma árvore de sintaxe abstrata
    arvore = ast.parse(código)
    
    # Navega pelos nós da árvore
    for node in ast.walk(arvore):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id == 'soma':
                print(f"Chamada para soma encontrada com argumentos:")
                for arg in node.args:
                    if isinstance(arg, ast.Constant):
                        print(f"- {arg.value}")
    
    # Saída:
    # Chamada para soma encontrada com argumentos:
    # - 10
    # - 20
    
    # O novo parser permite futuras melhorias na sintaxe
    # e melhor tratamento de erros
    ```

=== "Outras Melhorias"
    ```python
    # time.zoneinfo() - Suporte a fuso horário
    from zoneinfo import ZoneInfo
    from datetime import datetime
    
    # Criando data/hora com informação de fuso horário
    dt_tokyo = datetime(2023, 1, 1, 12, 0, tzinfo=ZoneInfo("Asia/Tokyo"))
    dt_paris = datetime(2023, 1, 1, 12, 0, tzinfo=ZoneInfo("Europe/Paris"))
    
    print(dt_tokyo)  # 2023-01-01 12:00:00+09:00
    print(dt_paris)  # 2023-01-01 12:00:00+01:00
    
    # Convertendo entre fusos horários
    dt_tokyo_em_paris = dt_tokyo.astimezone(ZoneInfo("Europe/Paris"))
    print(dt_tokyo_em_paris)  # 2023-01-01 04:00:00+01:00
    
    # graphlib.TopologicalSorter - Ordenação topológica
    from graphlib import TopologicalSorter
    
    # Definindo dependências (quem depende de quem)
    dependencias = {
        "setup.py": {"README.md"},
        "pacote": {"setup.py"},
        "testes": {"pacote"},
        "build": {"pacote", "testes"},
        "deploy": {"build"}
    }
    
    # Criar o ordenador topológico
    ts = TopologicalSorter(dependencias)
    
    # Obter a ordem de dependências
    ordem = list(ts.static_order())
    print(f"Ordem de execução: {ordem}")
    # Ordem de execução: ['README.md', 'setup.py', 'pacote', 'testes', 'build', 'deploy']
    ```

## Python 3.10

Python 3.10 foi lançado em outubro de 2021 e introduziu vários recursos importantes, incluindo a correspondência de padrões estruturais.

=== "Pattern Matching"
    ```python
    # O Python 3.10 introduziu pattern matching estrutural
    # Semelhante a switch/case em outras linguagens, mas muito mais poderoso
    
    # Exemplo básico
    def analisar_status(status):
        match status:
            case 200:
                return "OK"
            case 404:
                return "Não encontrado"
            case 500:
                return "Erro interno do servidor"
            case _:  # Caso padrão (default)
                return f"Status desconhecido: {status}"
    
    print(analisar_status(200))  # OK
    print(analisar_status(418))  # Status desconhecido: 418
    
    # Pattern matching com estruturas
    def processar_comando(comando):
        match comando.split():
            case ["sair"]:
                return "Saindo do programa"
            case ["ajuda"]:
                return "Mostrando ajuda"
            case ["criar", nome]:
                return f"Criando {nome}"
            case ["abrir", nome, "como", modo]:
                return f"Abrindo {nome} no modo {modo}"
            case ["mover", origem, destino]:
                return f"Movendo de {origem} para {destino}"
            case _:
                return "Comando desconhecido"
    
    print(processar_comando("sair"))  # Saindo do programa
    print(processar_comando("criar projeto"))  # Criando projeto
    print(processar_comando("abrir arquivo.txt como leitura"))  # Abrindo arquivo.txt no modo leitura
    print(processar_comando("algo desconhecido"))  # Comando desconhecido
    ```

=== "Pattern Matching Avançado"
    ```python
    # Pattern matching com objetos e desempacotamento
    
    # Definindo algumas classes para o exemplo
    class Ponto:
        def __init__(self, x, y):
            self.x = x
            self.y = y
    
    class Círculo:
        def __init__(self, centro, raio):
            self.centro = centro
            self.raio = raio
    
    class Retângulo:
        def __init__(self, p1, p2):
            self.p1 = p1  # Canto superior esquerdo
            self.p2 = p2  # Canto inferior direito
    
    # Função que usa pattern matching para formas
    def descrever_forma(forma):
        match forma:
            case Ponto(x=0, y=0):
                return "Ponto na origem"
            case Ponto(x=x, y=y) if x == y:
                return f"Ponto na diagonal principal ({x}, {y})"
            case Ponto(x=x, y=y):
                return f"Ponto em ({x}, {y})"
            case Círculo(centro=Ponto(x=0, y=0), raio=r):
                return f"Círculo centrado na origem com raio {r}"
            case Círculo(centro=c, raio=r):
                return f"Círculo centrado em ({c.x}, {c.y}) com raio {r}"
            case Retângulo(p1=Ponto(x=x1, y=y1), p2=Ponto(x=x2, y=y2)):
                largura = abs(x2 - x1)
                altura = abs(y2 - y1)
                return f"Retângulo de {largura}x{altura}"
            case _:
                return "Forma desconhecida"
    
    # Testando com diferentes formas
    p1 = Ponto(0, 0)
    p2 = Ponto(3, 3)
    p3 = Ponto(5, 10)
    
    c1 = Círculo(p1, 5)
    c2 = Círculo(p3, 2)
    
    r1 = Retângulo(Ponto(0, 0), Ponto(10, 20))
    
    print(descrever_forma(p1))  # Ponto na origem
    print(descrever_forma(p2))  # Ponto na diagonal principal (3, 3)
    print(descrever_forma(p3))  # Ponto em (5, 10)
    print(descrever_forma(c1))  # Círculo centrado na origem com raio 5
    print(descrever_forma(c2))  # Círculo centrado em (5, 10) com raio 2
    print(descrever_forma(r1))  # Retângulo de 10x20
    ```

=== "Pattern Matching com Dicionários"
    ```python
    # Pattern matching também funciona com dicionários e listas
    
    def processar_dados(dados):
        match dados:
            case {"tipo": "usuario", "nome": nome, "idade": idade}:
                return f"Usuário {nome}, {idade} anos"
            
            case {"tipo": "produto", "nome": nome, "preço": preco}:
                return f"Produto {nome}, R$ {preco:.2f}"
            
            case {"tipo": "erro", "código": codigo, "mensagem": mensagem}:
                return f"Erro {codigo}: {mensagem}"
            
            case {"tipo": tipo, **resto}:
                return f"Tipo desconhecido: {tipo}, dados extras: {resto}"
            
            case _:
                return "Formato de dados inválido"
    
    # Testando com diferentes dados
    print(processar_dados({"tipo": "usuario", "nome": "Ana", "idade": 30}))
    # Usuário Ana, 30 anos
    
    print(processar_dados({"tipo": "produto", "nome": "Laptop", "preço": 3500}))
    # Produto Laptop, R$ 3500.00
    
    print(processar_dados({"tipo": "erro", "código": 404, "mensagem": "Não encontrado"}))
    # Erro 404: Não encontrado
    
    print(processar_dados({"tipo": "configuração", "modo": "debug", "ativo": True}))
    # Tipo desconhecido: configuração, dados extras: {'modo': 'debug', 'ativo': True}
    
    # Desempacotamento de listas com OR e número variável de elementos
    def analisar_pontos(pontos):
        match pontos:
            case []:
                return "Lista vazia"
            case [x, y]:
                return f"Um ponto: ({x}, {y})"
            case [x, y, z]:
                return f"Um ponto 3D: ({x}, {y}, {z})"
            case [x, y, *resto] if len(resto) < 3:
                return f"Ponto com extras: ({x}, {y}) + {resto}"
            case [1, 2, *_] | [0, 0, *_]:
                return "Lista começa com [1, 2] ou [0, 0]"
            case _:
                return f"Lista muito longa ou formato desconhecido"
    
    print(analisar_pontos([]))  # Lista vazia
    print(analisar_pontos([10, 20]))  # Um ponto: (10, 20)
    print(analisar_pontos([10, 20, 30]))  # Um ponto 3D: (10, 20, 30)
    print(analisar_pontos([5, 5, 1, 2]))  # Ponto com extras: (5, 5) + [1, 2]
    print(analisar_pontos([1, 2, 3, 4, 5]))  # Lista começa com [1, 2] ou [0, 0]
    ```

=== "Tratamento de Erros Melhorado"
    ```python
    # Python 3.10 oferece mensagens de erro mais precisas e úteis
    
    # Antes do Python 3.10
    # Erro de sintaxe em uma chamada aninhada:
    # 
    # func(arg1, arg2, arg3, name=value
    #
    # SyntaxError: invalid syntax
    
    # Python 3.10 mostra mensagens mais claras:
    #
    # func(arg1, arg2, arg3, name=value
    #                             ^
    # SyntaxError: ',' expected after dictionary key and value
    
    # Mensagens melhoradas para tipos incompatíveis
    
    # Antes do Python 3.10:
    # TypeError: can only concatenate str (not "int") to str
    
    # Python 3.10:
    # TypeError: can only concatenate str (not "int") to str. 
    # Did you mean to convert the int to a str first?
    
    # Exemplo com erros de tipo
    def soma_strings(a, b):
        return a + b
    
    try:
        resultado = soma_strings("Python", 10)
    except TypeError as e:
        print(f"Erro: {e}")
        # No Python 3.10: Erro: can only concatenate str (not "int") to str. 
        # Did you mean to convert the int to a str first?
    
    # As mensagens de erro agora mostram a cadeia completa de exceções
    try:
        try:
            1 / 0
        except Exception as e:
            raise ValueError("Ocorreu um erro de cálculo") from e
    except ValueError as e:
        print(f"Erro capturado: {e}")
        print(f"Causa original: {e.__cause__}")
    ```

=== "Parênteses em Gerenciadores de Contexto"
    ```python
    # Python 3.10 permite parênteses em gerenciadores de contexto
    
    # Antes, para múltiplos gerenciadores de contexto:
    # Opção 1: aninhamento (difícil de ler)
    with open('arquivo1.txt') as f1:
        with open('arquivo2.txt') as f2:
            conteudo1 = f1.read()
            conteudo2 = f2.read()
    
    # Opção 2: em uma linha (pode ficar muito longa)
    with open('arquivo1.txt') as f1, open('arquivo2.txt') as f2:
        conteudo1 = f1.read()
        conteudo2 = f2.read()
    
    # Python 3.10: parênteses para quebrar em múltiplas linhas
    with (
        open('arquivo1.txt') as f1,
        open('arquivo2.txt') as f2,
        open('arquivo3.txt') as f3
    ):
        # Agora o código é mais claro e legível
        conteudo1 = f1.read()
        conteudo2 = f2.read()
        conteudo3 = f3.read()
    
    # Útil para contextos complexos
    import threading
    import contextlib
    
    # Exemplo mais complexo
    with (
        open('log.txt', 'w') as log,
        contextlib.redirect_stdout(log),
        contextlib.redirect_stderr(log),
        threading.Lock()
    ):
        print("Esta saída vai para o arquivo log.txt")
        # Todas as saídas e erros são redirecionados para log.txt
        # e o código é executado com um lock de thread
    ```

=== "Outras Melhorias"
    ```python
    # Anotações de tipo em declarações de variáveis
    # Agora, variáveis podem ter anotações de tipo sem valor inicial
    
    # Python 3.10
    from typing import Optional, List
    
    # Variáveis com anotações de tipo, sem inicialização
    nome: str
    idade: int
    ativo: bool
    
    # Em funções
    def processar_usuario():
        global nome, idade
        nome = "Alice"
        idade = 30
    
    # Isso facilita a definição de tipos em classes
    class Usuario:
        nome: str
        email: str
        ativo: bool = True
        tentativas_login: int = 0
        detalhes: Optional[dict] = None
        permissoes: List[str] = []
    
    # Operador | para unions de tipos
    # Python 3.9:
    from typing import Union
    def func(param: Union[int, str]): pass
    
    # Python 3.10:
    def func(param: int | str): pass
    
    # Funções de substring mais precisas
    texto = "Python é uma linguagem de programação"
    
    # Melhor detecção de substrings
    if "Python" in texto:
        print("Encontrou 'Python'")
    
    if "python" in texto.lower():
        print("Encontrou 'python' (case insensitive)")
    
    # Melhor desempenho para operações de string
    ```

## Python 3.11 e 3.12

Python 3.11 (lançado em outubro de 2022) e Python 3.12 (lançado em outubro de 2023) trouxeram melhorias significativas de desempenho e novos recursos.

=== "Melhorias de Desempenho"
    ```python
    # Python 3.11 é até 60% mais rápido que Python 3.10 em alguns benchmarks
    # Essa melhoria vem do projeto "Faster CPython"
    
    # Melhoria em loops e chamadas de função
    import time
    
    def testar_desempenho(n=10_000_000):
        inicio = time.time()
        
        soma = 0
        for i in range(n):
            soma += i
            
        fim = time.time()
        return fim - inicio
    
    # Execute isso no Python 3.10 e 3.11 para ver a diferença
    resultado = testar_desempenho()
    print(f"Tempo de execução: {resultado:.3f} segundos")
    
    # Também houve melhorias em:
    # - Geração e rastreamento de exceções
    # - Inicialização do interpretador
    # - Manipulação de dicionários
    # - Compreensões de lista, dict, set
    # - Importação de módulos
    ```

=== "ExceptionGroup e except*"
    ```python
    # Python 3.11 introduziu grupos de exceções
    # Útil para operações paralelas onde várias exceções podem ocorrer
    
    from exceptiongroup import ExceptionGroup  # Python 3.11+
    
    # Criando um grupo de exceções
    def operacoes_paralelas():
        erros = []
        
        try:
            # Operação 1
            x = 1 / 0
        except Exception as e:
            erros.append(e)
            
        try:
            # Operação 2
            lista = [1, 2]
            item = lista[10]
        except Exception as e:
            erros.append(e)
            
        try:
            # Operação 3
            int("não é um número")
        except Exception as e:
            erros.append(e)
        
        # Se houver erros, lança um grupo de exceções
        if erros:
            raise ExceptionGroup("Múltiplos erros ocorreram", erros)
    
    # Usando o operador except*
    try:
        operacoes_paralelas()
    except* ZeroDivisionError as e:
        print(f"Erro de divisão por zero: {e.exceptions}")
    except* IndexError as e:
        print(f"Erro de índice: {e.exceptions}")
    except* ValueError as e:
        print(f"Erro de valor: {e.exceptions}")
    except* Exception as e:
        print(f"Outros erros: {e.exceptions}")
    
    # Saída:
    # Erro de divisão por zero: (ZeroDivisionError('division by zero'),)
    # Erro de índice: (IndexError('list index out of range'),)
    # Erro de valor: (ValueError("invalid literal for int() with base 10: 'não é um número'"),)
    ```

=== "Self Type (Python 3.11)"
    ```python
    # Python 3.11 introduziu Self para anotações de tipo
    from typing import Self  # Python 3.11+
    
    class Builder:
        def __init__(self, value: int = 0) -> None:
            self.value = value
            
        def add(self, x: int) -> Self:
            self.value += x
            return self
            
        def multiply(self, x: int) -> Self:
            self.value *= x
            return self
            
        def as_string(self) -> str:
            return str(self.value)
    
    # Permite chamadas encadeadas com verificação de tipo
    resultado = Builder(10).add(5).multiply(2).as_string()
    print(resultado)  # '30'
    
    # Útil para classes derivadas
    class AdvancedBuilder(Builder):
        def subtract(self, x: int) -> Self:
            self.value -= x
            return self
    
    # O tipo Self garante que o método retorna o tipo correto
    # mesmo quando herdado por uma subclasse
    avancado = AdvancedBuilder(20).add(5).subtract(3).multiply(2)
    print(avancado.value)  # 44
    ```

=== "Anotações de Tipo (Python 3.12)"
    ```python
    # Python 3.12 introduziu melhorias no sistema de tipagem
    
    # TypedDict com items() tipados
    from typing import TypedDict, Unpack
    
    class Usuário(TypedDict):
        nome: str
        idade: int
        admin: bool
    
    def processar_usuario(**kwargs: Unpack[Usuário]) -> None:
        print(f"Nome: {kwargs['nome']}")
        print(f"Idade: {kwargs['idade']}")
        print(f"Admin: {kwargs['admin']}")
    
    # A chamada agora é verificada corretamente
    processar_usuario(nome="Alice", idade=30, admin=True)
    
    # Novos genéricos
    from typing import TypeVar, Generic, assert_type
    
    T = TypeVar('T')
    
    class Box(Generic[T]):
        def __init__(self, content: T) -> None:
            self.content = content
            
        def get(self) -> T:
            return self.content
            
        def map(self, f: 'Callable[[T], U]') -> 'Box[U]':
            return Box(f(self.content))
    
    # Type aliases genéricos
    from typing import TypeVar, List, Dict
    
    T = TypeVar('T')
    MeuMapa = Dict[str, List[T]]  # Tipo genérico parametrizado
    
    nomes: MeuMapa[str] = {"grupos": ["Alice", "Bob"]}
    idades: MeuMapa[int] = {"grupos": [25, 30]}
    ```

=== "Sintaxe f-string mais simples (Python 3.12)"
    ```python
    # Python 3.12 simplifica a sintaxe de f-strings
    
    # Antes, duplicação de chaves era necessária 
    # para usar chaves literais
    nome = "Alice"
    
    # Python 3.11 e anteriores
    print(f"Nome: {nome} {{não avaliado}}")  # Nome: Alice {não avaliado}
    
    dicionário = {"chave": "valor"}
    print(f"Acesso a dicionário: {dicionário['chave']}")
    
    # Python 3.12 - expressões mais flexíveis
    # Chaves literais não precisam ser duplicadas em alguns casos
    print(f"Nome: {nome} {'não avaliado'}")
    print(f"Cálculo: {(lambda x: x**2)(3)}")
    print(f"{dicionário=}")
    
    # Aspas dentro de f-strings são mais flexíveis
    mensagem = f"Ela disse: "Olá, {nome}!""
    print(mensagem)  # Ela disse: "Olá, Alice!"
    ```

=== "Python 3.12: PEP 701 - Formalmente Padronizando o Formato Wheel"
    ```python
    # Python 3.12 formalizou o formato Wheel de distribuição de pacotes
    
    # O formato wheel (.whl) é um formato de distribuição de pacotes Python
    # que permite instalação mais rápida e confiável do que o formato fonte.
    
    # Isso não muda o código Python, mas sim como os pacotes são distribuídos:
    
    # Exemplo de uso do pip para instalar um wheel
    # pip install package-1.0-py3-none-any.whl
    
    # Exemplo de criação de um wheel para seu projeto
    # python setup.py bdist_wheel
    
    # Benefícios:
    # - Instalação mais rápida (não precisa compilar durante a instalação)
    # - Não requer um compilador na máquina alvo
    # - Verifica assinaturas e hashes automaticamente
    # - Melhor suporte para dependências nativas de sistema
    
    # Outras melhorias:
    # - Implementação otimizada de sum()
    # - As tuplas e os módulos agora são subclasses de collections.abc
    # - Suporte para vários interpretadores em módulos de extensão
    # - Removidos muitos recursos obsoletos e deprecados
    ```

## Migração entre Versões

Atualizar código Python para versões mais recentes requer atenção a mudanças e recursos obsoletos.

=== "Prática Recomendada"
    ```python
    # Boas práticas para migração entre versões do Python
    
    # 1. Teste seu código com ferramentas de análise
    # Ferramentas como pyupgrade e pylint podem identificar padrões obsoletos
    
    # 2. Use verificação de tipos como mypy
    
    # 3. Mantenha testes automatizados robustos
    
    # 4. Verifique as dependências do projeto
    # Certifique-se de que as bibliotecas usadas são compatíveis
    
    # 5. Use codemod ou ferramentas de migração automatizada
    
    # 6. Aproveite a chance para modernizar seu código
    # Exemplo: atualizar de Python 3.8 para 3.10 - usar pattern matching
    
    # Código antigo
    def processar_status(status_code):
        if status_code == 200:
            return "OK"
        elif status_code == 404:
            return "Não encontrado"
        elif status_code == 500:
            return "Erro interno"
        else:
            return f"Status desconhecido: {status_code}"
    
    # Código modernizado (Python 3.10)
    def processar_status(status_code):
        match status_code:
            case 200:
                return "OK"
            case 404:
                return "Não encontrado"
            case 500:
                return "Erro interno"
            case _:
                return f"Status desconhecido: {status_code}"
    ```

=== "Ferramentas e Estratégias"
    ```python
    # Ferramentas úteis para migração:
    
    # - pyupgrade: atualiza a sintaxe automaticamente para novas versões
    # pip install pyupgrade
    # pyupgrade --py310-plus arquivo.py
    
    # - pylint: verifica problemas de estilo, bugs e recursos obsoletos
    # pip install pylint
    # pylint arquivo.py
    
    # - mypy: verifica tipos estáticos
    # pip install mypy
    # mypy arquivo.py
    
    # - pytest: executa testes automatizados
    # pip install pytest
    # pytest
    
    # - pip-audit: verifica vulnerabilidades em dependências
    # pip install pip-audit
    # pip-audit
    
    # Estratégia recomendada:
    # 1. Faça backup ou garanta que o código está em controle de versão
    # 2. Execute verificadores automáticos
    # 3. Corrija os problemas encontrados
    # 4. Execute testes e valide as alterações
    # 5. Aproveite novos recursos da versão alvo
    ```

=== "Dicas e Avisos"
    ```python
    # Dicas para uma migração suave:
    
    # 1. Conheça as mudanças entre versões
    # - Leia a documentação "What's New" no site oficial Python
    # - https://docs.python.org/3/whatsnew/
    
    # 2. Use ambientes virtuais para testar
    # python -m venv venv-3.10
    # source venv-3.10/bin/activate  # Linux/Mac
    # venv-3.10\Scripts\activate      # Windows
    
    # 3. Preste atenção a recursos removidos
    # Ex: Python 3.11 removeu várias funcionalidades obsoletas:
    # - distutils (substituído por setuptools)
    # - wstr em unicodedata (sem substituição)
    # - vários módulos 'as' da importlib
    
    # 4. Atualize uma versão por vez para projetos grandes
    # Python 3.8 -> 3.9 -> 3.10 -> 3.11 -> 3.12
    
    # 5. Fique atento ao ciclo de vida das versões Python
    # Em geral, cada versão recebe suporte por 5 anos
    
    # Estado atual (2023):
    # 3.7 - Fim do suporte: 27 junho 2023
    # 3.8 - Suporte até outubro 2024
    # 3.9 - Suporte até outubro 2025
    # 3.10 - Suporte até outubro 2026
    # 3.11 - Suporte até outubro 2027
    # 3.12 - Suporte até outubro 2028
    ```

## Resumo

Nesta aula, você aprendeu sobre os recursos e melhorias introduzidos nas versões recentes do Python:

- **Python 3.8**: Operador de atribuição (walrus), parâmetros posicionais, f-strings melhoradas
- **Python 3.9**: Operadores de união para dicionários, métodos de string para prefixos/sufixos
- **Python 3.10**: Pattern matching, mensagens de erro melhoradas, parênteses em gerenciadores de contexto
- **Python 3.11 e 3.12**: Melhorias significativas de desempenho, grupos de exceções, anotações de tipo aprimoradas

Também discutimos estratégias para migração entre versões e as melhores práticas para manter seu código atualizado.

!!! info "Recursos de aprendizado"
    - [Documentação oficial - What's New](https://docs.python.org/3/whatsnew/){:target="_blank"}
    - [PEPs (Python Enhancement Proposals)](https://peps.python.org/){:target="_blank"}
    - [Real Python: Cool New Features in Python 3.10](https://realpython.com/python310-new-features/){:target="_blank"}
    - [Real Python: Cool New Features in Python 3.11](https://realpython.com/python311-new-features/){:target="_blank"}
    - [Real Python: Cool New Features in Python 3.12](https://realpython.com/python312-new-features/){:target="_blank"}

## Próximos Passos na Jornada Python

Parabéns por concluir esta trilha de aprendizado Python! Para continuar sua jornada de aprendizado, considere:

1. **Aprofundar-se em áreas específicas**:
   - Desenvolvimento web com Django ou Flask
   - Ciência de dados com pandas, numpy e matplotlib
   - Machine Learning com scikit-learn, TensorFlow ou PyTorch
   - Automação e scripting

2. **Participar da comunidade**:
   - Contribuir para projetos de código aberto
   - Participar de grupos de usuários e conferências Python

3. **Desenvolver projetos pessoais**:
   - Aplicar os conhecimentos adquiridos em projetos reais
   - Construir um portfólio para demonstrar suas habilidades

4. **Continuar estudando**:
   - Arquitetura de software e padrões de design
   - Práticas de DevOps e CI/CD com Python
   - Segurança em aplicações Python

[← Voltar para Testes em Python](//trilhas/python/page-15)
