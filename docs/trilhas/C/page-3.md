# 💻 Estruturas de Controle, Funções em C

## ✨ Introdução

As estruturas de controle e funções em C são fundamentais para a construção de programas eficientes e organizados. Elas permitem que você controle o fluxo de execução do seu código e reutilize trechos de código, tornando-o mais modular e fácil de entender.

!!! info "Objetivos de Aprendizado"
    - Entender as estruturas de controle em C, como `if`, `else if`, `else` e `switch`
    - Entender as estruturas de repetição em C, como `for`, `while` e `do-while`
    - Aprender a definir e utilizar funções em C
    - Compreender o conceito de escopo de variáveis
    - Praticar a criação de código organizado e reutilizável

## 💡 Estruturas de Controle

As estruturas de controle em C permitem que você controle o fluxo de execução do seu programa com base em condições específicas. As principais estruturas de controle incluem:

???+ "if, else if, else"
    A estrutura `if` permite executar um bloco de código se uma condição for verdadeira. Você pode usar `else if` para testar múltiplas condições e `else` para executar um bloco de código se todas as condições anteriores forem falsas.
    - A condição deve ser uma expressão que retorna um valor booleano (verdadeiro ou falso).
    - Pode incluir múltiplas condições usando operadores lógicos (&&, ||).
    - Pode ser aninhado, ou seja, um `if` dentro de outro `if`, `else if` ou `else`.
    - Pode incluir uma instrução `return` para sair da função atual.
    - Pode ser usado para verificar a validade de entradas do usuário.
    - Pode ser usado para controlar o fluxo de programas complexos.
    - Pode ser usado em conjunto com outras estruturas de controle, como loops.

=== "Exemplo de if, else if, else"
    ```c
    #include <stdio.h>

    int main() {
        int numero = 10;

        if (numero > 0) {
            printf("O número é positivo.\n");
        } else if (numero < 0) {
            printf("O número é negativo.\n");
        } else {
            printf("O número é zero.\n");
        }

        return 0;
    }
    ```
=== "Exemplo de if aninhado"
    ```c
    #include <stdio.h>

    int main() {
        int numero = 10;

        if (numero >= 0) {
            if (numero == 0) {
                printf("O número é zero.\n");
            } else {
                printf("O número é positivo.\n");
            }
        } else {
            printf("O número é negativo.\n");
        }

        return 0;
    }
    ```

=== "Exemplo de if com múltiplas condições com retorno"
    ```c
    #include <stdio.h>

    int verificarNumero(int numero) {
        if (numero > 0) {
            return 1; // Positivo
        } else if (numero < 0) {
            return -1; // Negativo
        } else {
            return 0; // Zero
        }
    }

    int main() {
        int num = -5;
        int resultado = verificarNumero(num);

        if (resultado == 1) {
            printf("O número é positivo.\n");
        } else if (resultado == -1) {
            printf("O número é negativo.\n");
        } else {
            printf("O número é zero.\n");
        }

        return 0;
    }
    ```


???+ "switch"
    A estrutura `switch` permite selecionar um bloco de código para executar com base no valor de uma variável. É uma alternativa ao uso de múltiplos `if` e `else if` quando você precisa comparar uma única variável com diferentes valores.

=== "Exemplo de switch"
    ```c
    #include <stdio.h>
    int main() {
        int dia = 3;

        switch (dia) {
            case 1:
                printf("Domingo\n");
                break;
            case 2:
                printf("Segunda-feira\n");
                break;
            case 3:
                printf("Terça-feira\n");
                break;
            default:
                printf("Outro dia\n");
        }

        return 0;
    }
    ```

## 💡 Funções

As funções em C são blocos de código reutilizáveis que realizam tarefas específicas. Elas ajudam a organizar o código, melhorar a legibilidade e facilitar a manutenção. A sintaxe básica para declarar uma função é:

???+ "Declaração de Função"
    - Tipo de Retorno: O tipo de dado que a função retorna (por exemplo, `int`, `void`, `float`).
    - Nome da Função: O nome que você dá à função.
    - Parâmetros: Uma lista de variáveis que a função recebe como entrada (opcional).
    - Corpo da Função: O bloco de código que define o que a função faz.

