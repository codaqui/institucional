# Herança e Polimorfismo em Python

## Introdução

A herança e o polimorfismo são dois conceitos fundamentais da Programação Orientada a Objetos que permitem criar hierarquias de classes e reutilizar código de forma eficiente. Estes conceitos são cruciais para construir sistemas bem organizados, extensíveis e de fácil manutenção.

!!! info "Objetivos de Aprendizado"
    - Compreender o conceito de herança e sua implementação em Python
    - Entender como usar herança múltipla e suas implicações
    - Aprender o funcionamento do método `super()` para acessar métodos da classe pai
    - Dominar o conceito de polimorfismo e suas aplicações
    - Explorar classes abstratas e interfaces em Python
    - Aplicar boas práticas no uso de herança e polimorfismo

## Herança em Python

A herança permite que uma classe (subclasse ou classe filha) herde atributos e métodos de outra classe (superclasse ou classe pai).

=== "Herança Básica"
    ```python
    # Classe pai
    class Animal:
        def __init__(self, nome, idade):
            self.nome = nome
            self.idade = idade
        
        def fazer_som(self):
            print("Algum som de animal")
        
        def apresentar(self):
            return f"Olá, eu sou {self.nome} e tenho {self.idade} anos."
    
    # Classe filha
    class Cachorro(Animal):
        def __init__(self, nome, idade, raca):
            # Chamando o construtor da classe pai
            super().__init__(nome, idade)
            self.raca = raca
        
        # Sobrescrevendo o método da classe pai
        def fazer_som(self):
            print("Au au!")
        
        # Método específico da classe filha
        def abanar_rabo(self):
            print(f"{self.nome} está abanando o rabo!")
    
    # Usando as classes
    animal = Animal("Animal Genérico", 5)
    print(animal.apresentar())  # Olá, eu sou Animal Genérico e tenho 5 anos.
    animal.fazer_som()  # Algum som de animal
    
    rex = Cachorro("Rex", 3, "Labrador")
    print(rex.apresentar())  # Olá, eu sou Rex e tenho 3 anos.
    rex.fazer_som()  # Au au!
    rex.abanar_rabo()  # Rex está abanando o rabo!
    
    # Verificando relações de herança
    print(isinstance(rex, Cachorro))  # True
    print(isinstance(rex, Animal))  # True
    print(issubclass(Cachorro, Animal))  # True
    ```

=== "Herança em Cadeia"
    ```python
    class Veiculo:
        def __init__(self, marca, modelo):
            self.marca = marca
            self.modelo = modelo
            self.ligado = False
        
        def ligar(self):
            self.ligado = True
            return f"{self.marca} {self.modelo} ligado."
        
        def desligar(self):
            self.ligado = False
            return f"{self.marca} {self.modelo} desligado."
        
        def info(self):
            return f"Veículo: {self.marca} {self.modelo}"
    
    class Carro(Veiculo):
        def __init__(self, marca, modelo, portas):
            super().__init__(marca, modelo)
            self.portas = portas
        
        def info(self):
            return f"Carro: {self.marca} {self.modelo}, {self.portas} portas"
    
    class SUV(Carro):
        def __init__(self, marca, modelo, portas, tracao):
            super().__init__(marca, modelo, portas)
            self.tracao = tracao
        
        def info(self):
            return f"SUV: {self.marca} {self.modelo}, {self.portas} portas, tração {self.tracao}"
    
    # Criando instâncias
    veiculo = Veiculo("Genérico", "Básico")
    carro = Carro("Toyota", "Corolla", 4)
    suv = SUV("Honda", "CR-V", 5, "4x4")
    
    # Cada classe na hierarquia sobrescreve o método info
    print(veiculo.info())  # Veículo: Genérico Básico
    print(carro.info())    # Carro: Toyota Corolla, 4 portas
    print(suv.info())      # SUV: Honda CR-V, 5 portas, tração 4x4
    
    # Métodos da classe base funcionam em todas as subclasses
    print(veiculo.ligar())  # Genérico Básico ligado.
    print(carro.ligar())    # Toyota Corolla ligado.
    print(suv.ligar())      # Honda CR-V ligado.
    ```

