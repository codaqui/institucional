# Debugando e Tratando Erros

## Introdução

A capacidade de identificar, entender e tratar erros é uma habilidade essencial para qualquer programador. Python oferece ferramentas robustas para depuração (debugging) e tratamento de exceções, permitindo criar programas que funcionam corretamente e lidam graciosamente com situações inesperadas.

!!! info "Objetivos de Aprendizado"
    - Entender os diferentes tipos de erros em Python
    - Aprender a interpretar mensagens de erro
    - Dominar o tratamento de exceções com `try-except`
    - Conhecer técnicas eficientes de depuração
    - Desenvolver código mais robusto e resiliente

## Tipos de Erros em Python

Python tem dois tipos principais de erros: erros de sintaxe e exceções.

=== "Erros de Sintaxe"
    ```python
    # Erros de sintaxe ocorrem quando o Python não consegue entender o código
    # O interpretador detecta estes erros antes de executar o programa
    
    # Exemplos:
    
    # Parêntese faltando
    print("Olá, mundo!"  # SyntaxError: unexpected EOF while parsing
    
    # Indentação incorreta
    def funcao():
    print("Erro de indentação")  # IndentationError: expected an indented block
    
    # Palavra-chave incorreta
    for i on range(5):  # SyntaxError: invalid syntax
        print(i)
    ```

=== "Exceções"
    ```python
    # Exceções são erros detectados durante a execução
    # O programa começa a rodar, mas encontra um problema em tempo de execução
    
    # Exemplos:
    
    # Divisão por zero
    resultado = 10 / 0  # ZeroDivisionError: division by zero
    
    # Acesso a um índice inexistente
    lista = [1, 2, 3]
    item = lista[5]  # IndexError: list index out of range
    
    # Uso de variável não definida
    print(variavel_inexistente)  # NameError: name 'variavel_inexistente' is not defined
    
    # Conversão de tipo inválida
    int("texto")  # ValueError: invalid literal for int() with base 10: 'texto'
    ```

## Exceções Comuns em Python

Conhecer as exceções mais comuns ajuda a identificar e corrigir problemas rapidamente.

=== "Exceções Básicas"
    ```python
    # ValueError - Ocorre quando uma função recebe um argumento de tipo correto mas valor inadequado
    int("abc")  # ValueError: invalid literal for int() with base 10: 'abc'
    
    # TypeError - Ocorre quando uma operação é aplicada a um objeto de tipo inadequado
    "texto" + 5  # TypeError: can only concatenate str (not "int") to str
    
    # NameError - Ocorre quando uma variável ou função não é encontrada
    print(x)  # NameError: name 'x' is not defined
    
    # IndexError - Ocorre ao tentar acessar um índice inexistente em uma sequência
    lista = [1, 2, 3]
    lista[10]  # IndexError: list index out of range
    ```

=== "Exceções de Arquivo"
    ```python
    # FileNotFoundError - Ocorre ao tentar acessar um arquivo inexistente
    with open("arquivo_inexistente.txt", "r") as arquivo:
        conteudo = arquivo.read()  # FileNotFoundError: [Errno 2] No such file or directory: 'arquivo_inexistente.txt'
    
    # PermissionError - Ocorre ao tentar acessar um arquivo sem permissão
    # PermissionError: [Errno 13] Permission denied: '/etc/passwd'
    
    # IOError - Ocorre quando uma operação de entrada/saída falha
    # Agora é um alias para OSError no Python 3
    ```

=== "Exceções de Dicionário"
    ```python
    # KeyError - Ocorre ao tentar acessar uma chave inexistente em um dicionário
    dicionario = {"a": 1, "b": 2}
    dicionario["c"]  # KeyError: 'c'
    
    # Alternativa segura
    valor = dicionario.get("c", "Não encontrado")  # Não gera erro, retorna o valor padrão
    ```

=== "Outras Exceções Comuns"
    ```python
    # AttributeError - Ocorre ao tentar acessar um atributo inexistente
    "texto".inexistente  # AttributeError: 'str' object has no attribute 'inexistente'
    
    # ImportError - Ocorre quando uma importação falha
    import modulo_inexistente  # ImportError: No module named 'modulo_inexistente'
    
    # ModuleNotFoundError - Específico para módulos não encontrados (subclasse de ImportError)
    import modulo_inexistente  # ModuleNotFoundError: No module named 'modulo_inexistente'
    
    # RuntimeError - Exceção genérica quando um erro não se encaixa em outra categoria
    ```

