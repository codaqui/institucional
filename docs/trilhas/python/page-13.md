# Programação Orientada a Objetos em Python

## Introdução

A Programação Orientada a Objetos (POO) é um paradigma de programação baseado no conceito de "objetos", que podem conter dados na forma de atributos e código na forma de métodos. Em Python, tudo é um objeto - até mesmo tipos básicos como inteiros e strings.

!!! info "Objetivos de Aprendizado"
    - Compreender os fundamentos da Programação Orientada a Objetos
    - Aprender a criar e utilizar classes e objetos em Python
    - Dominar os conceitos de atributos e métodos de instância e de classe
    - Entender o funcionamento de métodos especiais (dunder methods)
    - Aplicar encapsulamento, getters e setters
    - Explorar a composição de objetos

## Conceitos Fundamentais da POO

A Programação Orientada a Objetos se baseia em quatro pilares principais:

1. **Encapsulamento**: agrupar dados e métodos em uma única unidade (objeto)
2. **Abstração**: expor apenas o necessário e esconder a implementação
3. **Herança**: criar novas classes a partir de classes existentes
4. **Polimorfismo**: usar a mesma interface para diferentes tipos de objetos

=== "Classes e Objetos"
    ```python
    # Uma classe é um modelo para criar objetos
    class Pessoa:
        # O método __init__ é chamado quando um objeto é criado
        def __init__(self, nome, idade):
            self.nome = nome  # Atributo de instância
            self.idade = idade  # Atributo de instância
        
        # Métodos definem comportamentos que os objetos podem ter
        def apresentar(self):
            return f"Olá, meu nome é {self.nome} e tenho {self.idade} anos."
        
        def fazer_aniversario(self):
            self.idade += 1
            return f"Parabéns! Agora {self.nome} tem {self.idade} anos."
    
    # Criando objetos (instâncias) da classe Pessoa
    pessoa1 = Pessoa("Maria", 30)
    pessoa2 = Pessoa("João", 25)
    
    # Chamando métodos nos objetos
    print(pessoa1.apresentar())  # Olá, meu nome é Maria e tenho 30 anos.
    print(pessoa2.apresentar())  # Olá, meu nome é João e tenho 25 anos.
    
    # Acessando e modificando atributos
    print(pessoa1.nome)  # Maria
    pessoa1.nome = "Maria Silva"
    print(pessoa1.apresentar())  # Olá, meu nome é Maria Silva e tenho 30 anos.
    
    # Chamando outro método
    print(pessoa1.fazer_aniversario())  # Parabéns! Agora Maria Silva tem 31 anos.
    ```

=== "Parâmetro self"
    ```python
    class Exemplo:
        def __init__(self, valor):
            # self se refere à instância atual
            self.valor = valor
        
        def metodo_de_instancia(self, multiplicador):
            # self permite acessar os atributos e outros métodos da instância
            return self.valor * multiplicador
        
        def outro_metodo(self):
            # Chamando outro método da mesma classe usando self
            return self.metodo_de_instancia(2)
    
    # Criando uma instância
    ex = Exemplo(10)
    
    # Chamando métodos
    print(ex.metodo_de_instancia(3))  # 30
    print(ex.outro_metodo())  # 20
    
    # O que acontece por baixo dos panos:
    # ex.metodo_de_instancia(3) é equivalente a Exemplo.metodo_de_instancia(ex, 3)
    print(Exemplo.metodo_de_instancia(ex, 3))  # 30
    ```