=== "Herança Múltipla"
    ```python
    class Dispositivo:
        def __init__(self, nome, marca):
            self.nome = nome
            self.marca = marca
            self.ligado = False
        
        def ligar(self):
            self.ligado = True
            return f"{self.nome} ligado."
        
        def desligar(self):
            self.ligado = False
            return f"{self.nome} desligado."
    
    class Conectavel:
        def __init__(self):
            self.conectado = False
        
        def conectar(self):
            self.conectado = True
            return "Conectado à internet."
        
        def desconectar(self):
            self.conectado = False
            return "Desconectado da internet."
    
    class Bateria:
        def __init__(self):
            self.carga = 100
        
        def verificar_bateria(self):
            return f"Bateria: {self.carga}%"
        
        def carregar(self, quantidade):
            self.carga = min(100, self.carga + quantidade)
            return f"Carregado. Bateria: {self.carga}%"
    
    # Herança múltipla
    class Smartphone(Dispositivo, Conectavel, Bateria):
        def __init__(self, nome, marca, modelo, sistema_operacional):
            # Inicializando as superclasses
            Dispositivo.__init__(self, nome, marca)
            Conectavel.__init__(self)
            Bateria.__init__(self)
            
            # Atributos específicos
            self.modelo = modelo
            self.sistema_operacional = sistema_operacional
        
        def fazer_ligacao(self, numero):
            if not self.ligado:
                return "Smartphone desligado. Ligue-o primeiro."
            
            if self.carga < 10:
                return "Bateria fraca. Carregue o smartphone."
            
            self.carga -= 5
            return f"Ligando para {numero}..."
    
    # Usando a classe com herança múltipla
    meu_smartphone = Smartphone("Galaxy S21", "Samsung", "S21", "Android")
    
    print(meu_smartphone.ligar())            # Galaxy S21 ligado.
    print(meu_smartphone.conectar())         # Conectado à internet.
    print(meu_smartphone.verificar_bateria())  # Bateria: 100%
    print(meu_smartphone.fazer_ligacao("123-456-7890"))  # Ligando para 123-456-7890...
    print(meu_smartphone.verificar_bateria())  # Bateria: 95%
    ```

=== "MRO (Method Resolution Order)"
    ```python
    # O MRO (Method Resolution Order) define a ordem em que Python
    # procura métodos em classes com herança múltipla
    
    class A:
        def quem_sou_eu(self):
            return "Eu sou A"
    
    class B(A):
        def quem_sou_eu(self):
            return "Eu sou B"
    
    class C(A):
        def quem_sou_eu(self):
            return "Eu sou C"
    
    class D(B, C):
        pass
    
    class E(C, B):
        pass
    
    # Usando as classes
    d = D()
    e = E()
    
    # D herda de B e C, nessa ordem
    print(d.quem_sou_eu())  # Eu sou B
    
    # E herda de C e B, nessa ordem
    print(e.quem_sou_eu())  # Eu sou C
    
    # Visualizando o MRO completo
    print(D.mro())  # [<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>]
    print(E.mro())  # [<class 'E'>, <class 'C'>, <class 'B'>, <class 'A'>, <class 'object'>]
    
    # O algoritmo C3 é usado para determinar o MRO
    # e evitar ambiguidades na resolução de métodos
    ```

## O método super()

O método `super()` é usado para chamar métodos da classe pai, o que é essencial para a extensão de comportamentos em subclasses.

=== "Chamando Construtores"
    ```python
    class Forma:
        def __init__(self, cor):
            self.cor = cor
        
        def info(self):
            return f"Forma de cor {self.cor}"
    
    class Retangulo(Forma):
        def __init__(self, cor, largura, altura):
            # Chama o construtor da classe pai
            super().__init__(cor)
            
            # Adiciona atributos específicos
            self.largura = largura
            self.altura = altura
        
        def info(self):
            # Estende o método da classe pai
            return f"{super().info()}, largura: {self.largura}, altura: {self.altura}"
        
        def area(self):
            return self.largura * self.altura
    
    class Quadrado(Retangulo):
        def __init__(self, cor, lado):
            # Chama o construtor da classe Retangulo
            super().__init__(cor, lado, lado)
        
        def info(self):
            # Como a classe pai já é Retangulo, podemos personalizar mais
            info_pai = super().info()
            return info_pai.replace("largura: {}, altura: {}".format(self.largura, self.altura), 
                                  f"lado: {self.largura}")
    
    # Usando as classes
    forma = Forma("azul")
    retangulo = Retangulo("verde", 10, 5)
    quadrado = Quadrado("vermelho", 7)
    
    print(forma.info())     # Forma de cor azul
    print(retangulo.info())  # Forma de cor verde, largura: 10, altura: 5
    print(quadrado.info())   # Forma de cor vermelho, lado: 7
    
    print(f"Área do retângulo: {retangulo.area()}")  # Área do retângulo: 50
    print(f"Área do quadrado: {quadrado.area()}")    # Área do quadrado: 49
    ```

