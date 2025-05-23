<!-- filepath: /home/Enderson.Menezes/Code/codaqui/institucional/docs/trilhas/python/page-12.md -->
# Decoradores

## Introdução

Decoradores são uma poderosa ferramenta em Python que permite modificar ou estender o comportamento de funções e classes de forma limpa e reutilizável. Eles seguem o padrão de design Decorator, que permite adicionar funcionalidades a objetos sem modificar sua estrutura.

!!! info "Objetivos de Aprendizado"
    - Entender o conceito de decoradores e sua importância em Python
    - Aprender a criar e aplicar decoradores básicos em funções
    - Compreender como funcionam decoradores com argumentos
    - Explorar decoradores de classe e métodos
    - Conhecer decoradores comuns na biblioteca padrão e frameworks
    - Aplicar decoradores para resolver problemas práticos

## Conceitos Básicos de Decoradores

Um decorador é uma função que recebe outra função como entrada e retorna uma terceira função, geralmente estendendo a funcionalidade da função original sem modificá-la diretamente.

=== "O Que São Decoradores"
    ```python
    # Decoradores são funções que envolvem outras funções
    # Eles permitem modificar o comportamento de funções sem alterá-las
    
    # Função que será decorada
    def saudacao(nome):
        return f"Olá, {nome}!"
    
    # Função decoradora
    def fazer_educado(funcao):
        # Esta função interna é o "wrapper" (envoltório)
        def wrapper(nome):
            # Adiciona "por favor" e "obrigado"
            print("Por favor...")
            resultado = funcao(nome)
            print("Obrigado!")
            return resultado
        # Retorna o wrapper, não o resultado da função
        return wrapper
    
    # Aplicando o decorador manualmente
    saudacao_educada = fazer_educado(saudacao)
    
    # Chamando a função decorada
    print(saudacao_educada("Maria"))
    # Saída:
    # Por favor...
    # Obrigado!
    # Olá, Maria!
    ```

=== "Sintaxe com @"
    ```python
    # A sintaxe @ é um açúcar sintático para aplicar decoradores
    
    # Definição do decorador
    def fazer_educado(funcao):
        def wrapper(nome):
            print("Por favor...")
            resultado = funcao(nome)
            print("Obrigado!")
            return resultado
        return wrapper
    
    # Aplicando o decorador com a sintaxe @
    @fazer_educado
    def saudacao(nome):
        return f"Olá, {nome}!"
    
    # Quando usamos @fazer_educado, é o mesmo que:
    # saudacao = fazer_educado(saudacao)
    
    # Chamando a função decorada
    print(saudacao("João"))
    # Saída:
    # Por favor...
    # Obrigado!
    # Olá, João!
    ```

=== "Como Funciona"
    ```python
    # A magia dos decoradores está na avaliação em tempo de definição
    
    def meu_decorador(funcao):
        print(f"Decorando {funcao.__name__}")
        
        def wrapper(*args, **kwargs):
            print(f"Iniciando {funcao.__name__}")
            resultado = funcao(*args, **kwargs)
            print(f"Finalizando {funcao.__name__}")
            return resultado
            
        print("Decorador pronto!")
        return wrapper
    
    print("Definindo função...")
    
    @meu_decorador
    def minha_funcao(x, y):
        print(f"Executando com {x} e {y}")
        return x + y
    
    print("Função definida!")
    
    resultado = minha_funcao(5, 3)
    print(f"Resultado: {resultado}")
    
    # Saída:
    # Definindo função...
    # Decorando minha_funcao
    # Decorador pronto!
    # Função definida!
    # Iniciando minha_funcao
    # Executando com 5 e 3
    # Finalizando minha_funcao
    # Resultado: 8
    ```

## Decoradores com functools.wraps

Quando criamos decoradores, a função original perde seus metadados (nome, docstring, etc.). O `functools.wraps` resolve esse problema.