=== "Variáveis de Classe"
    ```python
    class Contador:
        # Variável de classe - compartilhada por todas as instâncias
        contagem = 0
        
        def __init__(self, nome):
            self.nome = nome  # Variável de instância - única para cada instância
            # Incrementando a variável de classe
            Contador.contagem += 1
        
        @classmethod
        def mostrar_contagem(cls):
            # cls é uma referência à classe
            return f"Existem {cls.contagem} contadores."
    
    # Criando instâncias
    c1 = Contador("Primeiro")
    print(Contador.mostrar_contagem())  # Existem 1 contadores.
    
    c2 = Contador("Segundo")
    print(Contador.mostrar_contagem())  # Existem 2 contadores.
    
    # Acessando a variável de classe
    print(Contador.contagem)  # 2
    print(c1.contagem)  # 2 (acessa a mesma variável)
    print(c2.contagem)  # 2 (acessa a mesma variável)
    
    # Cuidado com atribuições diretas em instâncias!
    c1.contagem = 10  # Isso cria uma variável de instância com o mesmo nome
    print(Contador.contagem)  # 2 (a variável de classe não foi alterada)
    print(c1.contagem)  # 10 (agora c1 tem sua própria variável contagem)
    print(c2.contagem)  # 2 (ainda referencia a variável de classe)
    ```

=== "Métodos de Classe e Estáticos"
    ```python
    class Utilidades:
        valor_padrao = 100
        
        def __init__(self, valor):
            self.valor = valor
        
        # Método de instância - recebe self
        def metodo_instancia(self):
            return f"Método de instância: {self.valor}"
        
        # Método de classe - recebe cls
        @classmethod
        def metodo_classe(cls, fator):
            # Pode acessar/modificar atributos da classe
            return f"Método de classe: {cls.valor_padrao * fator}"
        
        # Método estático - não recebe nem self nem cls
        @staticmethod
        def metodo_estatico(x, y):
            # Não pode acessar atributos de instância ou classe diretamente
            return f"Método estático: {x + y}"
    
    # Usando método de instância
    u = Utilidades(5)
    print(u.metodo_instancia())  # Método de instância: 5
    
    # Usando método de classe
    print(Utilidades.metodo_classe(2))  # Método de classe: 200
    print(u.metodo_classe(2))  # Método de classe: 200 (também pode ser chamado por instâncias)
    
    # Usando método estático
    print(Utilidades.metodo_estatico(10, 20))  # Método estático: 30
    print(u.metodo_estatico(10, 20))  # Método estático: 30 (também pode ser chamado por instâncias)
    ```

## Métodos Especiais (Dunder Methods)

Python oferece métodos especiais (também chamados de "dunder methods" ou "magic methods") que permitem que classes definam comportamentos para operações built-in.

=== "Representação de Strings"
    ```python
    class Produto:
        def __init__(self, nome, preco):
            self.nome = nome
            self.preco = preco
        
        # Chamado quando str(objeto) ou print(objeto)
        def __str__(self):
            return f"{self.nome} - R${self.preco:.2f}"
        
        # Chamado quando repr(objeto) ou na interpretação interativa
        def __repr__(self):
            return f"Produto('{self.nome}', {self.preco})"
    
    # Criando um produto
    p = Produto("Laptop", 3499.99)
    
    # __str__ é usado quando convertemos para string ou imprimimos
    print(p)  # Laptop - R$3499.99
    
    # __repr__ é usado para representação "oficial" (útil para debugging)
    print(repr(p))  # Produto('Laptop', 3499.99)
    
    # Em uma lista, __repr__ é usado por padrão
    produtos = [Produto("Mouse", 29.99), Produto("Teclado", 89.90)]
    print(produtos)  # [Produto('Mouse', 29.99), Produto('Teclado', 89.9)]
    ```

