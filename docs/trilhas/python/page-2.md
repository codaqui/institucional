<script type="text/javascript" src="https://cdn.datacamp.com/dcl-react.js.gz"></script>
<script>
initAddedDCLightExercises();
</script>
# Estruturas Lógicas e Condicionais em Python

## Resumo

As estruturas condicionais permitem que um programa execute diferentes comandos de acordo com as condições estabelecidas. Aqui, estudaremos suas aplicações e formatos.

!!! note

    Quer saber como comentar ou "descomentar" várias linhas de código ao mesmo tempo? Use ++ctrl+"/"++ no Windows e Linux, ou ++cmd+"/"++ no MacOS.

## Playground

<div data-datacamp-exercise data-lang="python">
	<code data-type="pre-exercise-code">
		numero = 10
	</code>
	<code data-type="sample-code">
		# As estruturas lógicas e condicionais são muito importantes na programação.
        # Vamos verificar se um número é par ou ímpar.
        # Remova o # das linhas abaixo e veja o resultado!

        # if numero % 2 == 0:
        #     print("O número é par.")
        # else:
        #     print("O número é ímpar.")
	</code>
	<code data-type="solution">
		if numero % 2 == 0:
		    print("O número é par.")
		else:
		    print("O número é ímpar.")
	</code>
	<code data-type="sct">
        Ex().has_output("O número é par.", pattern=False)
		success_msg("Parabéns! Você aprendeu a usar estruturas lógicas e condicionais em Python!")
	</code>
	<div data-type="hint">Remova o # das linhas, e veja como se comportam as estruturas lógicas e condicionais!</div>
</div>


## Referências

- [Estruturas e Condicionais - #Treinamentos](https://www.hashtagtreinamentos.com/estruturas-condicionais-no-python)

- [Operadores Lógicos - Caravela](https://pense-python.caravela.club/05-condicionais-e-recursividade/00-condicionais-e-recursividade.html)

