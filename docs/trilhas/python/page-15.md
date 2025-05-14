# Testes em Python

## Introdução

Testes são uma parte essencial do desenvolvimento de software, permitindo verificar se o código funciona como esperado, identificar bugs precocemente e facilitar refatorações seguras. Em Python, existem diversas ferramentas e técnicas para escrever e executar testes, desde testes unitários simples até frameworks completos de automação de testes.

!!! info "Objetivos de Aprendizado"
    - Compreender a importância dos testes em desenvolvimento de software
    - Aprender a escrever testes unitários com pytest e unittest
    - Entender os conceitos de fixtures, mocks e stubs
    - Explorar técnicas de Test-Driven Development (TDD)
    - Conhecer boas práticas para escrever testes eficazes
    - Implementar testes de integração e testes funcionais

## Importância dos Testes

Os testes de software oferecem diversos benefícios:

- **Detecção precoce de bugs**: Identificar problemas antes que cheguem ao ambiente de produção
- **Documentação viva**: Testes bem escritos servem como documentação sobre como o código deve funcionar
- **Facilitar refatoração**: Alterar o código com confiança, sabendo que os testes detectarão quebras
- **Melhorar design**: Código testável geralmente tem melhor design, com baixo acoplamento
- **Reduzir débito técnico**: Testes ajudam a manter a qualidade do código ao longo do tempo

## Tipos de Testes

=== "Testes Unitários"
    ```python
    # Testes unitários verificam o comportamento de unidades individuais de código
    
    # Função a ser testada
    def calcular_desconto(valor, percentual):
        """Calcula desconto baseado em um percentual."""
        if percentual < 0 or percentual > 100:
            raise ValueError("Percentual deve estar entre 0 e 100")
        
        return valor * (percentual / 100)
    
    # Teste unitário usando pytest
    def test_calcular_desconto():
        # Casos normais
        assert calcular_desconto(100, 10) == 10.0
        assert calcular_desconto(200, 5) == 10.0
        assert calcular_desconto(100, 0) == 0.0
        
        # Valor Zero
        assert calcular_desconto(0, 10) == 0.0
        
        # Casos de erro
        import pytest
        with pytest.raises(ValueError):
            calcular_desconto(100, -10)
        
        with pytest.raises(ValueError):
            calcular_desconto(100, 110)
    
    # Para executar: pytest nome_do_arquivo.py
    ```

=== "Testes de Integração"
    ```python
    # Testes de integração verificam como componentes funcionam juntos
    
    # Exemplo: Sistema de autenticação e banco de dados
    class BancoDados:
        def __init__(self):
            self.usuarios = {}
        
        def salvar_usuario(self, usuario_id, dados):
            self.usuarios[usuario_id] = dados
            return True
        
        def buscar_usuario(self, usuario_id):
            return self.usuarios.get(usuario_id)
    
    class Autenticacao:
        def __init__(self, banco_dados):
            self.banco_dados = banco_dados
        
        def registrar(self, usuario_id, senha):
            # Simulação de hash
            senha_hash = senha + "_hash"
            return self.banco_dados.salvar_usuario(usuario_id, {
                'senha_hash': senha_hash,
                'tentativas': 0
            })
        
        def autenticar(self, usuario_id, senha):
            dados = self.banco_dados.buscar_usuario(usuario_id)
            if not dados:
                return False
                
            senha_hash = senha + "_hash"
            if dados['senha_hash'] == senha_hash:
                dados['tentativas'] = 0
                self.banco_dados.salvar_usuario(usuario_id, dados)
                return True
            else:
                dados['tentativas'] += 1
                self.banco_dados.salvar_usuario(usuario_id, dados)
                return False
    
    # Teste de integração
    def test_integracao_autenticacao_banco():
        # Setup
        db = BancoDados()
        auth = Autenticacao(db)
        
        # Registro de usuário
        assert auth.registrar("user1", "senha123")
        
        # Autenticação bem-sucedida
        assert auth.autenticar("user1", "senha123")
        
        # Autenticação falha
        assert not auth.autenticar("user1", "senha_errada")
        
        # Verificar tentativas após falha
        assert db.buscar_usuario("user1")['tentativas'] == 1
    ```

=== "Testes Funcionais"
    ```python
    # Testes funcionais verificam se o sistema funciona de acordo com os requisitos
    
    # Exemplo: API de calculadora
    class CalculadoraAPI:
        def somar(self, a, b):
            return a + b
        
        def subtrair(self, a, b):
            return a - b
        
        def multiplicar(self, a, b):
            return a * b
        
        def dividir(self, a, b):
            if b == 0:
                raise ValueError("Divisão por zero não permitida")
            return a / b
    
    # Teste funcional
    def test_funcional_calculadora():
        calc_api = CalculadoraAPI()
        
        # Teste do fluxo completo
        num1 = 10
        num2 = 5
        
        # Soma dois números
        resultado = calc_api.somar(num1, num2)
        assert resultado == 15
        
        # Subtrai o segundo do resultado
        resultado = calc_api.subtrair(resultado, num2)
        assert resultado == 10
        
        # Multiplica por 2
        resultado = calc_api.multiplicar(resultado, 2)
        assert resultado == 20
        
        # Divide por 4
        resultado = calc_api.dividir(resultado, 4)
        assert resultado == 5
        
        # Verifica erro de divisão por zero
        import pytest
        with pytest.raises(ValueError):
            calc_api.dividir(resultado, 0)
    ```

## Introdução ao pytest