=== "Exemplo de Declaração de Função"
    ```c
    int soma(int a, int b) {
        return a + b;
    }

- Importante saber que nem toda função retorna um valor. Funções que não retornam valores são declaradas com o tipo de retorno `void`, mas não impossiblitam o uso de parâmetros.
    
=== "Exemplo de Função void"
    ```c
    void imprimirMensagem() {
        printf("Olá, Mundo!\n");
    }
    ```

=== "Exemplo de Declaração de Função com Estrutura de controle retorno vazio"
    ```c
    #include <stdio.h>

    void verificarNumero(int numero) {
        if (numero > 0) {
            printf("O número é positivo.\n");
            return; // Retorna vazio
        } else if (numero < 0) {
            printf("O número é negativo.\n");
            return; // Retorna vazio
        } else {
            printf("O número é zero.\n");
            return; // Retorna vazio
        }
    }

    int main() {
        int num = -5;
        verificarNumero(num);
        return 0; // Retorna 0 pois é a função main do tipo int
    }
    ```

## 💡 Funções de Repetição

As funções de repetição em C permitem executar um bloco de código várias vezes com base em uma condição. As principais estruturas de repetição incluem:

???+ "for"
    A estrutura `for` é usada para repetir um bloco de código um número específico de vezes. Ela é composta por três partes: inicialização, condição e incremento.
    - A inicialização define a variável de controle.
    - A condição é verificada antes de cada iteração.
    - A interação incrementa ou decrementa a variável de controle.
    - Pode incrementar e decrementar mais de uma variável na mesma estrutura.
    - Pode usar mais de uma condição na mesma estrutura, separando-as com o operador lógico AND (&&) ou OR (||).
    - Pode incluir uma instrução `break` para sair do loop antes que a condição seja falsa.
    - Pode ser rodada em loops aninhados (loops dentro de loops).
    - Pode usar a instrução `continue` para pular para a próxima iteração do loop.
    - Pode ser executada sem um bloco de código (loop vazio).

=== "Exemplo de for"
    ```c
    #include <stdio.h>

    int main() {
        for (int i = 0; i < 5; i++) {
            printf("Contagem: %d\n", i);
        }
        return 0;
    }
    ```

=== "Exemplo de for com mais de uma variável e condição"
    ```c
    #include <stdio.h>

    int main() {
        for (int i = 0, j = 10; i < 5 && j > 5; i++, j--) {
            printf("i: %d, j: %d\n", i, j);
        }
        return 0;
    }
    ```

=== "Exemplo de for com loop vazio"
    ```c
    #include <stdio.h>

    int main() {
        int i = 0;
        for (; i < 5; ) {
            printf("Contagem: %d\n", i);
            i++;
        }
        return 0;
    }
    ```
=== "Exemplo de for com break e continue"
    ```c
    #include <stdio.h>

    int main() {
        for (int i = 0; i < 10; i++) {
            if (i == 5) {
                break; // Sai do loop quando i é 5
            }
            if (i % 2 == 0) {
                continue; // Pula números pares
            }
            printf("Número ímpar: %d\n", i);
        }
        return 0;
    }
    ```

=== "Exemplo de for aninhado"
    ```c
    #include <stdio.h>

    int main() {
        for (int i = 1; i <= 3; i++) {
            for (int j = 1; j <= 2; j++) {
                printf("i: %d, j: %d\n", i, j);
            }
        }
        return 0;
    }
    ```
=== "Exemplo de for decrementando"
    ```c
    #include <stdio.h>

    int main() {
        for (int i = 5; i > 0; i--) {
            printf("Contagem regressiva: %d\n", i);
        }
        return 0;
    }
    ```
=== "Exemplo de for infinito"
    ```c
    #include <stdio.h>

    int main() {
        for (;;) {
            printf("Loop infinito. Pressione Ctrl+C para sair.\n");
        } // valido apenas em sistemas que suportam interrupção manual
        return 0;
    }
    ```

???+ "while"
    A estrutura `while` repete um bloco de código enquanto uma condição for verdadeira.
    - A condição pode ser verificada antes (loop `while`) ou depois (loop `do-while`) da execução do bloco de código.
    - Pode usar mais de uma condição na mesma estrutura, separando-as com o operador lógico AND (&&) ou OR (||).
    - Pode incluir uma instrução `break` para sair do loop antes que a condição seja falsa.
    - Pode ser rodada em loops aninhados (loops dentro de loops).
    - Pode usar a instrução `continue` para pular para a próxima iteração do loop.
    - Pode ser executada sem um bloco de código (loop vazio).
    - No loop `do-while`, o bloco de código é executado pelo menos uma vez, independentemente da condição.
    - Pode ser usado para criar loops infinitos.
    - Pode decrementar a variável de controle.

=== "Exemplo de while antes da execução"
    ```c
    #include <stdio.h>

    int main() {
        int i = 0;
        while (i < 5) {
            printf("Contagem: %d\n", i);
            i++;
        }
        return 0;
    }
    ```
=== "Exemplo de do-while depois da execução"
    ```c
    #include <stdio.h>

    int main() {
        int i = 0;
        do {
            printf("Contagem: %d\n", i);
            i++;
        } while (i < 5);
        return 0;
    }
    ```
=== "Exemplo de while com mais de uma condição"
    ```c
    #include <stdio.h>

    int main() {
        int i = 0, j = 10;
        while (i < 5 && j > 5) {
            printf("i: %d, j: %d\n", i, j);
            i++;
            j--;
        }
        return 0;
    }
    ```
=== "Exemplo de while com loop vazio"
    ```c
    #include <stdio.h>

    int main() {
        int i = 0;
        while (i < 5) {
            printf("Contagem: %d\n", i);
            i++;
        }
        return 0;
    }
    ```
=== "Exemplo de while com break e continue"
    ```c
    #include <stdio.h>

    int main() {
        int i = 0;
        while (i < 10) {
            if (i == 5) {
                break; // Sai do loop quando i é 5
            }
            if (i % 2 == 0) {
                i++;
                continue; // Pula números pares
            }
            printf("Número ímpar: %d\n", i);
            i++;
        }
        return 0;
    }
    ```

=== "Exemplo de while aninhado"
    ```c
    #include <stdio.h>

    int main() {
        int i = 1;
        while (i <= 3) {
            int j = 1;
            while (j <= 2) {
                printf("i: %d, j: %d\n", i, j);
                j++;
            }
            i++;
        }
        return 0;
    }
    ```

=== "Exemplo de while infinito"
    ```c
    #include <stdio.h>

    int main() {
        while (1) {
            printf("Loop infinito. Pressione Ctrl+C para sair.\n");
        } // valido apenas em sistemas que suportam interrupção manual
        return 0;
    }
    ```

=== "Exemplo de while decrementando"
    ```c
    #include <stdio.h>

    int main() {
        int i = 5;
        while (i > 0) {
            printf("Contagem regressiva: %d\n", i);
            i--;
        }
        return 0;
    }
    ```

## 💡 Funções basicas em C

Aqui estão algumas funções básicas em C que são frequentemente usadas:

???+ "printf()"
    A função `printf()` é usada para imprimir texto e variáveis na saída padrão (geralmente o console).

=== "Exemplo de printf()"
    ```c
    #include <stdio.h>
    int main() {
        int idade = 25;
        printf("A idade é: %d\n", idade);
        return 0;
    }
    ```

???+ "scanf()"
    A função `scanf()` é usada para ler a entrada do usuário a partir do console.

=== "Exemplo de scanf()"
    ```c
    #include <stdio.h>
    int main() {
        int idade;
        printf("Digite sua idade: ");
        scanf("%d", &idade);
        printf("Você digitou: %d\n", idade);
        return 0;
    }
    ```

???+ "main()"
    A função `main()` é o ponto de entrada de qualquer programa em C. É onde a execução do programa começa. Todo programa em C deve ter uma função `main()`, que pode ou não receber argumentos.

=== "Exemplo de main()"
    ```c
    #include <stdio.h>
    int main() {
        printf("Olá, Mundo!\n");
        return 0;
    }
    ```

## ⚑ Funções de texto e char em C

???+ "strlen()"
    A função `strlen()` retorna o comprimento de uma string (número de caracteres, excluindo o caractere nulo).
=== "Exemplo de strlen()"
    ```c
    #include <stdio.h>
    #include <string.h>

    int main() {
        char texto[] = "Olá, Mundo!";
        int comprimento = strlen(texto);
        printf("O comprimento da string é: %d\n", comprimento);
        return 0;
    }
    ```

???+ "strcpy()"
    A função `strcpy()` copia o conteúdo de uma string para outra.

=== "Exemplo de strcpy()"
    ```c
    #include <stdio.h>
    #include <string.h>

    int main() {
        char origem[] = "Olá, Mundo!";
        char destino[50];
        strcpy(destino, origem);
        printf("Conteúdo da string de destino: %s\n", destino);
        return 0;
    }
    ```
???+ "strcat()"
    A função `strcat()` concatena (anexa) uma string ao final de outra.

=== "Exemplo de strcat()"
    ```c
    #include <stdio.h>
    #include <string.h>

    int main() {
        char str1[50] = "Olá, ";
        char str2[] = "Mundo!";
        strcat(str1, str2);
        printf("String concatenada: %s\n", str1);
        return 0;
    }
    ```

???+ "strcmp()"
    A função `strcmp()` compara duas strings e retorna um valor inteiro que indica a relação entre elas.

=== "Exemplo de strcmp()"
    ```c
    #include <stdio.h>
    #include <string.h>

    int main() {
        char str1[] = "Olá";
        char str2[] = "Mundo";
        int resultado = strcmp(str1, str2);
        if (resultado < 0) {
            printf("'%s' é menor que '%s'\n", str1, str2);
        } else if (resultado > 0) {
            printf("'%s' é maior que '%s'\n", str1, str2);
        } else {
            printf("'%s' é igual a '%s'\n", str1, str2);
        }
        return 0;
    }
    ```
???+ "sprintf()"
    A função `sprintf()` é usada para formatar uma string e armazená-la em um buffer.

=== "Exemplo de sprintf()"
    ```c
    #include <stdio.h>

    int main() {
        char buffer[100];
        int idade = 25;
        sprintf(buffer, "A idade é: %d", idade);
        printf("%s\n", buffer);
        return 0;
    }
    ```

???+ "snprintf()"
    A função `snprintf()` é semelhante à `sprintf()`, mas permite especificar o tamanho máximo do buffer para evitar estouro de buffer.

=== "Exemplo de snprintf()"
    ```c
    #include <stdio.h>

    int main() {
        char buffer[10];
        int idade = 25;
        snprintf(buffer, sizeof(buffer), "Idade: %d", idade);
        printf("%s\n", buffer);
        return 0;
    }
    ```

Foram apresentadas algumas das principais funções de manipulação de strings e caracteres em C. A documentação é uma ótima fonte para explorar mais funções e suas funcionalidades.

## 𝞹 Funções Matemáticas em C

Aqui estão algumas funções matemáticas básicas em C, disponíveis na biblioteca `<math.h>`:

???+ "sqrt()"
    A função `sqrt()` calcula a raiz quadrada de um número.

=== "Exemplo de sqrt()"
    ```c
    #include <stdio.h>
    #include <math.h>

    int main() {
        double numero = 25.0;
        double raiz = sqrt(numero);
        printf("A raiz quadrada de %.2f é %.2f\n", numero, raiz);
        return 0;
    }
    ```

???+ "pow()"
    A função `pow()` eleva um número a uma potência especificada.

=== "Exemplo de pow()"
    ```c
    #include <stdio.h>
    #include <math.h>

    int main() {
        double base = 2.0;
        double expoente = 3.0;
        double resultado = pow(base, expoente);
        printf("%.2f elevado a %.2f é %.2f\n", base, expoente, resultado);
        return 0;
    }
    ```

## ⚑ Funções de Locais em C

Aqui estão algumas funções relacionadas a locais (locales) em C, disponíveis na biblioteca `<locale.h>`:

???+ "setlocale()"
    A função `setlocale()` é usada para definir ou obter a configuração regional (locale) do programa.

=== "Exemplo de setlocale()"
    ```c
    #include <stdio.h>
    #include <locale.h>

    int main() {
        setlocale(LC_ALL, "pt_BR.UTF-8");
        printf("Configuração regional definida para Português do Brasil.\n");
        return 0;
    }
    ```

???+ "localeconv()"
    A função `localeconv()` retorna um ponteiro para uma estrutura que contém informações sobre a configuração regional atual.

=== "Exemplo de localeconv()"
    ```c
    #include <stdio.h>
    #include <locale.h>

    int main() {
        struct lconv *config = localeconv();
        printf("Moeda: %s\n", config->currency_symbol);
        printf("Decimal Point: %s\n", config->decimal_point);
        return 0;
    }
    ```

Essas funções ajudam a adaptar o comportamento do programa às convenções culturais e regionais, como formatos de data, moeda e números.

## 💡 Funções próprias

???+ "Definição e Uso de Funções"
    - Funções são definidas para encapsular blocos de código que realizam tarefas específicas.
    - Permitem a reutilização de código, facilitando a manutenção e a organização do programa.
    - Podem receber parâmetros para trabalhar com diferentes dados.
    - Podem retornar valores para fornecer resultados ao chamador.
    - A definição de uma função inclui o tipo de retorno, nome da função, lista de parâmetros (se houver) e o corpo da função.
    - Funções podem ser chamadas de qualquer parte do programa, desde que estejam declaradas ou definidas antes da chamada.
    - O escopo das variáveis dentro de uma função é local, ou seja, elas só são acessíveis dentro da função.
    - Funções podem ser recursivas, ou seja, podem chamar a si mesmas para resolver problemas.
    - Protótipos de função podem ser usados para declarar funções antes de sua definição, facilitando a organização do código.
    - Funções podem ser agrupadas em bibliotecas para reutilização em diferentes programas.

=== "Exemplo de Função Própria"
    ```c
    #include <stdio.h>

    // Protótipo da função
    int soma(int a, int b);

    int main() {
        int resultado = soma(5, 10);
        printf("A soma é: %d\n", resultado);
        return 0;
    }

    // Definição da função
    int soma(int a, int b) {
        return a + b;
    }
    ```

=== "Exemplo de Função Recursiva"
    ```c
    #include <stdio.h>

    // Protótipo da função
    int fatorial(int n);

    int main() {
        int numero = 5;
        int resultado = fatorial(numero);
        printf("O fatorial de %d é: %d\n", numero, resultado);
        return 0;
    }

    // Definição da função recursiva
    int fatorial(int n) {
        if (n == 0) {
            return 1; // Caso base
        } else {
            return n * fatorial(n - 1); // Chamada recursiva
        }
    }
    ```

=== "Exemplo de função de texto própria"
    ```c
    #include <stdio.h>

    // Protótipo da função
    void imprimirMensagem(char mensagem[]);

    int main() {
        imprimirMensagem("Olá, Mundo!");
        return 0;
    }

    // Definição da função
    void imprimirMensagem(char mensagem[]) {
        printf("%s\n", mensagem);
    }
    ```


## 🎯 Resumo

Neste capítulo, exploramos as estruturas de controle, funções e escopo em C. Vimos como usar estruturas de controle como `if`, `else if`, `else` e `switch` para controlar o fluxo do programa. Também aprendemos sobre a definição e uso de funções, incluindo funções que retornam valores e funções `void`. 

Discutimos algumas funções básicas em C, incluindo funções de manipulação de strings, funções matemáticas e funções relacionadas a locais. Com esse conhecimento, você está melhor equipado para escrever programas em C mais organizados e eficientes.

Agora, vamos continuar nossa jornada na programação em C com mais tópicos avançados nos próximos capítulos!

## Próximos Passos

Continue aprofundando seus conhecimentos em C! Na próxima aula, vamos, aprofundar no uso do conhecimento adquirido até aqui.

[📂 Avance para a próxima aula →](./page-4.md)