=== "Super com Herança Múltipla"
    ```python
    class A:
        def metodo(self):
            print("Método na classe A")
    
    class B(A):
        def metodo(self):
            print("Método na classe B")
            super().metodo()  # Chama A.metodo()
    
    class C(A):
        def metodo(self):
            print("Método na classe C")
            super().metodo()  # Chama A.metodo()
    
    class D(B, C):
        def metodo(self):
            print("Método na classe D")
            super().metodo()  # Chama B.metodo() (primeiro na ordem MRO)
    
    # Usando a classe D
    d = D()
    d.metodo()
    # Saída:
    # Método na classe D
    # Método na classe B
    # Método na classe C
    # Método na classe A
    
    # Explicação:
    # 1. D.metodo() chama super().metodo(), que é B.metodo()
    # 2. B.metodo() imprime sua mensagem e chama super().metodo(), que é C.metodo()
    # 3. C.metodo() imprime sua mensagem e chama super().metodo(), que é A.metodo()
    # 4. A.metodo() imprime sua mensagem
    
    # O MRO para D é: [D, B, C, A, object]
    # super() sempre segue essa ordem
    ```

=== "Super com Parâmetros"
    ```python
    class Pessoa:
        def __init__(self, nome, idade):
            self.nome = nome
            self.idade = idade
        
        def apresentar(self):
            return f"Olá, eu sou {self.nome} e tenho {self.idade} anos."
    
    class Aluno(Pessoa):
        def __init__(self, nome, idade, matricula):
            super().__init__(nome, idade)
            self.matricula = matricula
        
        def apresentar(self):
            return f"{super().apresentar()} Sou aluno com matrícula {self.matricula}."
    
    class AlunoMonitor(Aluno):
        def __init__(self, nome, idade, matricula, disciplina):
            super().__init__(nome, idade, matricula)
            self.disciplina = disciplina
        
        def apresentar(self):
            # Usando super() com argumentos específicos
            # super(AlunoMonitor, self) se refere à classe Aluno
            apresentacao_base = super().apresentar()
            
            # Também poderia chamar diretamente a classe avô
            # apresentacao_avô = super(Aluno, self).apresentar()
            # ou apresentacao_avô = Pessoa.apresentar(self)
            
            return f"{apresentacao_base} Sou monitor da disciplina de {self.disciplina}."
    
    # Usando as classes
    pessoa = Pessoa("Ana", 25)
    aluno = Aluno("João", 20, "A12345")
    monitor = AlunoMonitor("Pedro", 22, "B67890", "Programação")
    
    print(pessoa.apresentar())
    # Olá, eu sou Ana e tenho 25 anos.
    
    print(aluno.apresentar())
    # Olá, eu sou João e tenho 20 anos. Sou aluno com matrícula A12345.
    
    print(monitor.apresentar())
    # Olá, eu sou Pedro e tenho 22 anos. Sou aluno com matrícula B67890. Sou monitor da disciplina de Programação.
    ```

## Polimorfismo

O polimorfismo permite que objetos de diferentes classes sejam tratados como objetos de uma classe comum, possibilitando que métodos com o mesmo nome tenham comportamentos diferentes dependendo da classe.

=== "Polimorfismo de Método"
    ```python
    # Diferentes classes implementando o mesmo método
    class Animal:
        def falar(self):
            pass  # Método genérico a ser sobrescrito
        
        def emitir_som(self):
            # Esse método usa o método falar() polimórfico
            print(f"O animal emite: {self.falar()}")
    
    class Cachorro(Animal):
        def falar(self):
            return "Au au!"
    
    class Gato(Animal):
        def falar(self):
            return "Miau!"
    
    class Pato(Animal):
        def falar(self):
            return "Quack quack!"
    
    # Função que usa o polimorfismo
    def fazer_animal_falar(animal):
        print(f"O {animal.__class__.__name__} diz: {animal.falar()}")
    
    # Criando instâncias
    rex = Cachorro()
    felix = Gato()
    donald = Pato()
    
    # Chamando o mesmo método em diferentes objetos
    fazer_animal_falar(rex)     # O Cachorro diz: Au au!
    fazer_animal_falar(felix)   # O Gato diz: Miau!
    fazer_animal_falar(donald)  # O Pato diz: Quack quack!
    
    # Usando o método que chama o método polimórfico
    rex.emitir_som()    # O animal emite: Au au!
    felix.emitir_som()  # O animal emite: Miau!
    donald.emitir_som() # O animal emite: Quack quack!
    
    # Armazenando em uma lista (duck typing)
    animais = [rex, felix, donald]
    for animal in animais:
        fazer_animal_falar(animal)
    ```