O pytest é um dos frameworks de teste mais populares em Python, com sintaxe simples e recursos poderosos.

=== "Instalação e Configuração"
    ```python
    # Instalação via pip
    # pip install pytest
    
    # Criando arquivo de teste
    # Os arquivos devem seguir o padrão test_*.py ou *_test.py
    
    # Exemplo de arquivo test_exemplo.py:
    def soma(a, b):
        return a + b
    
    def test_soma():
        assert soma(1, 2) == 3
        assert soma(0, 0) == 0
        assert soma(-1, 1) == 0
    
    # Para executar:
    # pytest test_exemplo.py
    
    # Executar com detalhes:
    # pytest test_exemplo.py -v
    
    # Executar em modo de falha rápida (para ao primeiro erro):
    # pytest test_exemplo.py -xvs
    ```

=== "Asserções em pytest"
    ```python
    def test_assetrcoes_basicas():
        # Comparações básicas
        assert 1 + 1 == 2
        assert 3 - 1 != 1
        assert "abc" == "abc"
        
        # Operadores de comparação
        assert 5 > 3
        assert 5 >= 5
        assert 3 < 5
        assert 3 <= 5
        
        # Verificação de verdadeiro/falso
        assert True
        assert not False
        
        # Verificação de identidade (is / is not)
        x = [1, 2, 3]
        y = x  # Mesma referência
        z = [1, 2, 3]  # Referência diferente, mesmo conteúdo
        
        assert x is y
        assert x is not z
        
        # Verificação de conteúdo (in / not in)
        assert 2 in x
        assert 5 not in x
        assert "a" in "abc"
        
        # Verificação de exceções
        import pytest
        with pytest.raises(ZeroDivisionError):
            1 / 0
        
        # Verificação de substrings
        assert "python" in "Python é uma linguagem".lower()
    
    # Quando um teste falha, pytest mostra uma explicação detalhada
    def test_assetrcao_falha():
        a = 5
        b = 10
        assert a > b, f"Esperado que {a} fosse maior que {b}"
        # Falha com: AssertionError: Esperado que 5 fosse maior que 10
    ```

=== "Fixtures"
    ```python
    import pytest
    
    # Fixtures são funções que fornecem dados ou estado para testes
    
    @pytest.fixture
    def usuario_exemplo():
        """Retorna um dicionário de usuário para testes."""
        return {
            'id': 1,
            'nome': 'João Silva',
            'email': 'joao@exemplo.com',
            'ativo': True
        }
    
    @pytest.fixture
    def banco_dados_teste():
        """Cria um banco de dados temporário para testes."""
        # Setup - preparação antes do teste
        db = {'usuarios': {}}
        
        # Retorna o banco para o teste usar
        yield db
        
        # Teardown - limpeza após o teste
        db.clear()
    
    # Usando as fixtures nos testes
    def test_usuario_ativo(usuario_exemplo):
        assert usuario_exemplo['ativo'] is True
    
    def test_adicionar_usuario(banco_dados_teste, usuario_exemplo):
        # Adiciona um usuário
        banco_dados_teste['usuarios'][usuario_exemplo['id']] = usuario_exemplo
        
        # Verifica se foi adicionado
        assert len(banco_dados_teste['usuarios']) == 1
        assert banco_dados_teste['usuarios'][1]['nome'] == 'João Silva'
    
    # Fixtures com escopo
    @pytest.fixture(scope="module")
    def conexao_banco():
        """Uma conexão de banco que dura todo o módulo de teste."""
        print("\nAbrindo conexão com o banco...")
        conexao = {"status": "conectado"}
        
        yield conexao
        
        print("\nFechando conexão com o banco...")
        conexao["status"] = "desconectado"
    
    def test_consulta_1(conexao_banco):
        assert conexao_banco["status"] == "conectado"
        print("Executando consulta 1")
    
    def test_consulta_2(conexao_banco):
        assert conexao_banco["status"] == "conectado"
        print("Executando consulta 2")
    ```

=== "Parametrização de Testes"
    ```python
    import pytest
    
    # Função para verificar se um número é primo
    def is_primo(n):
        """Verifica se um número é primo."""
        if n <= 1:
            return False
        if n <= 3:
            return True
        if n % 2 == 0 or n % 3 == 0:
            return False
        
        i = 5
        while i * i <= n:
            if n % i == 0 or n % (i + 2) == 0:
                return False
            i += 6
            
        return True
    
    # Teste parametrizado
    @pytest.mark.parametrize("numero,esperado", [
        (1, False),    # 1 não é primo
        (2, True),     # 2 é primo
        (3, True),     # 3 é primo
        (4, False),    # 4 não é primo
        (5, True),     # 5 é primo
        (9, False),    # 9 não é primo
        (11, True),    # 11 é primo
        (15, False),   # 15 não é primo
        (17, True),    # 17 é primo
        (25, False),   # 25 não é primo
        (97, True),    # 97 é primo
    ])
    def test_is_primo(numero, esperado):
        assert is_primo(numero) == esperado
    
    # Parametrização com IDs
    @pytest.mark.parametrize("entrada,esperado", [
        ("python", "PYTHON"),
        ("abc", "ABC"),
        ("123", "123"),
        ("", ""),
    ], ids=["palavra", "letras", "numeros", "vazio"])
    def test_maiusculo(entrada, esperado):
        assert entrada.upper() == esperado
    
    # Multiplos parâmetros
    @pytest.mark.parametrize("x", [1, 2])
    @pytest.mark.parametrize("y", [3, 4])
    def test_multiplicacao(x, y):
        # Vai executar para todas as combinações: (1,3), (1,4), (2,3), (2,4)
        print(f"Testando {x} * {y}")
        assert x * y == x * y
    ```