## Interpretando Mensagens de Erro

Saber interpretar mensagens de erro é uma habilidade crucial para resolução de problemas.

=== "Anatomia de uma Mensagem de Erro"
    ```
    Traceback (most recent call last):
      File "script.py", line 5, in <module>
        resultado = funcao()
      File "script.py", line 3, in funcao
        return 10 / 0
    ZeroDivisionError: division by zero
    ```
    
    Esta mensagem de erro possui 4 partes principais:
    
    1. **Traceback**: indica onde procurar o erro, mostrando a pilha de chamadas
    2. **Localização**: arquivo, número da linha e contexto onde o erro ocorreu
    3. **Código problemático**: a linha específica que causou o erro
    4. **Tipo e descrição do erro**: nome da exceção e uma mensagem explicativa

=== "Lendo de Baixo para Cima"
    ```python
    # Ao analisar um traceback, comece pelo final (a exceção específica)
    # Depois vá subindo para entender como o programa chegou ao erro
    
    def funcao3():
        return 10 / 0
    
    def funcao2():
        return funcao3()
    
    def funcao1():
        return funcao2()
    
    funcao1()
    # ZeroDivisionError: division by zero
    #   File "script.py", line 3, in funcao3
    #     return 10 / 0
    #   File "script.py", line 6, in funcao2
    #     return funcao3()
    #   File "script.py", line 9, in funcao1
    #     return funcao2()
    #   File "script.py", line 11, in <module>
    #     funcao1()
    ```

!!! tip "Dica de Depuração"
    Quando se deparar com um erro, primeiro identifique:
    
    1. **O que** deu errado (tipo da exceção)
    2. **Onde** ocorreu (linha e arquivo)
    3. **Por que** ocorreu (entendendo o contexto)

## Tratamento de Exceções

Python usa blocos `try-except` para tratar exceções, permitindo que o código reaja adequadamente quando erros ocorrem.

=== "Estrutura Básica"
    ```python
    try:
        # Código que pode gerar uma exceção
        resultado = 10 / 0
    except:
        # Código executado se uma exceção ocorrer
        print("Ocorreu um erro!")
    ```

=== "Capturando Exceções Específicas"
    ```python
    try:
        numero = int(input("Digite um número: "))
        resultado = 10 / numero
        print(f"Resultado: {resultado}")
    except ValueError:
        print("Erro: Você não digitou um número válido!")
    except ZeroDivisionError:
        print("Erro: Não é possível dividir por zero!")
    ```

=== "Capturando Múltiplas Exceções"
    ```python
    try:
        # Algum código arriscado
        arquivo = open("dados.txt", "r")
        linha = arquivo.readline()
        numero = int(linha.strip())
    except (FileNotFoundError, IOError):
        # Tratando erros de arquivo
        print("Erro ao acessar o arquivo!")
    except ValueError:
        # Tratando erros de conversão
        print("O arquivo não contém um número válido!")
    ```

=== "Capturando e Analisando a Exceção"
    ```python
    try:
        idade = int(input("Digite sua idade: "))
        if idade < 0:
            raise ValueError("A idade não pode ser negativa")
    except ValueError as erro:
        print(f"Erro: {erro}")
        # Podemos analisar o objeto erro para decisões mais específicas
        if "negativa" in str(erro):
            print("Por favor, digite uma idade válida e positiva.")
        else:
            print("Por favor, digite um número inteiro para a idade.")
    ```

=== "Cláusulas else e finally"
    ```python
    try:
        arquivo = open("dados.txt", "r")
        conteudo = arquivo.read()
    except FileNotFoundError:
        print("O arquivo não foi encontrado!")
    else:
        # Executado somente se nenhuma exceção ocorrer
        print(f"Conteúdo do arquivo: {conteudo}")
    finally:
        # Executado sempre, independentemente de exceções
        print("Operação finalizada")
        # Garantimos que o arquivo seja fechado mesmo se ocorrer uma exceção
        if 'arquivo' in locals() and not arquivo.closed:
            arquivo.close()
            print("Arquivo fechado")
    ```

## Criando Exceções Personalizadas

Você pode criar suas próprias exceções para situações específicas do seu programa.