=== "Duck Typing"
    ```python
    # Duck Typing: "Se anda como um pato e faz quack como um pato, então é um pato"
    # Em Python, o tipo exato de um objeto é menos importante que os métodos e atributos que ele possui
    
    class Pato:
        def nadar(self):
            return "Pato nadando"
        
        def fazer_quack(self):
            return "Quack quack!"
    
    class PessoaQueImitaPato:
        def nadar(self):
            return "Pessoa fingindo nadar como pato"
        
        def fazer_quack(self):
            return "Pessoa imitando: Quaaack!"
    
    class Cisne:
        def nadar(self):
            return "Cisne nadando elegantemente"
        
        def cantar(self):
            return "♪♫♪"
    
    # Função que usa duck typing
    def fazer_pato_agir(pato):
        # Não verifica o tipo, apenas se tem os métodos necessários
        try:
            print(pato.nadar())
            print(pato.fazer_quack())
            print("Este objeto age como um pato!")
        except AttributeError as e:
            print(f"Este objeto não age como um pato: {e}")
    
    # Testando com diferentes objetos
    pato = Pato()
    imitador = PessoaQueImitaPato()
    cisne = Cisne()
    
    print("Testando um pato real:")
    fazer_pato_agir(pato)
    # Pato nadando
    # Quack quack!
    # Este objeto age como um pato!
    
    print("\nTestando um imitador de pato:")
    fazer_pato_agir(imitador)
    # Pessoa fingindo nadar como pato
    # Pessoa imitando: Quaaack!
    # Este objeto age como um pato!
    
    print("\nTestando um cisne:")
    fazer_pato_agir(cisne)
    # Cisne nadando elegantemente
    # Este objeto não age como um pato: 'Cisne' object has no attribute 'fazer_quack'
    ```

=== "Polimorfismo em Built-ins"
    ```python
    # Polimorfismo está presente em muitas operações built-in do Python
    
    # O operador + é polimórfico
    print(10 + 5)          # 15 (soma de inteiros)
    print("Olá " + "mundo") # Olá mundo (concatenação de strings)
    print([1, 2] + [3, 4])  # [1, 2, 3, 4] (concatenação de listas)
    
    # O operador * também é polimórfico
    print(5 * 3)     # 15 (multiplicação de inteiros)
    print("Py" * 3)  # PyPyPy (repetição de string)
    print([7] * 3)   # [7, 7, 7] (repetição de lista)
    
    # A função len() funciona com diferentes tipos
    print(len("Python"))        # 6 (comprimento de string)
    print(len([1, 2, 3, 4, 5])) # 5 (comprimento de lista)
    print(len({"a": 1, "b": 2})) # 2 (número de chaves em dicionário)
    
    # Criando uma classe que implementa métodos especiais para operadores
    class Ponto:
        def __init__(self, x, y):
            self.x = x
            self.y = y
            
        def __str__(self):
            return f"({self.x}, {self.y})"
            
        def __add__(self, outro):
            return Ponto(self.x + outro.x, self.y + outro.y)
            
        def __mul__(self, escalar):
            return Ponto(self.x * escalar, self.y * escalar)
            
        def __len__(self):
            import math
            # Retorna a distância Manhattan como um inteiro
            return int(abs(self.x) + abs(self.y))
    
    p1 = Ponto(3, 4)
    p2 = Ponto(2, 7)
    
    print(f"p1 = {p1}")         # p1 = (3, 4)
    print(f"p2 = {p2}")         # p2 = (2, 7)
    print(f"p1 + p2 = {p1 + p2}")  # p1 + p2 = (5, 11)
    print(f"p1 * 3 = {p1 * 3}")  # p1 * 3 = (9, 12)
    print(f"len(p1) = {len(p1)}")  # len(p1) = 7
    ```

## Classes Abstratas e Interfaces

Python não tem interfaces formais como algumas linguagens, mas classes abstratas podem ser usadas para definir estruturas semelhantes.

=== "Classes Abstratas"
    ```python
    from abc import ABC, abstractmethod
    
    # Classe abstrata
    class FormaGeometrica(ABC):
        @abstractmethod
        def area(self):
            """Calcula a área da forma."""
            pass
        
        @abstractmethod
        def perimetro(self):
            """Calcula o perímetro da forma."""
            pass
        
        def descricao(self):
            """Método concreto (não abstrato)."""
            return "Esta é uma forma geométrica."
    
    # Não podemos instanciar uma classe abstrata
    # forma = FormaGeometrica()  # Isso causaria um erro
    
    # Classes concretas que implementam a classe abstrata
    class Retangulo(FormaGeometrica):
        def __init__(self, largura, altura):
            self.largura = largura
            self.altura = altura
        
        def area(self):
            return self.largura * self.altura
        
        def perimetro(self):
            return 2 * (self.largura + self.altura)
        
        def descricao(self):
            return f"Este é um retângulo de {self.largura}x{self.altura}."
    
    class Circulo(FormaGeometrica):
        def __init__(self, raio):
            self.raio = raio
        
        def area(self):
            import math
            return math.pi * self.raio ** 2
        
        def perimetro(self):
            import math
            return 2 * math.pi * self.raio
        
        # Usamos a implementação padrão de descricao()
    
    # Agora podemos instanciar as classes concretas
    retangulo = Retangulo(10, 5)
    circulo = Circulo(7)
    
    # E usar seus métodos
    print(f"Área do retângulo: {retangulo.area()}")  # Área do retângulo: 50
    print(f"Perímetro do retângulo: {retangulo.perimetro()}")  # Perímetro do retângulo: 30
    print(retangulo.descricao())  # Este é um retângulo de 10x5.
    
    print(f"Área do círculo: {circulo.area():.2f}")  # Área do círculo: 153.94
    print(f"Perímetro do círculo: {circulo.perimetro():.2f}")  # Perímetro do círculo: 43.98
    print(circulo.descricao())  # Esta é uma forma geométrica.
    ```