## Mocks e Patching

Mocks são objetos que simulam o comportamento de objetos reais de forma controlada, permitindo testar código que depende de componentes externos como APIs, bancos de dados ou funções complexas.

=== "Usando unittest.mock"
    ```python
    from unittest import mock
    import requests
    
    # Função que usa uma API externa
    def buscar_usuario(id):
        """Busca um usuário em uma API externa pelo ID."""
        response = requests.get(f"https://api.exemplo.com/usuarios/{id}")
        if response.status_code == 200:
            return response.json()
        return None
    
    # Função para exibir informações do usuário
    def exibir_nome_usuario(id):
        usuario = buscar_usuario(id)
        if usuario:
            return f"Nome: {usuario['nome']}"
        return "Usuário não encontrado"
    
    # Testando com mock
    def test_exibir_nome_usuario():
        # Cria um mock para substituir a função buscar_usuario
        with mock.patch('__main__.buscar_usuario') as mock_buscar:
            # Configura o comportamento do mock
            mock_buscar.return_value = {'id': 1, 'nome': 'Ana Silva'}
            
            # Testa a função que usa a função mockada
            resultado = exibir_nome_usuario(1)
            assert resultado == "Nome: Ana Silva"
            
            # Verifica se o mock foi chamado corretamente
            mock_buscar.assert_called_once_with(1)
        
        # Mock com retorno diferente
        with mock.patch('__main__.buscar_usuario') as mock_buscar:
            mock_buscar.return_value = None
            
            resultado = exibir_nome_usuario(999)
            assert resultado == "Usuário não encontrado"
    ```

=== "Mockando Dependências"
    ```python
    import pytest
    from unittest import mock
    import requests
    
    # Classe que depende de requests para buscar dados
    class ClienteAPI:
        def __init__(self, base_url):
            self.base_url = base_url
        
        def obter_usuario(self, id):
            url = f"{self.base_url}/usuarios/{id}"
            response = requests.get(url)
            response.raise_for_status()  # Lança exceção para status codes de erro
            return response.json()
        
        def criar_usuario(self, nome, email):
            url = f"{self.base_url}/usuarios"
            data = {"nome": nome, "email": email}
            response = requests.post(url, json=data)
            response.raise_for_status()
            return response.json()
    
    # Teste com mock
    def test_obter_usuario():
        cliente = ClienteAPI("https://api.exemplo.com")
        
        # Criar um objeto mock que simula a resposta de requests.get
        mock_resposta = mock.Mock()
        mock_resposta.json.return_value = {"id": 1, "nome": "João", "email": "joao@exemplo.com"}
        mock_resposta.raise_for_status.return_value = None
        
        # Usa patch para substituir requests.get pelo mock
        with mock.patch('requests.get', return_value=mock_resposta) as mock_get:
            # Chama o método que usa requests.get
            resultado = cliente.obter_usuario(1)
            
            # Verifica se requests.get foi chamado com a URL correta
            mock_get.assert_called_once_with("https://api.exemplo.com/usuarios/1")
            
            # Verifica se o resultado está correto
            assert resultado == {"id": 1, "nome": "João", "email": "joao@exemplo.com"}
    
    # Usando pytest.fixture para reutilizar mocks
    @pytest.fixture
    def mock_requests():
        with mock.patch('requests.get') as mock_get, \
             mock.patch('requests.post') as mock_post:
            
            # Configura o comportamento padrão
            mock_response = mock.Mock()
            mock_response.json.return_value = {}
            mock_response.raise_for_status.return_value = None
            
            mock_get.return_value = mock_response
            mock_post.return_value = mock_response
            
            yield {
                'get': mock_get,
                'post': mock_post,
                'response': mock_response
            }
    
    def test_criar_usuario(mock_requests):
        cliente = ClienteAPI("https://api.exemplo.com")
        
        # Configura o mock para este teste específico
        mock_requests['response'].json.return_value = {
            "id": 2,
            "nome": "Maria",
            "email": "maria@exemplo.com"
        }
        
        # Executa o método a ser testado
        resultado = cliente.criar_usuario("Maria", "maria@exemplo.com")
        
        # Verifica se requests.post foi chamado corretamente
        mock_requests['post'].assert_called_once_with(
            "https://api.exemplo.com/usuarios",
            json={"nome": "Maria", "email": "maria@exemplo.com"}
        )
        
        # Verifica o resultado
        assert resultado["nome"] == "Maria"
        assert resultado["email"] == "maria@exemplo.com"
    ```