=== "Operadores Matemáticos"
    ```python
    class Vetor2D:
        def __init__(self, x, y):
            self.x = x
            self.y = y
        
        def __str__(self):
            return f"({self.x}, {self.y})"
        
        # Soma: v1 + v2
        def __add__(self, outro):
            return Vetor2D(self.x + outro.x, self.y + outro.y)
        
        # Subtração: v1 - v2
        def __sub__(self, outro):
            return Vetor2D(self.x - outro.x, self.y - outro.y)
        
        # Multiplicação por escalar: v1 * 3
        def __mul__(self, escalar):
            return Vetor2D(self.x * escalar, self.y * escalar)
        
        # Multiplicação por escalar: 3 * v1
        def __rmul__(self, escalar):
            return self.__mul__(escalar)
        
        # Comprimento do vetor: len(v1)
        def __abs__(self):
            import math
            return math.sqrt(self.x ** 2 + self.y ** 2)
        
        # Igualdade: v1 == v2
        def __eq__(self, outro):
            return self.x == outro.x and self.y == outro.y
    
    # Criando vetores
    v1 = Vetor2D(3, 4)
    v2 = Vetor2D(1, 2)
    
    # Usando operadores
    print(f"v1 = {v1}")  # v1 = (3, 4)
    print(f"v2 = {v2}")  # v2 = (1, 2)
    print(f"v1 + v2 = {v1 + v2}")  # v1 + v2 = (4, 6)
    print(f"v1 - v2 = {v1 - v2}")  # v1 - v2 = (2, 2)
    print(f"v1 * 2 = {v1 * 2}")  # v1 * 2 = (6, 8)
    print(f"3 * v2 = {3 * v2}")  # 3 * v2 = (3, 6)
    print(f"|v1| = {abs(v1)}")  # |v1| = 5.0
    
    # Comparação
    v3 = Vetor2D(3, 4)
    print(f"v1 == v3: {v1 == v3}")  # v1 == v3: True
    print(f"v1 == v2: {v1 == v2}")  # v1 == v2: False
    ```

=== "Métodos de Container"
    ```python
    class Playlist:
        def __init__(self, nome, *musicas):
            self.nome = nome
            self.musicas = list(musicas)
        
        def __str__(self):
            return f"Playlist {self.nome} com {len(self.musicas)} músicas"
        
        # Torna a classe iterável
        def __iter__(self):
            return iter(self.musicas)
        
        # Permite acessar com notação de colchetes
        def __getitem__(self, indice):
            return self.musicas[indice]
        
        # Permite atribuir com notação de colchetes
        def __setitem__(self, indice, valor):
            self.musicas[indice] = valor
        
        # Permite usar a função len()
        def __len__(self):
            return len(self.musicas)
        
        # Permite verificar se um item está contido: "in"
        def __contains__(self, item):
            return item in self.musicas
    
    # Criando uma playlist
    pl = Playlist("Meus Favoritos", "Yesterday", "Bohemian Rhapsody", "Imagine")
    
    # Usando métodos de container
    print(pl)  # Playlist Meus Favoritos com 3 músicas
    print(len(pl))  # 3
    print(pl[1])  # Bohemian Rhapsody
    
    # Modificando um item
    pl[0] = "Hey Jude"
    print(pl[0])  # Hey Jude
    
    # Verificando se contém
    print("Imagine" in pl)  # True
    print("Let It Be" in pl)  # False
    
    # Iterando
    print("Músicas na playlist:")
    for musica in pl:
        print(f"- {musica}")
    ```

=== "Método Call"
    ```python
    class Calculadora:
        def __init__(self, valor_inicial=0):
            self.valor = valor_inicial
        
        # Permite que o objeto seja chamado como uma função
        def __call__(self, x, operacao='+'):
            if operacao == '+':
                self.valor += x
            elif operacao == '-':
                self.valor -= x
            elif operacao == '*':
                self.valor *= x
            elif operacao == '/':
                self.valor /= x
            return self.valor
    
    # Criando uma calculadora
    calc = Calculadora(10)
    
    # Chamando o objeto como uma função
    print(calc(5))         # 15 (10 + 5)
    print(calc(3, '*'))    # 45 (15 * 3)
    print(calc(9, '/'))    # 5.0 (45 / 9)
    print(calc(2, '-'))    # 3.0 (5.0 - 2)
    
    # Este padrão é útil para funções que mantêm estado
    counter = Calculadora()
    for i in range(1, 6):
        print(f"Contagem: {counter(1)}")  # Incrementa em 1 a cada chamada
    ```

## Encapsulamento, Getters e Setters

Em Python, o encapsulamento é mais uma convenção do que uma imposição.