=== "Usando ABC como Interface"
    ```python
    from abc import ABC, abstractmethod
    
    # Interface para dispositivos que podem conectar-se
    class Conectavel(ABC):
        @abstractmethod
        def conectar(self):
            pass
        
        @abstractmethod
        def desconectar(self):
            pass
    
    # Interface para dispositivos que têm bateria
    class ComBateria(ABC):
        @abstractmethod
        def verificar_bateria(self):
            pass
        
        @abstractmethod
        def carregar(self, quantidade):
            pass
    
    # Classes que implementam as interfaces
    class Smartphone(Conectavel, ComBateria):
        def __init__(self, modelo):
            self.modelo = modelo
            self.conectado = False
            self.bateria = 100
        
        def conectar(self):
            self.conectado = True
            return f"{self.modelo} conectado à rede."
        
        def desconectar(self):
            self.conectado = False
            return f"{self.modelo} desconectado da rede."
        
        def verificar_bateria(self):
            return f"Bateria do {self.modelo}: {self.bateria}%"
        
        def carregar(self, quantidade):
            self.bateria = min(100, self.bateria + quantidade)
            return f"{self.modelo} carregado. Bateria: {self.bateria}%"
    
    class Laptop(Conectavel, ComBateria):
        def __init__(self, marca):
            self.marca = marca
            self.conectado = False
            self.bateria = 100
        
        def conectar(self):
            self.conectado = True
            return f"Laptop {self.marca} conectado ao Wi-Fi."
        
        def desconectar(self):
            self.conectado = False
            return f"Laptop {self.marca} desconectado do Wi-Fi."
        
        def verificar_bateria(self):
            return f"Bateria do laptop {self.marca}: {self.bateria}%"
        
        def carregar(self, quantidade):
            self.bateria = min(100, self.bateria + quantidade)
            return f"Laptop {self.marca} carregado. Bateria: {self.bateria}%"
    
    # Função que trabalha com objetos que implementam Conectavel
    def conectar_dispositivo(dispositivo):
        if isinstance(dispositivo, Conectavel):
            return dispositivo.conectar()
        else:
            return "Este dispositivo não suporta conexão."
    
    # Função que trabalha com objetos que implementam ComBateria
    def mostrar_bateria(dispositivo):
        if isinstance(dispositivo, ComBateria):
            return dispositivo.verificar_bateria()
        else:
            return "Este dispositivo não tem bateria."
    
    # Criando instâncias
    celular = Smartphone("iPhone 13")
    notebook = Laptop("Dell")
    
    # Usando as funções
    print(conectar_dispositivo(celular))  # iPhone 13 conectado à rede.
    print(conectar_dispositivo(notebook))  # Laptop Dell conectado ao Wi-Fi.
    
    print(mostrar_bateria(celular))  # Bateria do iPhone 13: 100%
    print(mostrar_bateria(notebook))  # Bateria do laptop Dell: 100%
    
    # Usando o polimorfismo através das interfaces
    dispositivos = [celular, notebook]
    for d in dispositivos:
        print(d.conectar())
        print(d.verificar_bateria())
        print(d.carregar(10))  # Isso não terá efeito visível pois as baterias já estão em 100%
        print(d.desconectar())
    ```

