# Orientação a Objetos com Python

## Resumo

Programação orientada a objetos (POO) é um paradigma de programação baseado no conceito de "objetos", que podem conter dados na forma de campos, também conhecidos como atributos, e códigos, na forma de procedimentos, também conhecidos como métodos.

### Exemplos

Uma fábrica de carros simples que reaproveita peças como motor, rodas e faróis para montar carros novos:

```python
class Carro:
    def __init__(self, motor, rodas, farois):
        self.motor = motor
        self.rodas = rodas
        self.farois = farois

    def ligar(self):
        print("Carro ligado")

    def desligar(self):
        print("Carro desligado")
```

Agora essa fábrica de carros realiza o lançamento de dois modelos o CarrãoDeLuxo e o CarrãoDeSom, sendo que o CarrãoDeLuxo possui atributos a mais como banco de couro e painel de TV, e o CarrãoDeSom possui equipamentos de drift.

```python
class CarraoDeLuxo(Carro):
    def __init__(self, motor, rodas, farois, banco_de_couro, painel_de_tv):
        super().__init__(motor, rodas, farois)
        self.banco_de_couro = banco_de_couro
        self.painel_de_tv = painel_de_tv

    def abrir_teto_solar(self):
        print("Teto solar aberto")

    def fechar_teto_solar(self):
        print("Teto solar fechado")

class CarraoDeSom(Carro):
    def __init__(self, motor, rodas, farois, equipamentos_de_drift):
        super().__init__(motor, rodas, farois)
        self.equipamentos_de_drift = equipamentos_de_drift

    def ativar_drift(self):
        print("Drift ativado")

    def desativar_drift(self):
        print("Drift desativado")
```


## Referências

- [Classes](https://panda.ime.usp.br/pensepy/static/pensepy/13-Classes/classesintro.html)

- [Python Orientado a Objetos com Framework CherryPy](https://www.devmedia.com.br/python-orientado-a-objetos-com-o-framework-cherrypy/33489)

- [Programação Orientada a Objetos com Python](https://wiki.python.org.br/ProgramacaoOrientadaObjetoPython)