=== "Convenções de Nomes"
    ```python
    class Conta:
        def __init__(self, titular, saldo=0):
            self.titular = titular    # Público (acessível diretamente)
            self._saldo = saldo       # "Protegido" (convenção: não acesse diretamente)
            self.__numero = self.__gerar_numero()  # Privado (name mangling)
        
        def __gerar_numero(self):
            import random
            return random.randint(10000, 99999)
        
        def depositar(self, valor):
            if valor > 0:
                self._saldo += valor
                return True
            return False
        
        def sacar(self, valor):
            if 0 < valor <= self._saldo:
                self._saldo -= valor
                return True
            return False
        
        def consultar_saldo(self):
            return self._saldo
        
        def consultar_dados(self):
            # Método para acessar atributo privado
            return f"Conta nº {self.__numero}, Titular: {self.titular}, Saldo: R${self._saldo:.2f}"
    
    # Criando uma conta
    conta = Conta("Ana Silva", 1000)
    
    # Acessando atributos
    print(conta.titular)  # Ana Silva
    
    # Convenções:
    # '_saldo' é protegido, mas ainda acessível (apenas uma convenção)
    print(conta._saldo)  # 1000
    
    # Não se deve acessar '__numero' diretamente
    # print(conta.__numero)  # Erro: AttributeError
    
    # Name mangling: Python renomeia atributos privados
    print(conta._Conta__numero)  # Funciona, mas não deve ser feito
    
    # O modo correto é usar métodos
    print(conta.consultar_dados())
    ```