=== "Simulando Exceções"
    ```python
    from unittest import mock
    import requests
    import pytest
    
    # Função que lida com erros de API
    def buscar_dados_seguros(url):
        """Busca dados e lida com erros de forma segura."""
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            return {"erro": "Tempo esgotado"}
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return {"erro": "Recurso não encontrado"}
            return {"erro": f"Erro HTTP: {e.response.status_code}"}
        except Exception as e:
            return {"erro": f"Erro desconhecido: {str(e)}"}
    
    # Testando diferentes cenários de erro
    def test_buscar_dados_timeout():
        with mock.patch('requests.get') as mock_get:
            # Simula um timeout
            mock_get.side_effect = requests.exceptions.Timeout("Tempo esgotado")
            
            resultado = buscar_dados_seguros("https://api.exemplo.com/dados")
            assert resultado == {"erro": "Tempo esgotado"}
    
    def test_buscar_dados_404():
        with mock.patch('requests.get') as mock_get:
            # Cria um mock para a resposta e a exceção
            mock_response = mock.Mock()
            mock_response.status_code = 404
            
            # Cria a exceção com a resposta mockada
            mock_erro = requests.exceptions.HTTPError("404 Not Found")
            mock_erro.response = mock_response
            
            # Faz o mock.get lançar a exceção quando chamado
            mock_get.side_effect = mock_erro
            
            resultado = buscar_dados_seguros("https://api.exemplo.com/dados")
            assert resultado == {"erro": "Recurso não encontrado"}
    
    def test_buscar_dados_sucesso():
        with mock.patch('requests.get') as mock_get:
            # Simula uma resposta bem-sucedida
            mock_response = mock.Mock()
            mock_response.json.return_value = {"nome": "Teste", "valor": 42}
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            resultado = buscar_dados_seguros("https://api.exemplo.com/dados")
            assert resultado == {"nome": "Teste", "valor": 42}
    ```

=== "Mock Spy"
    ```python
    from unittest.mock import Mock, patch, call
    
    # Classe para ser "espiada"
    class Calculadora:
        def somar(self, a, b):
            return a + b
        
        def operacao_complexa(self, x, y, z):
            # Chamamos somar internamente
            resultado = self.somar(x, y)
            return resultado * z
    
    # Teste usando spy (observando chamadas de método reais)
    def test_spy_metodo():
        calculadora = Calculadora()
        
        # Substitui o método somar por um spy
        # Isso permite monitorar chamadas, mas ainda executar o método original
        with patch.object(calculadora, 'somar', wraps=calculadora.somar) as spy_somar:
            # Chamamos o método que usa somar internamente
            resultado = calculadora.operacao_complexa(3, 4, 2)
            
            # Verificamos se o resultado está correto
            assert resultado == 14  # (3 + 4) * 2
            
            # Verificamos se o método somar foi chamado corretamente
            spy_somar.assert_called_once_with(3, 4)
        
        # Espionando múltiplas chamadas
        with patch.object(calculadora, 'somar', wraps=calculadora.somar) as spy_somar:
            calculadora.somar(1, 2)
            calculadora.somar(3, 4)
            calculadora.somar(5, 6)
            
            # Verificando todas as chamadas
            assert spy_somar.call_count == 3
            
            # Verificando argumentos de cada chamada
            expected_calls = [call(1, 2), call(3, 4), call(5, 6)]
            assert spy_somar.call_args_list == expected_calls
    ```

## Testes em Frameworks Web

Python é muito usado para desenvolvimento web, e os frameworks possuem ferramentas específicas para testes.

=== "Testes com Flask"
    ```python
    import pytest
    from flask import Flask, jsonify, request

    # Aplicação Flask simples
    app = Flask(__name__)

    # Banco de dados "fake" para o exemplo
    TAREFAS = {
        1: {"id": 1, "titulo": "Estudar Python", "concluida": False},
        2: {"id": 2, "titulo": "Fazer exercícios", "concluida": True}
    }

    @app.route('/tarefas', methods=['GET'])
    def listar_tarefas():
        return jsonify(list(TAREFAS.values()))

    @app.route('/tarefas/<int:tarefa_id>', methods=['GET'])
    def obter_tarefa(tarefa_id):
        if tarefa_id not in TAREFAS:
            return jsonify({"erro": "Tarefa não encontrada"}), 404
        return jsonify(TAREFAS[tarefa_id])

    @app.route('/tarefas', methods=['POST'])
    def criar_tarefa():
        dados = request.json
        if not dados ou 'titulo' not in dados:
            return jsonify({"erro": "Título é obrigatório"}), 400
            
        novo_id = max(TAREFAS.keys(), default=0) + 1
        nova_tarefa = {
            "id": novo_id,
            "titulo": dados["titulo"],
            "concluida": dados.get("concluida", False)
        }
        TAREFAS[novo_id] = nova_tarefa
        return jsonify(nova_tarefa), 201

    # Fixture para criar um cliente de teste
    @pytest.fixture
    def cliente():
        # Configura a aplicação para testes
        app.config['TESTING'] = True
        with app.test_client() as cliente:
            yield cliente

    # Fixture para garantir que os dados de teste sejam consistentes
    @pytest.fixture
    def banco_reset():
        # Salva o estado original
        original = TAREFAS.copy()
        yield
        # Restaura o estado original após o teste
        TAREFAS.clear()
        TAREFAS.update(original)

    # Testes para as rotas
    def test_listar_tarefas(cliente, banco_reset):
        resposta = cliente.get('/tarefas')
        dados = resposta.get_json()
        
        assert resposta.status_code == 200
        assert len(dados) == 2
        assert dados[0]["titulo"] == "Estudar Python"
        assert dados[1]["titulo"] == "Fazer exercícios"

    def test_obter_tarefa_existente(cliente, banco_reset):
        resposta = cliente.get('/tarefas/1')
        dados = resposta.get_json()
        
        assert resposta.status_code == 200
        assert dados["id"] == 1
        assert dados["titulo"] == "Estudar Python"

    def test_obter_tarefa_inexistente(cliente, banco_reset):
        resposta = cliente.get('/tarefas/999')
        dados = resposta.get_json()
        
        assert resposta.status_code == 404
        assert "erro" in dados

    def test_criar_tarefa(cliente, banco_reset):
        nova_tarefa = {"titulo": "Nova Tarefa", "concluida": True}
        resposta = cliente.post('/tarefas', json=nova_tarefa)
        dados = resposta.get_json()
        
        assert resposta.status_code == 201
        assert dados["titulo"] == "Nova Tarefa"
        assert dados["concluida"] is True
        assert "id" in dados
        
        # Verifica se a tarefa foi realmente adicionada
        resposta_lista = cliente.get('/tarefas')
        todas_tarefas = resposta_lista.get_json()
        assert len(todas_tarefas) == 3
    ```