=== "Protocolo para Validação"
    ```python
    from abc import ABC, abstractmethod
    import re
    
    # Interface para validadores
    class Validador(ABC):
        @abstractmethod
        def validar(self, valor):
            """Retorna True se válido, False caso contrário."""
            pass
        
        @abstractmethod
        def mensagem_erro(self):
            """Retorna a mensagem de erro."""
            pass
    
    # Implementações concretas
    class ValidadorEmail(Validador):
        def __init__(self):
            self._ultimo_erro = ""
            self._padrao = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        def validar(self, email):
            if not isinstance(email, str):
                self._ultimo_erro = "Email deve ser uma string."
                return False
            
            if not re.match(self._padrao, email):
                self._ultimo_erro = "Formato de email inválido."
                return False
                
            self._ultimo_erro = ""
            return True
        
        def mensagem_erro(self):
            return self._ultimo_erro
    
    class ValidadorSenha(Validador):
        def __init__(self, min_tamanho=8):
            self._ultimo_erro = ""
            self._min_tamanho = min_tamanho
        
        def validar(self, senha):
            if not isinstance(senha, str):
                self._ultimo_erro = "Senha deve ser uma string."
                return False
                
            if len(senha) < self._min_tamanho:
                self._ultimo_erro = f"Senha deve ter pelo menos {self._min_tamanho} caracteres."
                return False
                
            if not any(c.isupper() for c in senha):
                self._ultimo_erro = "Senha deve conter pelo menos uma letra maiúscula."
                return False
                
            if not any(c.islower() for c in senha):
                self._ultimo_erro = "Senha deve conter pelo menos uma letra minúscula."
                return False
                
            if not any(c.isdigit() for c in senha):
                self._ultimo_erro = "Senha deve conter pelo menos um número."
                return False
                
            self._ultimo_erro = ""
            return True
        
        def mensagem_erro(self):
            return self._ultimo_erro
    
    # Função que usa polimorfismo
    def validar_entrada(valor, validador):
        if validador.validar(valor):
            return "Válido!"
        else:
            return f"Inválido: {validador.mensagem_erro()}"
    
    # Testando os validadores
    email_validador = ValidadorEmail()
    senha_validador = ValidadorSenha()
    
    print(validar_entrada("usuario@exemplo.com", email_validador))  # Válido!
    print(validar_entrada("usuario@", email_validador))  # Inválido: Formato de email inválido.
    
    print(validar_entrada("Senha123", senha_validador))  # Válido!
    print(validar_entrada("senha123", senha_validador))  # Inválido: Senha deve conter pelo menos uma letra maiúscula.
    print(validar_entrada("SENHA123", senha_validador))  # Inválido: Senha deve conter pelo menos uma letra minúscula.
    print(validar_entrada("Senhafraca", senha_validador))  # Inválido: Senha deve conter pelo menos um número.
    ```

## Exemplo Prático: Sistema de Formas Geométricas

Um exemplo completo que demonstra herança, polimorfismo e os princípios SOLID.

```python
from abc import ABC, abstractmethod
import math

# Classe abstrata base
class Forma(ABC):
    @abstractmethod
    def area(self):
        """Calcula a área da forma."""
        pass
    
    @abstractmethod
    def perimetro(self):
        """Calcula o perímetro da forma."""
        pass
    
    def __str__(self):
        return f"{self.__class__.__name__}: área={self.area():.2f}, perímetro={self.perimetro():.2f}"


# Implementações concretas de formas geométricas
class Retangulo(Forma):
    def __init__(self, largura, altura):
        if largura <= 0 ou altura <= 0:
            raise ValueError("Dimensões devem ser positivas")
        self.largura = largura
        self.altura = altura
    
    def area(self):
        return self.largura * self.altura
    
    def perimetro(self):
        return 2 * (self.largura + self.altura)
    
    def __str__(self):
        return f"{super().__str__()}, largura={self.largura}, altura={self.altura}"


class Quadrado(Retangulo):
    def __init__(self, lado):
        super().__init__(lado, lado)
        self.lado = lado
    
    def __str__(self):
        return f"{self.__class__.__name__}: área={self.area():.2f}, perímetro={self.perimetro():.2f}, lado={self.lado}"


class Circulo(Forma):
    def __init__(self, raio):
        if raio <= 0:
            raise ValueError("Raio deve ser positivo")
        self.raio = raio
    
    def area(self):
        return math.pi * self.raio ** 2
    
    def perimetro(self):
        return 2 * math.pi * self.raio
    
    def __str__(self):
        return f"{super().__str__()}, raio={self.raio}"


class Triangulo(Forma):
    def __init__(self, a, b, c):
        # Verificação da desigualdade triangular
        if a + b <= c ou a + c <= b ou b + c <= a:
            raise ValueError("Estas medidas não formam um triângulo válido")
        self.a = a
        self.b = b
        self.c = c
    
    def area(self):
        # Fórmula de Heron
        s = (self.a + self.b + self.c) / 2
        return math.sqrt(s * (s - self.a) * (s - self.b) * (s - self.c))
    
    def perimetro(self):
        return self.a + self.b + self.c
    
    def __str__(self):
        return f"{super().__str__()}, lados={self.a}, {self.b}, {self.c}"


# Classe com funcionalidade adicional
class FormaColorida:
    def __init__(self, forma, cor):
        self.forma = forma
        self.cor = cor
    
    def area(self):
        return self.forma.area()
    
    def perimetro(self):
        return self.forma.perimetro()
    
    def __str__(self):
        return f"{self.forma} (cor: {self.cor})"


# Gerenciador de formas
class GerenciadorFormas:
    def __init__(self):
        self.formas = []
    
    def adicionar_forma(self, forma):
        if not isinstance(forma, Forma) e não tem hasattr(forma, 'area') e não tem hasattr(forma, 'perimetro'):
            raise TypeError("O objeto deve ser uma forma válida com métodos area() e perimetro()")
        self.formas.append(forma)
    
    def area_total(self):
        return sum(forma.area() para forma em self.formas)
    
    def perimetro_total(self):
        return sum(forma.perimetro() para forma em self.formas)
    
    def listar_formas(self):
        if not self.formas:
            return "Nenhuma forma registrada."
        
        resultado = "Formas registradas:\n"
        for i, forma em enumerate(self.formas, 1):
            resultado += f"{i}. {forma}\n"
        
        resultado += f"\nÁrea total: {self.area_total():.2f}"
        resultado += f"\nPerímetro total: {self.perimetro_total():.2f}"
        return resultado


# Demonstração do uso
def main():
    # Criando formas
    try:
        retangulo = Retangulo(5, 3)
        quadrado = Quadrado(4)
        circulo = Circulo(7)
        triangulo = Triangulo(3, 4, 5)
        
        # Usando composição para adicionar cor
        retangulo_vermelho = FormaColorida(retangulo, "vermelho")
        circulo_azul = FormaColorida(circulo, "azul")
        
        # Adicionando formas ao gerenciador
        gerenciador = GerenciadorFormas()
        gerenciador.adicionar_forma(retangulo)
        gerenciador.adicionar_forma(quadrado)
        gerenciador.adicionar_forma(circulo)
        gerenciador.adicionar_forma(triangulo)
        gerenciador.adicionar_forma(retangulo_vermelho)
        gerenciador.adicionar_forma(circulo_azul)
        
        # Exibindo informações
        print(gerenciador.listar_formas())
        
        # Demonstrando o tratamento de erro
        try:
            triangulo_invalido = Triangulo(1, 1, 10)  # Não é um triângulo válido
        except ValueError como e:
            print(f"\nErro ao criar triângulo: {e}")
            
    exceto Exception como e:
        print(f"Ocorreu um erro: {e}")


if __name__ == "__main__":
    main()
```