=== "Properties (Getters e Setters)"
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
            if valor < -273.15:  # Validação: zero absoluto
                raise ValueError("Temperatura abaixo do zero absoluto!")
            self._celsius = valor
        
        # Property calculada (apenas getter)
        @property
        def fahrenheit(self):
            return (self._celsius * 9/5) + 32
        
        # Setter para propriedade calculada
        @fahrenheit.setter
        def fahrenheit(self, valor):
            self.celsius = (valor - 32) * 5/9
        
        # Outra property calculada
        @property
        def kelvin(self):
            return self._celsius + 273.15
        
        @kelvin.setter
        def kelvin(self, valor):
            self.celsius = valor - 273.15
    
    # Criando um objeto temperatura
    temp = Temperatura(25)
    
    # Acessando properties como se fossem atributos
    print(f"Celsius: {temp.celsius}°C")       # Celsius: 25°C
    print(f"Fahrenheit: {temp.fahrenheit}°F") # Fahrenheit: 77.0°F
    print(f"Kelvin: {temp.kelvin}K")          # Kelvin: 298.15K
    
    # Usando setters
    temp.celsius = 30
    print(f"Celsius: {temp.celsius}°C")       # Celsius: 30°C
    print(f"Fahrenheit: {temp.fahrenheit}°F") # Fahrenheit: 86.0°F
    
    temp.fahrenheit = 68
    print(f"Celsius: {temp.celsius}°C")       # Celsius: 20.0°C
    
    temp.kelvin = 300
    print(f"Celsius: {temp.celsius}°C")       # Celsius: 26.85°C
    
    try:
        temp.celsius = -300  # Abaixo do zero absoluto
    except ValueError as e:
        print(f"Erro: {e}")  # Erro: Temperatura abaixo do zero absoluto!
    ```

=== "Property como Decorador"
    ```python
    class Pessoa:
        def __init__(self, nome, idade):
            self._nome = nome
            self._idade = idade
            self._adulto = None  # Valor armazenado em cache
        
        @property
        def nome(self):
            return self._nome
        
        @property
        def idade(self):
            return self._idade
        
        @idade.setter
        def idade(self, valor):
            if valor < 0:
                raise ValueError("Idade não pode ser negativa")
            # Quando a idade muda, invalidamos o cache
            self._idade = valor
            self._adulto = None
        
        @property
        def adulto(self):
            # Lazy evaluation: só calcula quando necessário
            if self._adulto is None:
                self._adulto = self._idade >= 18
            return self._adulto
    
    # Usando a classe
    p = Pessoa("Carlos", 16)
    print(f"{p.nome} tem {p.idade} anos e é adulto? {p.adulto}")
    # Carlos tem 16 anos e é adulto? False
    
    p.idade = 20
    print(f"{p.nome} tem {p.idade} anos e é adulto? {p.adulto}")
    # Carlos tem 20 anos e é adulto? True
    
    # Erro ao tentar atribuir a uma propriedade somente-leitura
    try:
        p.nome = "Carlos Silva"
    except AttributeError as e:
        print(f"Erro: {e}")  # Erro: can't set attribute
    ```

## Composição e Agregação

A composição é uma maneira de reutilizar código criando relações entre objetos.

=== "Composição"
    ```python
    class Motor:
        def __init__(self, cilindradas):
            self.cilindradas = cilindradas
            self.ligado = False
        
        def ligar(self):
            self.ligado = True
            return "Motor ligado!"
        
        def desligar(self):
            self.ligado = False
            return "Motor desligado."
        
        def esta_ligado(self):
            return self.ligado
    
    class Carro:
        def __init__(self, modelo, cor, cilindradas):
            self.modelo = modelo
            self.cor = cor
            # Composição: o carro possui um motor
            self.motor = Motor(cilindradas)
            self.velocidade = 0
        
        def ligar(self):
            return f"{self.modelo}: {self.motor.ligar()}"
        
        def desligar(self):
            if self.velocidade > 0:
                return f"{self.modelo}: Pare o carro antes de desligar!"
            return f"{self.modelo}: {self.motor.desligar()}"
        
        def acelerar(self, valor):
            if not self.motor.esta_ligado():
                return f"{self.modelo}: Ligue o carro primeiro!"
            self.velocidade += valor
            return f"{self.modelo}: Velocidade atual: {self.velocidade} km/h"
        
        def frear(self, valor):
            if self.velocidade - valor < 0:
                self.velocidade = 0
            else:
                self.velocidade -= valor
            return f"{self.modelo}: Velocidade atual: {self.velocidade} km/h"
    
    # Criando e usando um carro
    meu_carro = Carro("Fusca", "Azul", 1300)
    
    print(meu_carro.acelerar(20))  # Fusca: Ligue o carro primeiro!
    print(meu_carro.ligar())       # Fusca: Motor ligado!
    print(meu_carro.acelerar(20))  # Fusca: Velocidade atual: 20 km/h
    print(meu_carro.acelerar(30))  # Fusca: Velocidade atual: 50 km/h
    print(meu_carro.desligar())    # Fusca: Pare o carro antes de desligar!
    print(meu_carro.frear(30))     # Fusca: Velocidade atual: 20 km/h
    print(meu_carro.frear(30))     # Fusca: Velocidade atual: 0 km/h
    print(meu_carro.desligar())    # Fusca: Motor desligado.
    ```

=== "Agregação"
    ```python
    class Autor:
        def __init__(self, nome, nacionalidade):
            self.nome = nome
            self.nacionalidade = nacionalidade
        
        def __str__(self):
            return f"{self.nome} ({self.nacionalidade})"
    
    class Livro:
        def __init__(self, titulo, autor, ano):
            self.titulo = titulo
            # Agregação: o livro tem um autor, mas o autor existe independentemente
            self.autor = autor
            self.ano = ano
        
        def __str__(self):
            return f'"{self.titulo}" por {self.autor}, {self.ano}'
    
    class Biblioteca:
        def __init__(self, nome):
            self.nome = nome
            self.livros = []
        
        def adicionar_livro(self, livro):
            self.livros.append(livro)
            return f'"{livro.titulo}" adicionado à {self.nome}'
        
        def listar_livros(self):
            return [str(livro) for livro in self.livros]
    
    # Criando autores independentes
    machado = Autor("Machado de Assis", "Brasileiro")
    tolkien = Autor("J.R.R. Tolkien", "Britânico")
    
    # Criando livros com os autores existentes
    livro1 = Livro("Dom Casmurro", machado, 1899)
    livro2 = Livro("O Senhor dos Anéis", tolkien, 1954)
    livro3 = Livro("Memórias Póstumas de Brás Cubas", machado, 1881)
    
    # Criando uma biblioteca e adicionando livros
    biblioteca = Biblioteca("Biblioteca Municipal")
    print(biblioteca.adicionar_livro(livro1))
    print(biblioteca.adicionar_livro(livro2))
    print(biblioteca.adicionar_livro(livro3))
    
    # Listando os livros
    print(f"\nLivros disponíveis na {biblioteca.nome}:")
    for livro in biblioteca.listar_livros():
        print(f"- {livro}")
    
    # Observe que os autores existem independentemente dos livros
    print(f"\nAutores:")
    print(f"- {machado}")
    print(f"- {tolkien}")
    ```

=== "Modelo de Dados Completo"
    ```python
    from datetime import datetime, timedelta
    
    class Usuario:
        def __init__(self, nome, email):
            self.nome = nome
            self.email = email
            self.data_cadastro = datetime.now()
            self.carrinho = Carrinho()
        
        def __str__(self):
            return f"Usuário: {self.nome} ({self.email})"
    
    class Produto:
        def __init__(self, nome, preco, codigo):
            self.nome = nome
            self.preco = preco
            self.codigo = codigo
        
        def __str__(self):
            return f"{self.nome} - R${self.preco:.2f}"
    
    class ItemCarrinho:
        def __init__(self, produto, quantidade=1):
            self.produto = produto
            self.quantidade = quantidade
        
        @property
        def subtotal(self):
            return self.produto.preco * self.quantidade
        
        def __str__(self):
            return f"{self.produto.nome} x {self.quantidade} = R${self.subtotal:.2f}"
    
    class Carrinho:
        def __init__(self):
            self.itens = []
        
        def adicionar_item(self, produto, quantidade=1):
            # Verifica se o produto já está no carrinho
            for item in self.itens:
                if item.produto.codigo == produto.codigo:
                    item.quantidade += quantidade
                    return f"{produto.nome} adicionado. Nova quantidade: {item.quantidade}"
            
            # Adiciona novo item
            novo_item = ItemCarrinho(produto, quantidade)
            self.itens.append(novo_item)
            return f"{produto.nome} adicionado ao carrinho."
        
        def remover_item(self, codigo_produto):
            for i, item in enumerate(self.itens):
                if item.produto.codigo == codigo_produto:
                    removido = self.itens.pop(i)
                    return f"{removido.produto.nome} removido do carrinho."
            return "Produto não encontrado no carrinho."
        
        @property
        def total(self):
            return sum(item.subtotal for item in self.itens)
        
        def __str__(self):
            if not self.itens:
                return "Carrinho vazio"
            
            resultado = "Itens no carrinho:\n"
            for item in self.itens:
                resultado += f"- {item}\n"
            resultado += f"Total: R${self.total:.2f}"
            return resultado
    
    class Pedido:
        contador = 0
        
        def __init__(self, usuario, itens_carrinho):
            Pedido.contador += 1
            self.numero = Pedido.contador
            self.usuario = usuario
            self.itens = list(itens_carrinho)  # Cópia dos itens
            self.data = datetime.now()
            self.total = sum(item.subtotal for item in self.itens)
        
        @property
        def data_entrega_estimada(self):
            return self.data + timedelta(days=7)
        
        def __str__(self):
            resultado = f"Pedido #{self.numero} - {self.usuario.nome}\n"
            resultado += f"Data: {self.data.strftime('%d/%m/%Y %H:%M')}\n"
            resultado += "Itens:\n"
            for item in self.itens:
                resultado += f"- {item}\n"
            resultado += f"Total: R${self.total:.2f}\n"
            resultado += f"Entrega estimada: {self.data_entrega_estimada.strftime('%d/%m/%Y')}"
            return resultado
    
    # Exemplo de uso do modelo
    # Criando produtos
    p1 = Produto("Camiseta", 29.90, "CAM001")
    p2 = Produto("Calça Jeans", 99.90, "CAL001")
    p3 = Produto("Tênis", 149.90, "TEN001")
    
    # Criando usuário
    usuario = Usuario("Ana Silva", "ana@email.com")
    print(usuario)
    
    # Adicionando itens ao carrinho
    print(usuario.carrinho.adicionar_item(p1, 2))
    print(usuario.carrinho.adicionar_item(p2))
    print(usuario.carrinho.adicionar_item(p3))
    print(usuario.carrinho.adicionar_item(p1))  # Aumenta a quantidade
    
    # Exibindo o carrinho
    print("\nCarrinho atual:")
    print(usuario.carrinho)
    
    # Removendo um item
    print("\n" + usuario.carrinho.remover_item("TEN001"))
    
    # Criando um pedido com os itens do carrinho
    pedido = Pedido(usuario, usuario.carrinho.itens)
    
    # Exibindo o pedido
    print("\nPedido criado:")
    print(pedido)
    ```

## Exemplo Completo: Aplicação Simples

A seguir, temos um exemplo completo de uma aplicação simples modelada com orientação a objetos.

```python
class Tarefa:
    """Representa uma tarefa a ser realizada."""
    
    def __init__(self, titulo, descricao="", concluida=False, prioridade=1):
        self.titulo = titulo
        self.descricao = descricao
        self.concluida = concluida
        self.prioridade = prioridade
    
    def concluir(self):
        self.concluida = True
        return f"Tarefa '{self.titulo}' marcada como concluída."
    
    def reabrir(self):
        self.concluida = False
        return f"Tarefa '{self.titulo}' reaberta."
    
    def __str__(self):
        status = "✓" if self.concluida else " "
        prioridade = "!" * self.prioridade
        return f"[{status}] {self.titulo} {prioridade}"
    
    def __repr__(self):
        return f"Tarefa('{self.titulo}', '{self.descricao}', {self.concluida}, {self.prioridade})"