=== "Problema de Metadados"
    ```python
    def meu_decorador(funcao):
        def wrapper(*args, **kwargs):
            """Função wrapper interna"""
            print("Antes")
            resultado = funcao(*args, **kwargs)
            print("Depois")
            return resultado
        return wrapper
    
    @meu_decorador
    def soma(a, b):
        """Soma dois números."""
        return a + b
    
    # Verificando o nome e docstring da função decorada
    print(f"Nome: {soma.__name__}")  # Nome: wrapper
    print(f"Docstring: {soma.__doc__}")  # Docstring: Função wrapper interna
    
    # Isso é um problema quando usamos ferramentas de documentação
    # ou depuração que dependem desses metadados
    ```

=== "Solução com wraps"
    ```python
    from functools import wraps
    
    def meu_decorador(funcao):
        @wraps(funcao)  # Preserva os metadados da função original
        def wrapper(*args, **kwargs):
            """Função wrapper interna"""
            print("Antes")
            resultado = funcao(*args, **kwargs)
            print("Depois")
            return resultado
        return wrapper
    
    @meu_decorador
    def soma(a, b):
        """Soma dois números."""
        return a + b
    
    # Agora os metadados são preservados
    print(f"Nome: {soma.__name__}")  # Nome: soma
    print(f"Docstring: {soma.__doc__}")  # Docstring: Soma dois números.
    ```

!!! tip "Prática Recomendada"
    Sempre use `@functools.wraps` ao criar decoradores para preservar os metadados da função original. Isso é importante para depuração, documentação e introspection do código.

## Decoradores com Argumentos

Decoradores também podem aceitar argumentos, o que aumenta sua flexibilidade.

=== "Decorador com Argumentos"
    ```python
    from functools import wraps
    
    def repetir(vezes=1):
        """Decorador que repete a execução da função decorada."""
        # Esta função externa captura os argumentos do decorador
        def decorador(funcao):
            # Esta função intermediária é o decorador real
            @wraps(funcao)
            def wrapper(*args, **kwargs):
                # Esta função interna envolve a função original
                resultado = None
                for _ in range(vezes):
                    resultado = funcao(*args, **kwargs)
                return resultado
            return wrapper
        return decorador
    
    # Usando o decorador com argumentos
    @repetir(vezes=3)
    def saudacao(nome):
        print(f"Olá, {nome}!")
        return nome
    
    # Chamando a função decorada
    saudacao("Ana")
    # Saída:
    # Olá, Ana!
    # Olá, Ana!
    # Olá, Ana!
    ```

=== "Usando Valores Padrão"
    ```python
    from functools import wraps
    
    def registrar(prefixo="INFO"):
        """Decorador que registra informações sobre a chamada da função."""
        def decorador(funcao):
            @wraps(funcao)
            def wrapper(*args, **kwargs):
                print(f"[{prefixo}] Chamando {funcao.__name__}")
                
                argumentos = [str(arg) for arg in args]
                kwargs_str = [f"{k}={v}" for k, v in kwargs.items()]
                todos_args = argumentos + kwargs_str
                
                print(f"[{prefixo}] Argumentos: {', '.join(todos_args)}")
                
                resultado = funcao(*args, **kwargs)
                
                print(f"[{prefixo}] {funcao.__name__} retornou: {resultado}")
                return resultado
            return wrapper
        return decorador
    
    # Usando com valor padrão
    @registrar()  # Observe os parênteses vazios
    def soma(a, b):
        return a + b
    
    # Usando com argumento personalizado
    @registrar(prefixo="DEBUG")
    def multiplica(a, b):
        return a * b
    
    soma(5, 3)
    # [INFO] Chamando soma
    # [INFO] Argumentos: 5, 3
    # [INFO] soma retornou: 8
    
    multiplica(4, 2)
    # [DEBUG] Chamando multiplica
    # [DEBUG] Argumentos: 4, 2
    # [DEBUG] multiplica retornou: 8
    ```