## Boas Práticas

=== "Quando Usar Herança"
    ```python
    # Use herança quando há uma relação clara "é um"
    
    # BOM: Um carro é um veículo
    class Veiculo:
        def __init__(self, marca, modelo):
            self.marca = marca
            self.modelo = modelo
            
        def mover(self):
            return "Veículo se movendo"
    
    class Carro(Veiculo):  # Um carro É UM veículo
        def __init__(self, marca, modelo, portas):
            super().__init__(marca, modelo)
            self.portas = portas
            
        def mover(self):
            return "Carro dirigindo na estrada"
    
    # RUIM: Uma loja não é um produto
    class Produto:
        def __init__(self, nome, preco):
            self.nome = nome
            self.preco = preco
    
    # Herança incorreta
    class Loja(Produto):  # Uma loja NÃO É um produto!
        def __init__(self, nome, endereco):
            super().__init__(nome, 0)  # Forçando a herança
            self.endereco = endereco
            self.produtos = []
    
    # MELHOR: Use composição em vez de herança quando não for "é um"
    class Loja:
        def __init__(self, nome, endereco):
            self.nome = nome
            self.endereco = endereco
            self.produtos = []  # Uma loja TEM produtos
            
        def adicionar_produto(self, produto):
            self.produtos.append(produto)
    ```

=== "Princípio de Substituição de Liskov"
    ```python
    # O Princípio de Substituição de Liskov (LSP) afirma que 
    # objetos de uma superclasse devem poder ser substituídos 
    # por objetos de uma subclasse sem afetar a correção do programa
    
    # Violação do LSP
    class Retangulo:
        def __init__(self, largura, altura):
            self._largura = largura
            self._altura = altura
        
        def get_largura(self):
            return self._largura
            
        def set_largura(self, largura):
            self._largura = largura
            
        def get_altura(self):
            return self._altura
            
        def set_altura(self, altura):
            self._altura = altura
            
        def area(self):
            return self._largura * self._altura
    
    class Quadrado(Retangulo):
        def __init__(self, lado):
            super().__init__(lado, lado)
            
        # Sobrescrevendo métodos para manter o quadrado válido
        def set_largura(self, largura):
            self._largura = largura
            self._altura = largura  # Altera altura também
            
        def set_altura(self, altura):
            self._altura = altura
            self._largura = altura  # Altera largura também
    
    # Função que usa Retangulo
    def aumentar_largura(retangulo):
        largura_original = retangulo.get_largura()
        altura_original = retangulo.get_altura()
        
        retangulo.set_largura(largura_original + 1)
        
        # Para um retângulo, apenas a largura muda
        # Para um quadrado, a altura também muda!
        return retangulo.area() == (largura_original + 1) * altura_original
    
    # Teste
    retangulo = Retangulo(5, 10)
    quadrado = Quadrado(5)
    
    print(f"Teste com retângulo: {aumentar_largura(retangulo)}")  # True
    print(f"Teste com quadrado: {aumentar_largura(quadrado)}")  # False - Viola o LSP!
    
    # Solução: hierarquia de classes diferente ou usar composição
    ```