class ListaTarefas:
    """Gerencia uma coleção de tarefas."""
    
    def __init__(self, nome):
        self.nome = nome
        self.tarefas = []
    
    def adicionar_tarefa(self, titulo, descricao="", prioridade=1):
        tarefa = Tarefa(titulo, descricao, prioridade=prioridade)
        self.tarefas.append(tarefa)
        return f"Tarefa '{titulo}' adicionada à lista '{self.nome}'."
    
    def concluir_tarefa(self, indice):
        if 0 <= indice < len(self.tarefas):
            return self.tarefas[indice].concluir()
        return "Índice de tarefa inválido."
    
    def reabrir_tarefa(self, indice):
        if 0 <= indice < len(self.tarefas):
            return self.tarefas[indice].reabrir()
        return "Índice de tarefa inválido."
    
    def remover_tarefa(self, indice):
        if 0 <= indice < len(self.tarefas):
            tarefa = self.tarefas.pop(indice)
            return f"Tarefa '{tarefa.titulo}' removida."
        return "Índice de tarefa inválido."
    
    def listar_tarefas(self, apenas_pendentes=False):
        if not self.tarefas:
            return "Não há tarefas nesta lista."
        
        resultado = f"Lista de Tarefas: {self.nome}\n"
        
        tarefas_filtradas = [t for t in self.tarefas if not apenas_pendentes or not t.concluida]
        
        if not tarefas_filtradas:
            return resultado + "Não há tarefas pendentes."
        
        # Ordenar por prioridade (decrescente) e por conclusão
        tarefas_ordenadas = sorted(
            tarefas_filtradas, 
            key=lambda t: (-t.prioridade, t.concluida)
        )
        
        for i, tarefa in enumerate(tarefas_ordenadas):
            resultado += f"{i}. {tarefa}\n"
            if tarefa.descricao:
                resultado += f"   {tarefa.descricao}\n"
        
        return resultado