=== "Definindo Exceções Personalizadas"
    ```python
    class SaldoInsuficienteError(Exception):
        """Exceção levantada quando uma operação excede o saldo disponível."""
        def __init__(self, saldo, valor):
            self.saldo = saldo
            self.valor = valor
            self.deficit = valor - saldo
            mensagem = f"Saldo insuficiente: tentou sacar {valor}, mas só tem {saldo} disponível (faltam {self.deficit})"
            super().__init__(mensagem)
    
    # Usando a exceção personalizada
    def sacar(saldo, valor):
        if valor > saldo:
            raise SaldoInsuficienteError(saldo, valor)
        return saldo - valor
    
    try:
        novo_saldo = sacar(100, 150)
    except SaldoInsuficienteError as e:
        print(f"Erro: {e}")
        print(f"Déficit: {e.deficit}")
    ```

## Técnicas de Depuração

Quando o tratamento de exceções não é suficiente, essas técnicas podem ajudar a identificar a causa dos problemas.

=== "Depuração com print()"
    ```python
    def calcular_media(numeros):
        print(f"Calculando média de: {numeros}")
        
        total = 0
        for i, num in enumerate(numeros):
            print(f"Adicionando número {i}: {num}")
            total += num
            print(f"Total atual: {total}")
        
        media = total / len(numeros)
        print(f"Média calculada: {media}")
        return media
    
    try:
        resultado = calcular_media([10, 20, 30, 40])
        print(f"Resultado: {resultado}")
    except Exception as e:
        print(f"Erro: {e}")
    ```

=== "Usando o Debugger Integrado (pdb)"
    ```python
    import pdb
    
    def funcao_problematica(a, b):
        resultado = a + b
        # Inicia o debugger
        pdb.set_trace()
        # No console interativo que aparece, você pode:
        # - Digitar variáveis para ver seus valores
        # - Usar n (next) para executar a próxima linha
        # - Usar c (continue) para continuar até o próximo breakpoint
        # - Usar q (quit) para sair
        
        resultado = resultado * 2
        return resultado / 0  # Isso vai gerar um erro
    
    funcao_problematica(5, 10)
    ```

=== "Usando logging em vez de print"
    ```python
    import logging
    
    # Configuração básica do logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s',
        filename='app.log'  # Salva em arquivo em vez de exibir no console
    )
    
    def dividir(a, b):
        logging.debug(f"Tentando dividir {a} por {b}")
        try:
            resultado = a / b
            logging.info(f"Divisão bem-sucedida: {resultado}")
            return resultado
        except ZeroDivisionError:
            logging.error(f"Erro: Tentativa de divisão por zero")
            return None
    
    # Os logs serão salvos no arquivo app.log
    dividir(10, 2)
    dividir(10, 0)
    ```

=== "Usando try com Context Manager"
    ```python
    # Context managers (with) ajudam a garantir que recursos sejam liberados
    
    try:
        with open("arquivo.txt", "r") as arquivo:
            conteudo = arquivo.read()
            # Mesmo que ocorra um erro aqui, o arquivo será fechado
    except FileNotFoundError:
        print("Arquivo não encontrado")
    
    # Outro exemplo: medindo o tempo de execução
    import time
    
    class Timer:
        def __enter__(self):
            self.start = time.time()
            return self
            
        def __exit__(self, exc_type, exc_val, exc_tb):
            self.end = time.time()
            self.interval = self.end - self.start
            print(f"Tempo de execução: {self.interval:.4f} segundos")
            
    with Timer():
        # Código a ser medido
        sum(range(10000000))
    ```

## Boas Práticas no Tratamento de Erros

=== "Especificidade nas Exceções"
    ```python
    # EVITE: capturar todas as exceções
    try:
        # Código arriscado
        resultado = int("texto")
    except:  # Muito genérico!
        print("Erro")
    
    # MELHOR: capturar exceções específicas
    try:
        resultado = int("texto")
    except ValueError:
        print("Não foi possível converter para número")
    ```

=== "Ordem das Exceções"
    ```python
    # ERRADO: subclasse depois da classe pai
    try:
        # Algum código
        pass
    except Exception:  # Captura todas as exceções
        print("Erro genérico")
    except ValueError:  # Nunca será alcançado!
        print("Erro de valor")
    
    # CORRETO: exceções mais específicas primeiro
    try:
        # Algum código
        pass
    except ValueError:  # Exceção específica
        print("Erro de valor")
    except Exception:  # Exceção genérica para outros casos
        print("Outro tipo de erro")
    ```