=== "Decorador Flexível"
    ```python
    from functools import wraps
    import time
    
    def cronometrar(funcao=None, *, decimal_places=4):
        """
        Decorador que mede o tempo de execução de uma função.
        Pode ser usado com ou sem argumentos.
        """
        # Se chamado sem argumentos como @cronometrar
        if funcao is not None:
            @wraps(funcao)
            def wrapper_simples(*args, **kwargs):
                inicio = time.time()
                resultado = funcao(*args, **kwargs)
                fim = time.time()
                print(f"{funcao.__name__} levou {fim - inicio:.4f} segundos")
                return resultado
            return wrapper_simples
            
        # Se chamado com argumentos como @cronometrar(decimal_places=2)
        else:
            def decorador(func):
                @wraps(func)
                def wrapper(*args, **kwargs):
                    inicio = time.time()
                    resultado = func(*args, **kwargs)
                    fim = time.time()
                    print(f"{func.__name__} levou {fim - inicio:.{decimal_places}f} segundos")
                    return resultado
                return wrapper
            return decorador
    
    # Uso sem argumentos
    @cronometrar
    def operacao_lenta():
        time.sleep(0.5)
        
    # Uso com argumentos
    @cronometrar(decimal_places=2)
    def outra_operacao():
        time.sleep(0.3)
        
    operacao_lenta()      # operacao_lenta levou 0.5001 segundos
    outra_operacao()      # outra_operacao levou 0.30 segundos
    ```

## Decoradores Encadeados

É possível aplicar vários decoradores a uma mesma função, cada um adicionando sua própria funcionalidade.

=== "Múltiplos Decoradores"
    ```python
    from functools import wraps
    
    # Decorador para registrar a chamada
    def registrar(funcao):
        @wraps(funcao)
        def wrapper(*args, **kwargs):
            print(f"Chamando {funcao.__name__}")
            return funcao(*args, **kwargs)
        return wrapper
    
    # Decorador para verificar argumentos
    def validar_positivos(funcao):
        @wraps(funcao)
        def wrapper(*args, **kwargs):
            for arg in args:
                if isinstance(arg, (int, float)) e arg < 0:
                    raise ValueError("Argumento negativo não permitido")
            return funcao(*args, **kwargs)
        return wrapper
    
    # Aplicando múltiplos decoradores
    @registrar
    @validar_positivos
    def calcular_raiz_quadrada(numero):
        import math
        return math.sqrt(numero)
    
    # A ordem é importante! É aplicada de baixo para cima
    # Primeiro validar_positivos, depois registrar
    
    try:
        resultado = calcular_raiz_quadrada(16)
        print(f"Resultado: {resultado}")
        
        resultado = calcular_raiz_quadrada(-4)
        print(f"Resultado: {resultado}")
    except ValueError as e:
        print(f"Erro: {e}")
    
    # Saída:
    # Chamando calcular_raiz_quadrada
    # Resultado: 4.0
    # Chamando calcular_raiz_quadrada
    # Erro: Argumento negativo não permitido
    ```

=== "Ordem de Aplicação"
    ```python
    def decorador1(funcao):
        def wrapper(*args, **kwargs):
            print("Decorador 1 - Início")
            resultado = funcao(*args, **kwargs)
            print("Decorador 1 - Fim")
            return resultado
        return wrapper
    
    def decorador2(funcao):
        def wrapper(*args, **kwargs):
            print("Decorador 2 - Início")
            resultado = funcao(*args, **kwargs)
            print("Decorador 2 - Fim")
            return resultado
        return wrapper
    
    def decorador3(funcao):
        def wrapper(*args, **kwargs):
            print("Decorador 3 - Início")
            resultado = funcao(*args, **kwargs)
            print("Decorador 3 - Fim")
            return resultado
        return wrapper
    
    # Os decoradores são aplicados de baixo para cima
    @decorador1
    @decorador2
    @decorador3
    def minha_funcao():
        print("Executando a função principal")
    
    minha_funcao()
    # Saída:
    # Decorador 1 - Início
    # Decorador 2 - Início
    # Decorador 3 - Início
    # Executando a função principal
    # Decorador 3 - Fim
    # Decorador 2 - Fim
    # Decorador 1 - Fim
    ```