class GerenciadorTarefas:
    """Sistema para gerenciar múltiplas listas de tarefas."""
    
    def __init__(self):
        self.listas = {}
    
    def criar_lista(self, nome):
        if nome in self.listas:
            return f"Lista '{nome}' já existe."
        
        self.listas[nome] = ListaTarefas(nome)
        return f"Lista '{nome}' criada com sucesso."
    
    def remover_lista(self, nome):
        if nome in self.listas:
            del self.listas[nome]
            return f"Lista '{nome}' removida com sucesso."
        return f"Lista '{nome}' não encontrada."
    
    def listar_listas(self):
        if not self.listas:
            return "Não há listas de tarefas."
        
        resultado = "Listas de Tarefas:\n"
        for nome, lista in self.listas.items():
            tarefas_pendentes = sum(1 for t in lista.tarefas if not t.concluida)
            resultado += f"- {nome} ({tarefas_pendentes} pendentes)\n"
        
        return resultado
    
    def obter_lista(self, nome):
        return self.listas.get(nome)


# Demonstração do uso
def demonstracao():
    gerenciador = GerenciadorTarefas()
    
    print(gerenciador.criar_lista("Trabalho"))
    print(gerenciador.criar_lista("Pessoal"))
    
    lista_trabalho = gerenciador.obter_lista("Trabalho")
    lista_pessoal = gerenciador.obter_lista("Pessoal")
    
    print(lista_trabalho.adicionar_tarefa("Enviar relatório", "Relatório mensal para o gerente", 3))
    print(lista_trabalho.adicionar_tarefa("Reunião de projeto", "Videoconferência às 14h", 2))
    print(lista_trabalho.adicionar_tarefa("Revisar código", "Verificar PR #123 no GitHub", 2))
    
    print(lista_pessoal.adicionar_tarefa("Comprar mantimentos", "Leite, ovos, pão", 1))
    print(lista_pessoal.adicionar_tarefa("Academia", "Treino de musculação", 2))
    
    print("\n" + gerenciador.listar_listas())
    
    print("\n" + lista_trabalho.listar_tarefas())
    
    print("\nConcluindo tarefas:")
    print(lista_trabalho.concluir_tarefa(1))
    print(lista_pessoal.concluir_tarefa(0))
    
    print("\nTarefas pendentes do trabalho:")
    print(lista_trabalho.listar_tarefas(apenas_pendentes=True))
    
    print("\nRemovendo lista:")
    print(gerenciador.remover_lista("Pessoal"))
    print(gerenciador.listar_listas())


