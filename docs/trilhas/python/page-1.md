<script type="text/javascript" src="https://cdn.datacamp.com/dcl-react.js.gz"></script>
<script>
initAddedDCLightExercises();
</script>

# Variáveis e Tipos de Dados em Python

## Resumo

Uma variável é um espaço na memória do computador destinado a um dado que é alterado durante a execução do algoritmo. Para funcionar corretamente, as variáveis precisam ser definidas por nomes e tipos. Nesta aula iremos estudar os tipos de variáveis e suas diferenças.

## Playground

<div data-datacamp-exercise data-lang="python">
	<code data-type="pre-exercise-code">
		texto = "Hello World!"
        number = 42
        float_number = 3.14
        true_or_false = True
        false_or_true = False
        lista_de_numeros = [1, 2, 3, 4, 5]
        dicionario = {"nome": "João", "idade": 25}
	</code>
	<code data-type="sample-code">
		# Remova o # das linhas e verifique o valores das variáveis!
		# print(texto)
        # print(number)
        # print(float_number)
        # print(true_or_false)
        # print(false_or_true)
        # print(lista_de_numeros)
        # print(dicionario)

        # Também é possível verificar o tipo de uma variável! Lembrando que essas variáveis estão funcionando porque foram pré-definidas.
        # print(type(texto))
        # print(type(number))
        # print(type(true_or_false))
        # print(type(false_or_true))
        # print(type(lista_de_numeros))
        # print(type(dicionario))
	</code>
	<code data-type="solution">
		print(texto)
        print(number)
        print(float_number)
        print(true_or_false)
        print(false_or_true)
        print(lista_de_numeros)
        print(dicionario)
        print(type(texto))
        print(type(number))
        print(type(true_or_false))
        print(type(false_or_true))
        print(type(lista_de_numeros))
        print(type(dicionario))
	</code>
	<code data-type="sct">
		test_function("print")
		success_msg("Parabéns! Você imprimiu as variáveis e seus tipos!")
	</code>
	<div data-type="hint">Remova o # das linhas, e veja como se comportam as variáveis!</div>
</div>