!!! note "Ordem dos Decoradores"
    A ordem em que os decoradores são aplicados é importante. Os decoradores mais próximos da função são aplicados primeiro, e depois os mais externos. É como vestir camadas de roupas: a primeira camada fica mais próxima do corpo.

## Decoradores de Classe

Os decoradores não estão limitados a funções; eles também podem ser aplicados a classes.

=== "Decorando Classes"
    ```python
    def adicionar_saudacao(classe):
        """Decorador que adiciona um método de saudação à classe."""
        def saudacao(self, nome):
            return f"{self.__class__.__name__} diz: Olá, {nome}!"
            
        # Adicionando o método à classe
        classe.saudacao = saudacao
        return classe
    
    # Aplicando o decorador à classe
    @adicionar_saudacao
    class Pessoa:
        def __init__(self, nome):
            self.nome = nome
            
        def apresentar(self):
            return f"Eu sou {self.nome}"
    
    # Usando a classe decorada
    pessoa = Pessoa("Carlos")
    print(pessoa.apresentar())  # Eu sou Carlos
    print(pessoa.saudacao("Maria"))  # Pessoa diz: Olá, Maria!
    ```

=== "Classes como Decoradores"
    ```python
    class Contador:
        """Uma classe que serve como decorador para contar chamadas de função."""
        
        def __init__(self, funcao):
            self.funcao = funcao
            self.contagem = 0
            # Copiando os metadados da função original
            self.__name__ = funcao.__name__
            self.__doc__ = funcao.__doc__
            
        def __call__(self, *args, **kwargs):
            """Método chamado quando o objeto é usado como uma função."""
            self.contagem += 1
            print(f"{self.funcao.__name__} foi chamada {self.contagem} vezes")
            return self.funcao(*args, **kwargs)
    
    # Usando a classe como decorador
    @Contador
    def minha_funcao(x, y):
        """Uma função simples que soma dois números."""
        return x + y
    
    # Cada vez que chamamos a função, o contador é incrementado
    print(minha_funcao(1, 2))  # minha_funcao foi chamada 1 vezes, 3
    print(minha_funcao(3, 4))  # minha_funcao foi chamada 2 vezes, 7
    print(minha_funcao(5, 6))  # minha_funcao foi chamada 3 vezes, 11
    ```

=== "Decoradores para Métodos"
    ```python
    from functools import wraps
    
    def registrar_metodo(metodo):
        """Decorador para registrar chamadas de métodos."""
        @wraps(metodo)
        def wrapper(self, *args, **kwargs):
            print(f"Chamando {metodo.__name__} para {self.__class__.__name__}")
            return metodo(self, *args, **kwargs)
        return wrapper
    
    class Calculadora:
        @registrar_metodo
        def somar(self, a, b):
            return a + b
            
        @registrar_metodo
        def multiplicar(self, a, b):
            return a * b
    
    # Usando os métodos decorados
    calc = Calculadora()
    print(calc.somar(5, 3))  # Chamando somar para Calculadora, 8
    print(calc.multiplicar(4, 2))  # Chamando multiplicar para Calculadora, 8
    ```

## Decoradores Especiais

Python tem alguns decoradores especiais integrados e padrões comuns para situações específicas.

=== "Método de Classe e Estático"
    ```python
    class Matematica:
        valor = 10
        
        def __init__(self, x):
            self.x = x
        
        # Método de instância (acessa self)
        def dobrar(self):
            return self.x * 2
        
        # Método de classe (acessa a classe, não a instância)
        @classmethod
        def triplo_valor(cls):
            return cls.valor * 3
        
        # Método estático (não acessa nem a classe nem a instância)
        @staticmethod
        def quadrado(y):
            return y * y
    
    # Usando métodos de instância
    mat = Matematica(5)
    print(mat.dobrar())  # 10 (dobro de 5)
    
    # Usando método de classe
    print(Matematica.triplo_valor())  # 30 (triplo de 10)
    
    # Usando método estático
    print(Matematica.quadrado(4))  # 16 (quadrado de 4)
    print(mat.quadrado(4))  # 16 (também pode ser chamado pela instância)
    ```