=== "Testes com Django"
    ```python
    # Django usa seu próprio framework de teste baseado em unittest
    
    # models.py
    from django.db import models
    
    class Produto(models.Model):
        nome = models.CharField(max_length=100)
        preco = models.DecimalField(max_digits=10, decimal_places=2)
        estoque = models.IntegerField(default=0)
        
        def esta_disponivel(self):
            return self.estoque > 0
        
        def __str__(self):
            return self.nome
    
    # views.py
    from django.shortcuts import get_object_or_404
    from django.http import JsonResponse
    from .models import Produto
    
    def listar_produtos(request):
        produtos = Produto.objects.all()
        dados = [{"id": p.id, "nome": p.nome, "preco": p.preco} for p in produtos]
        return JsonResponse(dados, safe=False)
    
    def detalhe_produto(request, produto_id):
        produto = get_object_or_404(Produto, pk=produto_id)
        return JsonResponse({
            "id": produto.id,
            "nome": produto.nome,
            "preco": float(produto.preco),
            "estoque": produto.estoque,
            "disponivel": produto.esta_disponivel()
        })
    
    # tests.py
    from django.test import TestCase, Client
    from django.urls import reverse
    from .models import Produto
    import json
    
    class ProdutoModelTest(TestCase):
        def setUp(self):
            # Este método é executado antes de cada teste
            Produto.objects.create(nome="Laptop", preco="1999.99", estoque=10)
            Produto.objects.create(nome="Teclado", preco="99.99", estoque=0)
        
        def test_produto_disponibilidade(self):
            """Testa o método esta_disponivel()"""
            laptop = Produto.objects.get(nome="Laptop")
            teclado = Produto.objects.get(nome="Teclado")
            
            self.assertTrue(laptop.esta_disponivel())
            self.assertFalse(teclado.esta_disponivel())
        
        def test_produto_string(self):
            """Testa a representação de string do produto"""
            laptop = Produto.objects.get(nome="Laptop")
            self.assertEqual(str(laptop), "Laptop")
    
    class ProdutoViewsTest(TestCase):
        def setUp(self):
            self.client = Client()
            Produto.objects.create(nome="Laptop", preco="1999.99", estoque=10)
            Produto.objects.create(nome="Teclado", preco="99.99", estoque=0)
        
        def test_listar_produtos(self):
            """Testa a view de listar produtos"""
            url = reverse('listar_produtos')  # Usa as URLs nomeadas
            response = self.client.get(url)
            
            self.assertEqual(response.status_code, 200)
            
            data = json.loads(response.content)
            self.assertEqual(len(data), 2)
        
        def test_detalhe_produto(self):
            """Testa a view de detalhe do produto"""
            laptop = Produto.objects.get(nome="Laptop")
            url = reverse('detalhe_produto', args=[laptop.id])
            response = self.client.get(url)
            
            self.assertEqual(response.status_code, 200)
            
            data = json.loads(response.content)
            self.assertEqual(data['nome'], "Laptop")
            self.assertEqual(data['preco'], 1999.99)
            self.assertEqual(data['estoque'], 10)
            self.assertTrue(data['disponivel'])
        
        def test_produto_nao_encontrado(self):
            """Testa a resposta para um produto que não existe"""
            url = reverse('detalhe_produto', args=[999])
            response = self.client.get(url)
            
            self.assertEqual(response.status_code, 404)
    ```

## Test-Driven Development (TDD)

O TDD é uma abordagem de desenvolvimento em que você escreve testes antes de implementar o código.

=== "Ciclo TDD"
    ```python
    # O ciclo TDD consiste em: Red -> Green -> Refactor
    
    # 1. RED: Escreva um teste que falha
    # Arquivo: test_calculadora.py
    def test_divisao():
        from calculadora import dividir
        assert dividir(10, 2) == 5
        assert dividir(8, 4) == 2
        assert dividir(5, 2) == 2.5
        
        # Verifica se lança a exceção correta
        import pytest
        with pytest.raises(ValueError, match="Divisão por zero"):
            dividir(10, 0)
    
    # Se executarmos agora: pytest test_calculadora.py
    # O teste falhará porque a função dividir não existe
    
    # 2. GREEN: Implementar o código mínimo para passar no teste
    # Arquivo: calculadora.py
    def dividir(a, b):
        if b == 0:
            raise ValueError("Divisão por zero")
        return a / b
    
    # Agora o teste passará
    
    # 3. REFACTOR: Melhorar o código mantendo os testes passando
    # Arquivo: calculadora.py
    def dividir(a, b):
        """
        Divide dois números.
        
        Args:
            a: Numerador
            b: Denominador
            
        Returns:
            O resultado da divisão a/b
            
        Raises:
            ValueError: Se b for zero
        """
        if b == 0:
            raise ValueError("Divisão por zero")
        return a / b
    
    # Repetir o ciclo para cada nova funcionalidade
    ```