if __name__ == "__main__":
    demonstracao()
```

## Resumo

Nesta aula, você aprendeu os fundamentos da Programação Orientada a Objetos em Python:

- **Classes e Objetos**: Como criar modelos (classes) e instâncias (objetos)
- **Atributos e Métodos**: Como definir dados e comportamentos
- **Métodos Especiais**: Como personalizar o comportamento dos objetos com métodos dunder
- **Encapsulamento**: Como proteger dados e fornecer interfaces controladas com properties
- **Composição e Agregação**: Como criar relações entre objetos
- **Aplicações Práticas**: Como modelar problemas do mundo real usando POO

!!! info "Recursos de aprendizado"
    - [Documentação oficial Python sobre classes](https://docs.python.org/3/tutorial/classes.html){:target="_blank"}
    - [Python Data Model](https://docs.python.org/3/reference/datamodel.html){:target="_blank"}
    - [Real Python: Object-Oriented Programming in Python 3](https://realpython.com/python3-object-oriented-programming/){:target="_blank"}
    - [PEP 8 - Conveções de estilo para código Python](https://peps.python.org/pep-0008/){:target="_blank"}

## Próximos Passos

Na próxima aula, vamos explorar o conceito de herança e polimorfismo, expandindo nossos conhecimentos sobre Programação Orientada a Objetos e aprendendo como criar hierarquias de classes.

[Avance para a próxima aula →](/docs/trilhas/python/page-14)

[← Voltar para Decoradores](/docs/trilhas/python/page-12)