=== "Propriedades"
    ```python
    class Temperatura:
        def __init__(self, celsius=0):
            self._celsius = celsius
            
        # Getter
        @property
        def celsius(self):
            return self._celsius
            
        # Setter
        @celsius.setter
        def celsius(self, valor):
            if valor < -273.15:
                raise ValueError("Temperatura abaixo do zero absoluto!")
            self._celsius = valor
            
        # Propriedade calculada
        @property
        def fahrenheit(self):
            return self._celsius * 9/5 + 32
            
        @fahrenheit.setter
        def fahrenheit(self, valor):
            self.celsius = (valor - 32) * 5/9
            
        @property
        def kelvin(self):
            return self._celsius + 273.15
            
        @kelvin.setter
        def kelvin(self, valor):
            self.celsius = valor - 273.15
    
    # Usando as propriedades
    temp = Temperatura(25)
    print(f"Celsius: {temp.celsius}")  # Celsius: 25
    print(f"Fahrenheit: {temp.fahrenheit}")  # Fahrenheit: 77.0
    print(f"Kelvin: {temp.kelvin}")  # Kelvin: 298.15
    
    # Alterando temperatura
    temp.fahrenheit = 68
    print(f"Celsius: {temp.celsius}")  # Celsius: 20.0
    
    try:
        temp.celsius = -300  # Abaixo do zero absoluto
    except ValueError as e:
        print(f"Erro: {e}")  # Erro: Temperatura abaixo do zero absoluto!
    ```

=== "LRU Cache"
    ```python
    import time
    from functools import lru_cache
    
    # Função sem cache
    def fibonacci_sem_cache(n):
        if n <= 1:
            return n
        return fibonacci_sem_cache(n-1) + fibonacci_sem_cache(n-2)
    
    # Função com cache
    @lru_cache(maxsize=None)  # Cache ilimitado
    def fibonacci_com_cache(n):
        if n <= 1:
            return n
        return fibonacci_com_cache(n-1) + fibonacci_com_cache(n-2)
    
    # Comparando desempenho
    def testar_tempo(func, arg):
        inicio = time.time()
        resultado = func(arg)
        fim = time.time()
        print(f"{func.__name__}({arg}) = {resultado}, tempo: {fim - inicio:.6f} segundos")
    
    # Testando funções
    n = 30
    testar_tempo(fibonacci_sem_cache, n)  # Muito lento!
    testar_tempo(fibonacci_com_cache, n)  # Rápido!
    
    # fibonacci_sem_cache(30) = 832040, tempo: 0.308167 segundos
    # fibonacci_com_cache(30) = 832040, tempo: 0.000026 segundos
    ```

## Casos de Uso Comuns

=== "Validação de Entrada"
    ```python
    from functools import wraps
    
    def validar_tipos(*tipos):
        """Verifica se os argumentos são dos tipos esperados."""
        def decorador(funcao):
            @wraps(funcao)
            def wrapper(*args, **kwargs):
                # Verificando os argumentos posicionais
                for i, (arg, tipo) in enumerate(zip(args, tipos)):
                    if not isinstance(arg, tipo):
                        raise TypeError(
                            f"Argumento {i+1} deve ser {tipo.__name__}, "
                            f"mas recebeu {type(arg).__name__}"
                        )
                return funcao(*args, **kwargs)
            return wrapper
        return decorador
    
    @validar_tipos(int, int)
    def soma(a, b):
        return a + b
        
    @validar_tipos(str, int)
    def repetir(texto, vezes):
        return texto * vezes
    
    # Chamadas válidas
    print(soma(5, 3))       # 8
    print(repetir("abc", 3))  # abcabcabc
    
    # Chamadas inválidas
    try:
        soma("5", 3)
    except TypeError as e:
        print(f"Erro: {e}")  # Erro: Argumento 1 deve ser int, mas recebeu str
    
    try:
        repetir(5, 3)
    except TypeError as e:
        print(f"Erro: {e}")  # Erro: Argumento 1 deve ser str, mas recebeu int
    ```