=== "Exemplo Prático: Validador de Senhas"
    ```python
    # Vamos implementar um validador de senhas usando TDD
    
    # Requisitos:
    # 1. A senha deve ter pelo menos 8 caracteres
    # 2. A senha deve conter pelo menos uma letra maiúscula
    # 3. A senha deve conter pelo menos um número
    # 4. A senha deve conter pelo menos um caractere especial
    
    # Passo 1: Escrever o teste
    # Arquivo: test_validador_senha.py
    
    import pytest
    
    def test_validador_senha():
        from validador_senha import validar_senha
        
        # Senhas válidas
        assert validar_senha("Abc123!@") == True
        assert validar_senha("Senha123!") == True
        
        # Senha curta
        assert validar_senha("Ab1!") == False
        
        # Sem letra maiúscula
        assert validar_senha("abc123!@") == False
        
        # Sem número
        assert validar_senha("Abcdef!@") == False
        
        # Sem caractere especial
        assert validar_senha("Abcde123") == False
    
    # Passo 2: Implementar o código mínimo para passar
    # Arquivo: validador_senha.py
    
    def validar_senha(senha):
        # Verifica o tamanho mínimo
        if len(senha) < 8:
            return False
        
        # Verifica se tem pelo menos uma letra maiúscula
        if not any(c.isupper() for c in senha):
            return False
        
        # Verifica se tem pelo menos um número
        if not any(c.isdigit() for c in senha):
            return False
        
        # Verifica se tem pelo menos um caractere especial
        caracteres_especiais = "!@#$%^&*()-_=+[]{}|;:'\",.<>/?`~"
        if not any(c in caracteres_especiais for c in senha):
            return False
        
        return True
    
    # Passo 3: Refatorar
    # Arquivo: validador_senha.py
    
    def validar_senha(senha):
        """
        Valida uma senha de acordo com os seguintes critérios:
        - Pelo menos 8 caracteres
        - Pelo menos uma letra maiúscula
        - Pelo menos um número
        - Pelo menos um caractere especial
        
        Args:
            senha: A senha a ser validada
            
        Returns:
            bool: True se a senha é válida, False caso contrário
        """
        if len(senha) < 8:
            return False
            
        tem_maiuscula = False
        tem_numero = False
        tem_especial = False
        caracteres_especiais = "!@#$%^&*()-_=+[]{}|;:'\",.<>/?`~"
        
        for c in senha:
            if c.isupper():
                tem_maiuscula = True
            if c.isdigit():
                tem_numero = True
            if c in caracteres_especiais:
                tem_especial = True
        
        return tem_maiuscula and tem_numero and tem_especial
    
    # Ou uma versão mais limpa usando funções mais específicas
    
    def validar_senha(senha):
        """Valida uma senha de acordo com os critérios de segurança."""
        return (len(senha) >= 8 and
                contem_maiuscula(senha) and
                contem_numero(senha) and
                contem_especial(senha))
    
    def contem_maiuscula(senha):
        """Verifica se a senha contém pelo menos uma letra maiúscula."""
        return any(c.isupper() for c in senha)
    
    def contem_numero(senha):
        """Verifica se a senha contém pelo menos um número."""
        return any(c.isdigit() for c in senha)
    
    def contem_especial(senha):
        """Verifica se a senha contém pelo menos um caractere especial."""
        caracteres_especiais = "!@#$%^&*()-_=+[]{}|;:'\",.<>/?`~"
        return any(c in caracteres_especiais for c in senha)
    ```

## Cobertura de Testes

A cobertura de testes mede quanto do seu código está sendo exercitado pelos testes.

=== "Usando pytest-cov"
    ```bash
    # Instalar pytest-cov
    pip install pytest-cov
    
    # Executar testes com relatório de cobertura
    pytest --cov=meu_pacote tests/
    
    # Saída de exemplo:
    # Name                    Stmts   Miss  Cover
    # -------------------------------------------
    # meu_pacote/__init__.py      1      0   100%
    # meu_pacote/modulo_a.py     20      2    90%
    # meu_pacote/modulo_b.py     15      5    67%
    # -------------------------------------------
    # TOTAL                      36      7    81%
    
    # Gerar relatório HTML detalhado
    pytest --cov=meu_pacote --cov-report=html tests/
    # Isso cria uma pasta 'htmlcov' com um relatório navegável
    ```

=== "Análise de Cobertura"
    ```python
    # Exemplo de código que precisa de testes
    
    def processar_dados(dados):
        """Processa uma lista de dados."""
        if not dados:
            return []
            
        resultado = []
        for item in dados:
            if isinstance(item, str):
                # Processa strings
                if item.isdigit():
                    resultado.append(int(item))
                else:
                    resultado.append(item.upper())
            elif isinstance(item, (int, float)):
                # Processa números
                resultado.append(item * 2)
            else:
                # Ignora outros tipos
                continue
                
        return resultado
    
    # Testes incompletos (não cobrem todos os caminhos)
    def test_processar_dados_incompleto():
        assert processar_dados([]) == []
        assert processar_dados([1, 2, 3]) == [2, 4, 6]
        assert processar_dados(["a", "b"]) == ["A", "B"]
    
    # A cobertura mostrará que faltam testar:
    # - Strings que contêm números
    # - Tipos que não são strings nem números
    
    # Testes completos
    def test_processar_dados_completo():
        # Lista vazia
        assert processar_dados([]) == []
        
        # Processamento de números
        assert processar_dados([1, 2, 3]) == [2, 4, 6]
        assert processar_dados([1.5, 2.5]) == [3.0, 5.0]
        
        # Processamento de strings
        assert processar_dados(["a", "b"]) == ["A", "B"]
        
        # Strings que são números
        assert processar_dados(["123", "456"]) == [123, 456]
        
        # Dados ignorados
        assert processar_dados([None, {}, []]) == []
        
        # Mistura de tipos
        assert processar_dados([1, "a", "123", None]) == [2, "A", 123]
    ```

## Testes em Aplicações Reais

=== "Estrutura de Diretório"
    ```
    meu_projeto/
    ├── meu_pacote/
    │   ├── __init__.py
    │   ├── modulo_a.py
    │   ├── modulo_b.py
    │   └── subpacote/
    │       ├── __init__.py
    │       └── modulo_c.py
    ├── tests/
    │   ├── __init__.py
    │   ├── test_modulo_a.py
    │   ├── test_modulo_b.py
    │   └── test_modulo_c.py
    ├── setup.py
    ├── requirements.txt
    ├── requirements-dev.txt
    └── pytest.ini
    ```

=== "Configuração de pytest"
    ```ini
    # pytest.ini
    [pytest]
    testpaths = tests
    python_files = test_*.py
    python_classes = Test*
    python_functions = test_*
    
    # Marcadores personalizados
    markers =
        slow: Marca testes lentos
        integration: Marca testes de integração
        api: Marca testes que usam APIs externas
    
    # Configurações de cobertura
    addopts = --cov=meu_pacote --cov-report=term --cov-report=html
    ```

=== "Exemplos de tests.py"
    ```python
    # tests/test_modulo_a.py
    import pytest
    from meu_pacote.modulo_a import funcao_a, ClasseA
    
    @pytest.fixture
    def objeto_a():
        return ClasseA(nome="Teste")
    
    def test_funcao_a():
        assert funcao_a(10) == 20
        assert funcao_a(0) == 0
        
        with pytest.raises(ValueError):
            funcao_a(-1)
    
    def test_classe_a(objeto_a):
        assert objeto_a.nome == "Teste"
        assert objeto_a.metodo_a() == "Teste"
    
    @pytest.mark.slow
    def test_operacao_lenta():
        # Um teste que leva tempo
        import time
        time.sleep(0.1)
        assert True
    
    @pytest.mark.parametrize("entrada,esperado", [
        (1, 2),
        (2, 4),
        (3, 6)
    ])
    def test_funcao_a_parametrizado(entrada, esperado):
        assert funcao_a(entrada) == esperado
    ```

=== "Testes de Integração"
    ```python
    # tests/test_integracao.py
    import pytest
    from meu_pacote.modulo_a import funcao_a
    from meu_pacote.modulo_b import funcao_b
    
    @pytest.mark.integration
    def test_integracao_modulos():
        # Teste que verifica a integração entre módulos
        resultado_a = funcao_a(10)
        assert resultado_a == 20
        
        resultado_b = funcao_b(resultado_a)
        assert resultado_b == "Valor: 20"
    
    @pytest.mark.api
    def test_api_externa(mocker):
        # Teste que mockaria uma API externa
        from meu_pacote.subpacote.modulo_c import buscar_dados
        
        # Mock para a chamada de API
        mock_response = mocker.patch('requests.get')
        mock_response.return_value.json.return_value = {"status": "ok", "data": [1, 2, 3]}
        mock_response.return_value.status_code = 200
        
        # Testar a função que usa a API
        result = buscar_dados("endpoint")
        assert result == [1, 2, 3]
    ```

=== "Executando Testes"
    ```bash
    # Executar todos os testes
    pytest
    
    # Executar apenas testes rápidos (excluir lentos)
    pytest -m "not slow"
    
    # Executar apenas testes de integração
    pytest -m integration
    
    # Executar com saída detalhada
    pytest -v
    
    # Executar um arquivo específico
    pytest tests/test_modulo_a.py
    
    # Executar um teste específico
    pytest tests/test_modulo_a.py::test_funcao_a
    
    # Executar em modo debug
    pytest --pdb
    
    # Gerar relatório XML para CI/CD
    pytest --junitxml=report.xml
    ```

## Boas Práticas de Teste

=== "Princípios para Bons Testes"
    ```python
    # 1. Testes devem ser independentes
    def test_independente_1():
        # Não deve depender de outros testes
        # Nem de estado compartilhado
        assert True
    
    def test_independente_2():
        # Deve funcionar mesmo se outros testes falharem
        assert True
    
    # 2. Testes devem ser determinísticos
    def test_determinístico():
        # Deve dar o mesmo resultado em qualquer execução
        # Evite dependências de tempo, ordem, ou recursos externos
        resultado = 2 + 2
        assert resultado == 4
    
    # 3. Testes devem ser rápidos
    def test_rapido():
        # Testes devem executar rapidamente
        # Se um teste é lento, marque-o como tal
        assert True
    
    # 4. Testes devem ser claros
    def test_divisao_por_zero_deve_lancar_erro():
        # Nome claro e descritivo
        # Um teste por comportamento
        import pytest
        with pytest.raises(ZeroDivisionError):
            1 / 0
    
    # 5. Testes devem ter boa cobertura
    def calcular_area(largura, altura):
        if largura <= 0 ou altura <= 0:
            raise ValueError("Dimensões devem ser positivas")
        return largura * altura
    
    def test_calcular_area():
        # Testar casos normais
        assert calcular_area(2, 3) == 6
        assert calcular_area(1, 1) == 1
        
        # Testar valores limite
        assert calcular_area(0.1, 0.1) == 0.01
        
        # Testar exceções
        import pytest
        with pytest.raises(ValueError):
            calcular_area(0, 5)
        with pytest.raises(ValueError):
            calcular_area(5, -1)
    ```

=== "Padrão Arrange-Act-Assert"
    ```python
    # O padrão AAA organiza os testes em três partes: 
    # - Arrange (Preparar)
    # - Act (Agir)
    # - Assert (Verificar)
    
    def test_exemplo_aaa():
        # Arrange - Preparar os dados e objetos
        lista = [1, 2, 3, 4, 5]
        valor_alvo = 3
        
        # Act - Executar a operação que está sendo testada
        resultado = valor_alvo in lista
        
        # Assert - Verificar se o resultado está correto
        assert resultado == True
    
    # Exemplo com classe
    class CarrinhoCompras:
        def __init__(self):
            self.itens = {}
        
        def adicionar_item(self, produto, quantidade):
            if produto em self.itens:
                self.itens[produto] += quantidade
            else:
                self.itens[produto] = quantidade
        
        def remover_item(self, produto, quantidade=None):
            if produto not in self.itens:
                return
                
            if quantidade é None ou quantidade >= self.itens[produto]:
                del self.itens[produto]
            else:
                self.itens[produto] -= quantidade
        
        def total_itens(self):
            return sum(self.itens.values())
    
    def test_adicionar_item():
        # Arrange
        carrinho = CarrinhoCompras()
        
        # Act
        carrinho.adicionar_item("maça", 3)
        
        # Assert
        assert "maça" em carrinho.itens
        assert carrinho.itens["maça"] == 3
    
    def test_remover_item_completo():
        # Arrange
        carrinho = CarrinhoCompras()
        carrinho.adicionar_item("maça", 3)
        
        # Act
        carrinho.remover_item("maça")
        
        # Assert
        assert "maça" não em carrinho.itens
    
    def test_remover_item_parcial():
        # Arrange
        carrinho = CarrinhoCompras()
        carrinho.adicionar_item("maça", 3)
        
        # Act
        carrinho.remover_item("maça", 2)
        
        # Assert
        assert carrinho.itens["maça"] == 1
    ```

=== "Fixtures Eficientes"
    ```python
    import pytest
    import time
    
    # Fixtures de diferentes escopos
    
    @pytest.fixture
    def recurso_por_teste():
        """Esta fixture é recreada para cada teste."""
        print("\nCriando recurso por teste")
        return {"valor": 42}
    
    @pytest.fixture(scope="module")
    def recurso_por_modulo():
        """Esta fixture é criada uma vez por módulo de teste."""
        print("\nCriando recurso por módulo")
        return {"contador": 0}
    
    @pytest.fixture(scope="session")
    def recurso_por_sessao():
        """Esta fixture é criada uma vez por sessão de teste."""
        print("\nCriando recurso por sessão")
        start_time = time.time()
        yield {"tempo_inicio": start_time}
        print(f"\nTempo total da sessão: {time.time() - start_time:.2f} segundos")
    
    # Testes usando as fixtures
    def test_um(recurso_por_teste, recurso_por_modulo, recurso_por_sessao):
        assert recurso_por_teste["valor"] == 42
        recurso_por_modulo["contador"] += 1
        assert recurso_por_modulo["contador"] == 1
        
    def test_dois(recurso_por_teste, recurso_por_modulo, recurso_por_sessao):
        assert recurso_por_teste["valor"] == 42
        recurso_por_modulo["contador"] += 1
        assert recurso_por_modulo["contador"] == 2
    
    # Fixtures parametrizadas
    @pytest.fixture(params=[1, 2, 3])
    def valor_teste(request):
        """Esta fixture gera três testes com valores diferentes."""
        return request.param
    
    def test_parametrizado(valor_teste):
        assert valor_teste > 0
    ```

## Resumo

Nesta aula, você aprendeu sobre testes em Python, incluindo:

- **Importância dos testes** para garantir a qualidade do código
- **Tipos de testes**: unitários, de integração e funcionais
- **Framework pytest** e suas funcionalidades principais
- **Fixtures** para reutilização de código de teste
- **Parametrização** para executar testes com diferentes entradas
- **Mocks e patching** para isolar unidades de código
- **TDD** (Test-Driven Development) como metodologia de desenvolvimento
- **Cobertura de testes** para medir a eficácia dos testes
- **Testes em frameworks** como Flask e Django
- **Boas práticas** para escrever testes eficazes

!!! info "Recursos de aprendizado"
    - [Documentação oficial do pytest](https://docs.pytest.org/){:target="_blank"}
    - [Documentação do unittest](https://docs.python.org/3/library/unittest.html){:target="_blank"}
    - [Documentação do unittest.mock](https://docs.python.org/3/library/unittest.mock.html){:target="_blank"}
    - [Testes no Django](https://docs.djangoproject.com/en/stable/topics/testing/){:target="_blank"}
    - [Testes no Flask](https://flask.palletsprojects.com/en/latest/testing/){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos os recursos e atualizações das versões recentes do Python, incluindo novos recursos de sintaxe, módulos da biblioteca padrão e melhorias de desempenho.

[Avance para a próxima aula →](/docs/trilhas/python/page-16.md)

[← Voltar para Herança e Polimorfismo](/docs/trilhas/python/page-14.md)