=== "Favoreça Composição sobre Herança"
    ```python
    # A composição é frequentemente mais flexível que a herança
    
    # Abordagem com herança (pode ser inflexível)
    class Ave:
        def comer(self):
            return "Comendo sementes"
            
        def voar(self):
            return "Voando alto"
    
    class Pato(Ave):
        def nadar(self):
            return "Nadando no lago"
    
    class Pinguim(Ave):
        # Problema: pinguins não voam!
        def voar(self):
            return "Não posso voar!"  # Sobrescrever com comportamento nulo
            
        def nadar(self):
            return "Nadando no oceano gelado"
    
    # Abordagem com composição (mais flexível)
    class Comportamento:
        pass
    
    class Voo(Comportamento):
        def voar(self):
            return "Voando alto"
    
    class SemVoo(Comportamento):
        def voar(self):
            return "Não posso voar!"
    
    class Nado(Comportamento):
        def nadar(self):
            return "Nadando na água"
    
    class Alimentacao(Comportamento):
        def comer(self):
            return "Comendo sementes"
    
    class AnimalComposicao:
        def __init__(self, nome):
            self.nome = nome
            self.comportamentos = []
        
        def adicionar_comportamento(self, comportamento):
            self.comportamentos.append(comportamento)
        
        def voar(self):
            for c em self.comportamentos:
                if hasattr(c, 'voar'):
                    return c.voar()
            return "Este animal não tem comportamento de voo"
        
        def nadar(self):
            for c em self.comportamentos:
                if hasattr(c, 'nadar'):
                    return c.nadar()
            return "Este animal não tem comportamento de nado"
        
        def comer(self):
            for c em self.comportamentos:
                if hasattr(c, 'comer'):
                    return c.comer()
            return "Este animal não tem comportamento de alimentação"
    
    # Criando animais com composição
    pombo = AnimalComposicao("Pombo")
    pombo.adicionar_comportamento(Voo())
    pombo.adicionar_comportamento(Alimentacao())
    
    pinguim = AnimalComposicao("Pinguim")
    pinguim.adicionar_comportamento(SemVoo())
    pinguim.adicionar_comportamento(Nado())
    pinguim.adicionar_comportamento(Alimentacao())
    
    print(f"{pombo.nome}: {pombo.voar()}, {pombo.comer()}")
    # Pombo: Voando alto, Comendo sementes
    
    print(f"{pinguim.nome}: {pinguim.voar()}, {pinguim.nadar()}, {pinguim.comer()}")
    # Pinguim: Não posso voar!, Nadando na água, Comendo sementes
    ```

## Resumo

Nesta aula, você aprendeu sobre os seguintes tópicos:

- **Herança**: como criar hierarquias de classes e reutilizar código
- **Herança múltipla**: como uma classe pode herdar de várias classes pai e como o MRO funciona
- **O método super()**: como chamar métodos da classe pai, inclusive em herança múltipla
- **Polimorfismo**: como usar a mesma interface para diferentes tipos de objetos
- **Duck Typing**: como o Python trata o polimorfismo através de comportamentos em vez de tipos
- **Classes abstratas e interfaces**: como definir contratos para classes
- **Boas práticas**: como e quando usar herança e composição corretamente

!!! info "Recursos de aprendizado"
    - [Documentação Python sobre herança](https://docs.python.org/3/tutorial/classes.html#inheritance){:target="_blank"}
    - [Método Resolution Order (MRO)](https://www.python.org/download/releases/2.3/mro/){:target="_blank"}
    - [Documentação sobre ABC (Abstract Base Classes)](https://docs.python.org/3/library/abc.html){:target="_blank"}
    - [Real Python: Inheritance and Composition in Python](https://realpython.com/inheritance-composition-python/){:target="_blank"}
    - [Python Duck Typing](https://realpython.com/lessons/duck-typing/){:target="_blank"}

## Próximos Passos

Na próxima aula, iremos explorar o tópico de Testes em Python, aprendendo como verificar se nosso código funciona corretamente e como garantir a qualidade do software.

[Avance para a próxima aula →](/docs/trilhas/python/page-15)

[← Voltar para POO em Python](/docs/trilhas/python/page-13)