=== "Log e Medição de Tempo"
    ```python
    import time
    import logging
    from functools import wraps
    
    # Configuração básica de logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    def log_tempo(funcao):
        """Registra o tempo de execução de uma função."""
        @wraps(funcao)
        def wrapper(*args, **kwargs):
            args_repr = [repr(a) for a in args]
            kwargs_repr = [f"{k}={v!r}" for k, v in kwargs.items()]
            assinatura = ", ".join(args_repr + kwargs_repr)
            
            logging.info(f"Chamando {funcao.__name__}({assinatura})")
            inicio = time.time()
            
            try:
                resultado = funcao(*args, **kwargs)
                return resultado
            finally:
                fim = time.time()
                tempo_execucao = fim - inicio
                logging.info(f"{funcao.__name__} levou {tempo_execucao:.4f} segundos para executar")
                
        return wrapper
    
    @log_tempo
    def operacao_pesada(tamanho, repeticoes=1):
        """Função que simula uma operação pesada."""
        resultado = 0
        for _ in range(repeticoes):
            for i in range(tamanho):
                resultado += i
            time.sleep(0.01)  # Simula processamento
        return resultado
    
    # Chamando a função decorada
    resultado = operacao_pesada(10000, repeticoes=2)
    print(f"Resultado: {resultado}")
    
    # Logs gerados:
    # 2023-05-10 14:30:45,123 - INFO - Chamando operacao_pesada(10000, repeticoes=2)
    # 2023-05-10 14:30:45,369 - INFO - operacao_pesada levou 0.2461 segundos para executar
    ```

=== "Retry com Backoff"
    ```python
    import time
    import random
    from functools import wraps
    
    def retry(tentativas=3, delay_inicial=1, fator_backoff=2):
        """
        Decorador que tenta executar a função várias vezes com backoff exponencial.
        
        Args:
            tentativas: Número máximo de tentativas
            delay_inicial: Tempo inicial de espera (em segundos)
            fator_backoff: Multiplicador para aumentar o tempo de espera
        """
        def decorador(funcao):
            @wraps(funcao)
            def wrapper(*args, **kwargs):
                delay = delay_inicial
                ultima_excecao = None
                
                for tentativa in range(1, tentativas + 1):
                    try:
                        return funcao(*args, **kwargs)
                    except Exception as e:
                        print(f"Tentativa {tentativa}/{tentativas} falhou: {str(e)}")
                        ultima_excecao = e
                        
                        if tentativa < tentativas:
                            tempo_espera = delay * (0.5 + random.random())  # Jitter
                            print(f"Esperando {tempo_espera:.2f} segundos antes da próxima tentativa")
                            time.sleep(tempo_espera)
                            delay *= fator_backoff
                
                # Se chegou aqui, todas as tentativas falharam
                raise ultima_excecao
                
            return wrapper
        return decorador
    
    # Simulando uma função instável
    @retry(tentativas=4, delay_inicial=0.5, fator_backoff=2)
    def operacao_instavel(chance_falha=0.7):
        """Simula uma operação que falha aleatoriamente."""
        if random.random() < chance_falha:
            raise ConnectionError("Falha na conexão")
        return "Operação bem-sucedida"
    
    # Testando a função
    try:
        resultado = operacao_instavel()
        print(resultado)
    except ConnectionError as e:
        print(f"Falha final: {e}")
    ```