=== "Relançamento de Exceções"
    ```python
    def processar_dados(dados):
        try:
            # Tentar processar os dados
            resultado = dados[0] / dados[1]
            return resultado
        except ZeroDivisionError:
            # Tratar especificamente divisão por zero
            print("Erro: Divisão por zero não permitida")
            raise  # Relança a mesma exceção
        except Exception as e:
            # Registra o erro e lança uma exceção mais informativa
            print(f"Erro ao processar dados: {e}")
            raise RuntimeError(f"Falha no processamento dos dados: {e}") from e
    ```

=== "Mensagens de Erro Informativas"
    ```python
    def validar_idade(idade):
        try:
            idade = int(idade)
            if idade < 0:
                raise ValueError("A idade não pode ser negativa")
            if idade > 150:
                raise ValueError("A idade parece muito alta, verifique o valor")
            return idade
        except ValueError as e:
            # Se o erro for da nossa validação, já tem mensagem informativa
            # Se for do int(), adicionamos contexto
            if "invalid literal" in str(e):
                raise ValueError(f"'{idade}' não é um número válido") from e
            else:
                raise  # Relança a nossa exceção com mensagem personalizada
    ```

=== "Limpeza de Recursos"
    ```python
    def processar_arquivo(nome_arquivo):
        arquivo = None
        try:
            arquivo = open(nome_arquivo, 'r')
            # Processar arquivo
            return arquivo.read()
        except FileNotFoundError:
            print(f"O arquivo '{nome_arquivo}' não foi encontrado.")
            return None
        finally:
            # Garantir que o arquivo seja fechado mesmo com erro
            if arquivo:
                arquivo.close()
                print("Arquivo fechado com sucesso")
    
    # Melhor ainda: usar context manager (with)
    def processar_arquivo_seguro(nome_arquivo):
        try:
            with open(nome_arquivo, 'r') as arquivo:
                return arquivo.read()
        except FileNotFoundError:
            print(f"O arquivo '{nome_arquivo}' não foi encontrado.")
            return None
    ```

## Depuração de Código Assíncrono

A depuração de código assíncrono apresenta desafios adicionais.

=== "Tratamento de Exceções em Async"
    ```python
    import asyncio
    
    async def tarefa_arriscada():
        # Simulando uma tarefa que pode falhar
        await asyncio.sleep(1)
        raise ValueError("Erro na tarefa assíncrona")
    
    async def main():
        try:
            await tarefa_arriscada()
        except ValueError as e:
            print(f"Capturei um erro assíncrono: {e}")
    
    # Executando o código assíncrono
    asyncio.run(main())
    ```

=== "Exceções em Múltiplas Tasks"
    ```python
    import asyncio
    
    async def tarefa_1():
        await asyncio.sleep(1)
        raise ValueError("Erro na tarefa 1")
    
    async def tarefa_2():
        await asyncio.sleep(2)
        return "Tarefa 2 concluída"
    
    async def main():
        # gather() propaga exceções por padrão
        try:
            resultados = await asyncio.gather(
                tarefa_1(),
                tarefa_2(),
                return_exceptions=True  # Isso captura exceções como resultados
            )
            
            for i, resultado in enumerate(resultados):
                if isinstance(resultado, Exception):
                    print(f"Tarefa {i+1} falhou com: {resultado}")
                else:
                    print(f"Tarefa {i+1} retornou: {resultado}")
                    
        except Exception as e:
            print(f"Uma exceção não capturada: {e}")
    
    asyncio.run(main())
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Tipos de erros** em Python: erros de sintaxe e exceções
- **Exceções comuns** e como interpretá-las
- **Tratamento de exceções** com blocos `try-except`
- **Cláusulas adicionais** como `else` e `finally`
- **Exceções personalizadas** para situações específicas
- **Técnicas de depuração** para identificar problemas
- **Boas práticas** para escrever código robusto e tratamento adequado de erros
- **Depuração de código assíncrono**

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre exceções](https://docs.python.org/3/tutorial/errors.html){:target="_blank"}
    - [Hierarquia de exceções embutidas](https://docs.python.org/3/library/exceptions.html#exception-hierarchy){:target="_blank"}
    - [Documentação sobre o módulo logging](https://docs.python.org/3/library/logging.html){:target="_blank"}
    - [Documentação sobre pdb (Python Debugger)](https://docs.python.org/3/library/pdb.html){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos como trabalhar com módulos em Python, que permitem organizar código em componentes reutilizáveis.

[Avance para a próxima aula →](//trilhas/python/page-9)

[← Voltar para Expressões Lambdas e Funções Integradas](//trilhas/python/page-7)