=== "Injeção de Dependência"
    ```python
    from functools import wraps
    
    def injetar(**dependencias):
        """
        Injeta dependências como argumentos nomeados em uma função.
        
        Exemplo:
            @injetar(db=obter_conexao_db, logger=obter_logger)
            def minha_funcao(x, y, db=None, logger=None):
                ...
        """
        def decorador(funcao):
            @wraps(funcao)
            def wrapper(*args, **kwargs):
                # Para cada dependência especificada
                for nome, provedor in dependencias.items():
                    # Se o argumento não foi fornecido explicitamente
                    if nome not in kwargs:
                        # Injeta o valor resolvido da dependência
                        kwargs[nome] = provedor() if callable(provedor) else provedor
                return funcao(*args, **kwargs)
            return wrapper
        return decorador
    
    # Simulando provedores de dependência
    def obter_logger():
        class Logger:
            def info(self, msg): print(f"INFO: {msg}")
            def error(self, msg): print(f"ERROR: {msg}")
        return Logger()
    
    def obter_config():
        return {"timeout": 30, "retry": True}
    
    # Usando o decorador
    @injetar(logger=obter_logger, config=obter_config)
    def processar_dados(dados, logger=None, config=None):
        """Processa dados usando as dependências injetadas."""
        logger.info(f"Processando {len(dados)} itens")
        timeout = config.get("timeout", 10)
        logger.info(f"Timeout configurado: {timeout}")
        # ... lógica de processamento ...
        return len(dados)
    
    # Chamando a função sem fornecer as dependências
    resultado = processar_dados([1, 2, 3, 4, 5])
    print(f"Resultado: {resultado}")
    
    # Chamando e substituindo uma dependência
    class MeuLogger:
        def info(self, msg): print(f">> {msg}")
        def error(self, msg): print(f"!! {msg}")
        
    resultado = processar_dados([1, 2, 3], logger=MeuLogger())
    ```

## Decoradores em Frameworks e Bibliotecas

Os decoradores são amplamente utilizados em frameworks e bibliotecas Python.

=== "Flask (Web Framework)"
    ```python
    # Em Flask, decoradores são usados para definir rotas
    from flask import Flask

    app = Flask(__name__)

    @app.route('/')
    def home():
        return 'Página inicial'
        
    @app.route('/usuario/<nome>')
    def perfil(nome):
        return f'Perfil de {nome}'
        
    @app.route('/api/dados', methods=['GET', 'POST'])
    def api_dados():
        return {'status': 'sucesso'}
    
    if __name__ == '__main__':
        app.run(debug=True)
    ```

=== "Django (Web Framework)"
    ```python
    # Em Django, decoradores são usados para muitas coisas
    from django.shortcuts import render
    from django.contrib.auth.decorators import login_required
    from django.views.decorators.http import require_http_methods
    
    # Requer autenticação
    @login_required
    def perfil(request):
        return render(request, 'perfil.html')
    
    # Restringe métodos HTTP
    @require_http_methods(["GET", "POST"])
    def contato(request):
        if request.method == "POST":
            # Processa o formulário
            return render(request, 'obrigado.html')
        return render(request, 'contato.html')
    ```

=== "Pytest (Framework de Teste)"
    ```python
    # Pytest usa decoradores para marcar testes
    import pytest
    
    # Marca este teste para pular
    @pytest.mark.skip(reason="Funcionalidade ainda não implementada")
    def test_futura_funcionalidade():
        assert False
    
    # Marca que este teste deve falhar
    @pytest.mark.xfail
    def test_bug_conhecido():
        assert 1 == 2
    
    # Parametrização de testes
    @pytest.mark.parametrize("entrada,esperado", [
        (1, 1),
        (2, 4),
        (3, 9),
        (4, 16),
    ])
    def test_quadrado(entrada, esperado):
        assert entrada ** 2 == esperado
    ```

=== "Click (CLI)"
    ```python
    # Click usa decoradores para criar interfaces de linha de comando
    import click
    
    @click.group()
    def cli():
        """Ferramenta de linha de comando de exemplo."""
        pass
    
    @cli.command()
    @click.argument('nome')
    @click.option('--saudacao', '-s', default='Olá')
    def cumprimentar(nome, saudacao):
        """Cumprimenta alguém."""
        click.echo(f"{saudacao}, {nome}!")
    
    @cli.command()
    @click.argument('x', type=int)
    @click.argument('y', type=int)
    def somar(x, y):
        """Soma dois números."""
        resultado = x + y
        click.echo(f"{x} + {y} = {resultado}")
    
    if __name__ == '__main__':
        cli()
    ```

## Boas Práticas com Decoradores

=== "Design e Reusabilidade"
    ```python
    # Boas práticas para decoradores
    
    # 1. Sempre use functools.wraps
    from functools import wraps
    
    def meu_decorador(funcao):
        @wraps(funcao)  # Preserva os metadados
        def wrapper(*args, **kwargs):
            return funcao(*args, **kwargs)
        return wrapper
    
    # 2. Aceite *args e **kwargs para maior flexibilidade
    def decorador_flexivel(funcao):
        @wraps(funcao)
        def wrapper(*args, **kwargs):  # Aceita qualquer argumento
            return funcao(*args, **kwargs)
        return wrapper
    
    # 3. Faça decoradores combinados para evitar repetição
    def combinar_decoradores(*decoradores):
        def decorador_combinado(funcao):
            for decorador in reversed(decoradores):  # Aplica na ordem correta
                funcao = decorador(funcao)
            return funcao
        return decorador_combinado
    
    # Uso:
    @combinar_decoradores(decorador1, decorador2, decorador3)
    def minha_funcao():
        pass
    ```

=== "Tratamento de Erros"
    ```python
    from functools import wraps
    
    def decorador_seguro(funcao):
        """Decorador que captura exceções e fornece feedback útil."""
        @wraps(funcao)
        def wrapper(*args, **kwargs):
            try:
                return funcao(*args, **kwargs)
            except Exception as e:
                print(f"Erro ao executar {funcao.__name__}: {e}")
                # Decide se relança a exceção ou retorna um valor padrão
                # Aqui decidimos relançar
                raise
        return wrapper
    
    @decorador_seguro
    def divisao(a, b):
        return a / b
    
    # Teste
    try:
        resultado = divisao(10, 0)
    except ZeroDivisionError:
        print("Capturei a exceção relançada")
    ```

=== "Documentação Efetiva"
    ```python
    def registrar(funcao):
        """
        Decorador que registra chamadas de função.
        
        Args:
            funcao: A função a ser decorada.
            
        Returns:
            Uma função wrapper que registra a chamada e executa a função original.
            
        Exemplo:
            @registrar
            def minha_funcao(x, y):
                return x + y
        """
        @wraps(funcao)
        def wrapper(*args, **kwargs):
            """
            Wrapper que registra a chamada da função decorada.
            
            Args:
                *args: Argumentos posicionais para a função original.
                **kwargs: Argumentos nomeados para a função original.
                
            Returns:
                O resultado da função original.
            """
            print(f"Chamando {funcao.__name__} com {args} e {kwargs}")
            return funcao(*args, **kwargs)
        return wrapper
    
    # A documentação tanto do decorador quanto do wrapper fica disponível
    help(registrar)
    
    @registrar
    def soma(a, b):
        """Soma dois números."""
        return a + b
        
    # A documentação original da função é preservada graças ao @wraps
    help(soma)
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Conceitos básicos** de decoradores em Python
- Como **criar e aplicar** decoradores em funções
- A importância do **functools.wraps** para preservar metadados
- Como implementar **decoradores com argumentos**
- **Encadeamento** de múltiplos decoradores
- **Decoradores de classe** e classes como decoradores
- **Decoradores especiais** como `@property`, `@classmethod` e `@lru_cache`
- **Casos de uso comuns** para decoradores
- Como decoradores são usados em **frameworks populares**
- **Boas práticas** para criar e usar decoradores

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre decoradores](https://docs.python.org/3/glossary.html#term-decorator){:target="_blank"}
    - [PEP 318 - Decoradores para Funções e Métodos](https://peps.python.org/pep-0318/){:target="_blank"}
    - [Documentação do módulo functools](https://docs.python.org/3/library/functools.html){:target="_blank"}
    - [Real Python: Decoradores em Python](https://realpython.com/primer-on-python-decorators/){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos Programação Orientada a Objetos em Python, um paradigma fundamental para organizar código em aplicações complexas.

[Avance para a próxima aula →](/docs/trilhas/python/page-13)

[← Voltar para Iteradores e Geradores](/docs/trilhas/python/page-11)