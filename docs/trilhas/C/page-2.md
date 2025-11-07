# 💻 Estruturas de dados em C

## ✨ Introdução

Variáveis são espaços nomeados na memória do computador que armazenam dados que podem ser modificados durante a execução de um programa. Elas são fundamentais para a programação, permitindo que os desenvolvedores armazenem, manipulem e recuperem informações conforme necessário.

!!! info "Objetivos de Aprendizado"
    - Compreender os fundamentos da linguagem C
    - Aprender sobre variáveis e tipos de dados em C
    - Desenvolver habilidades para criar programas simples em C

Usaremos algumas funções básicas da biblioteca padrão do C ainda não abordadas, como `printf` para exibir mensagens no console, `strcpy` para copiar strings, `if` para estruturas condicionais, e `return` para finalizar funções. Essas funções são definidas em arquivos de cabeçalho (headers) que precisam ser incluídos no início do código usando a diretiva `#include`.

Sem mais delongas, vamos começar a explorar os conceitos básicos da linguagem C!

## 💡 O que são Variáveis e Tipos de Dados em C?

Em C, uma variável é um espaço na memória que armazena um valor. Cada variável tem um tipo de dado associado, que determina o tamanho e o formato dos dados que podem ser armazenados nela. Os tipos de dados em C podem ser classificados em três categorias principais:

???+ "Tipos de Dados em C"
    - **Tipos Primitivos**: Incluem `int` (inteiros), `float` (números de ponto flutuante), `char` (caracteres) e `double` (números de ponto flutuante de precisão dupla).
    - **Tipos Compostos**: Incluem arrays (coleções de elementos do mesmo tipo) e structs (agrupamentos de variáveis de diferentes tipos).
    - **Tipos Derivados**: Incluem ponteiros (variáveis que armazenam endereços de memória) e funções.

=== "Conceitos Básicos"
    ```c
    // Exemplos de declaração de variáveis em C
    int idade = 30;
    double salario = 4500.50;
    float altura = 1.75;
    char inicial = 'J';
    char nome[50] = "João";
    char *sobrenome = "Silva";

    struct Pessoa {
        char nome[50];
        int idade;
    };

    // Exibindo os valores das variáveis
    printf("Nome: %s\n", nome);
    printf("Sobrenome: %s\n", sobrenome);
    printf("Idade: %d\n", idade);
    printf("Salário: %.2f\n", salario);
    printf("Altura: %.2f\n", altura);
    printf("Inicial: %c\n", inicial);

    struct Pessoa pessoa;
    strcpy(pessoa.nome, "João");
    pessoa.idade = 30;

    printf("Nome: %s\n", pessoa.nome);
    printf("Idade: %d\n", pessoa.idade);
    ```

## 💡 Regras para Nomes de Variáveis em C

???+ "Regras para Nomes de Variáveis em C"
    - Devem começar com uma letra (A-Z, a-z) ou um sublinhado (_).
    - Podem conter letras, dígitos (0-9) e sublinhados.
    - Não podem conter espaços ou caracteres especiais (como !, @, #, $, %, etc.).
    - Não podem ser iguais a palavras reservadas da linguagem C (como int, float, return, etc.).
    - São sensíveis a maiúsculas e minúsculas (por exemplo, idade e Idade são variáveis diferentes).
    - Devem ser descritivos e significativos para facilitar a leitura do código.

=== "Exemplos de Nomes Válidos e Inválidos"
    ```c
    // Nomes válidos
    int idade;
    float salario_mensal;
    char inicialNome;

    // Nomes inválidos
    int 2idade;          // Começa com um dígito
    float salario-mensal; // Contém um caractere especial '-'
    char nome completo;   // Contém um espaço
    int return;          // Palavra reservada
    ```

## 💡 Operadores em C

Os operadores em C são símbolos que realizam operações em variáveis e valores. Eles podem ser classificados em várias categorias, incluindo operadores aritméticos, de atribuição, de comparação, lógicos e bitwise.(Pode parecer complexo no começo, mas com prática você vai pegar o jeito!)

???+ "Tipos de Operadores em C"
    - **Operadores Aritméticos**: Usados para realizar operações matemáticas básicas, como adição (`+`), subtração (`-`), multiplicação (`*`), divisão (`/`) e módulo (`%`).
    - **Operadores de Atribuição**: Usados para atribuir valores a variáveis, como o operador de atribuição simples (`=`) e operadores compostos como `+=`, `-=`, `*=`, `/=`, etc.
    - **Operadores de Comparação**: Usados para comparar valores, como igual a (`==`), diferente de (`!=`), maior que (`>`), menor que (`<`), maior ou igual a (`>=`), e menor ou igual a (`<=`).
    - **Operadores Lógicos**: Usados para combinar expressões booleanas, como E lógico (`&&`), OU lógico (`||`), e NÃO lógico (`!`).
    - **Operadores Bitwise**: Usados para manipular bits individuais em valores inteiros, como AND bit a bit (`&`), OR bit a bit (`|`), XOR bit a bit (`^`), deslocamento à esquerda (`<<`), e deslocamento à direita (`>>`).

=== "Exemplos de Operadores em C"
    ```c
    #include <stdio.h>

    int main() {
        int a = 10, b = 5;
        int soma = a + b;           // Operador Aritmético
        a += 2;                     // Operador de Atribuição
        int igual = (a == b);      // Operador de Comparação
        int logico = (a > b) && (b > 0); // Operador Lógico
        int bitwise = a & b;       // Operador Bitwise

        printf("Soma: %d\n", soma);
        printf("Novo valor de a: %d\n", a);
        printf("Igualdade: %d\n", igual);
        printf("Lógico: %d\n", logico);
        printf("Bitwise: %d\n", bitwise);

        return 0;
    }
    ```

## 💡 Tamanho dos Tipos em C

Os tamanhos dos tipos de dados em C podem variar dependendo da arquitetura do sistema (32 bits, 64 bits, etc.) e do compilador utilizado. No entanto, existem tamanhos típicos para os tipos de dados primitivos em muitas plataformas comuns:

???+ "Tamanhos Típicos dos Tipos de Dados em C"
    - `char`: 1 byte (8 bits)
    - `int`: 4 bytes (32 bits) em muitas plataformas, mas pode variar
    - `short`: 2 bytes (16 bits)
    - `long`: 4 bytes (32 bits) ou 8 bytes (64 bits), dependendo da plataforma
    - `float`: 4 bytes (32 bits)
    - `double`: 8 bytes (64 bits)
    - `long double`: 10, 12 ou 16 bytes, dependendo da implementação

É importante notar que o operador `sizeof` pode ser usado para determinar o tamanho de um tipo de dado em bytes em tempo de compilação. Por exemplo:

=== "Usando o operador sizeof"
    ```c
    #include <stdio.h>

    int main() {
        printf("Tamanho de char: %zu byte(s)\n", sizeof(char));
        printf("Tamanho de int: %zu byte(s)\n", sizeof(int));
        printf("Tamanho de short: %zu byte(s)\n", sizeof(short));
        printf("Tamanho de long: %zu byte(s)\n", sizeof(long));
        printf("Tamanho de float: %zu byte(s)\n", sizeof(float));
        printf("Tamanho de double: %zu byte(s)\n", sizeof(double));

        return 0;
    }
    ```
    Isso exibirá o tamanho dos tipos de dados na plataforma específica onde o código é compilado e executado.

## 💡 Memory Overflow / Truncamento de Dados

O memory overflow (estouro de memória) e o truncamento de dados são problemas comuns que podem ocorrer em programas escritos em C devido ao uso inadequado de tipos de dados e alocação de memória.

=== "Memory Overflow"
    ```c
    #include <stdio.h>
    #include <string.h>

    int main() {
        char buffer[10];
        strcpy(buffer, "Esta string é muito longa e causará um overflow!");
        printf("%s\n", buffer);
        return 0;
    }
    ```
    Neste exemplo, a função `strcpy` copia uma string maior do que o tamanho do buffer alocado (10 bytes), resultando em um estouro de memória. Isso pode corromper dados adjacentes na memória e levar a comportamentos imprevisíveis do programa.

=== "Truncamento de Dados"
    ```c
    #include <stdio.h>

    int main() {
        int grandeNumero = 300;
        char pequenoNumero = (char)grandeNumero; // Truncamento de dados
        printf("Valor truncado: %d\n", pequenoNumero);
        return 0;
    }
    ```
    Neste exemplo, um número inteiro maior (300) é convertido para um tipo `char`, que geralmente pode armazenar valores de -128 a 127. O valor é truncado, resultando em um valor incorreto (-56 neste caso).

#### 💡 Dicas para Evitar Problemas de Overflow e Truncamento
1. **Use Tipos de Dados Adequados**: Escolha tipos de dados que possam acomodar os valores que você espera manipular.
2. **Verifique Limites**: Sempre verifique se os valores estão dentro dos limites antes de realizar operações que possam causar overflow ou truncamento.

3. **Utilize Funções Seguras**: Prefira funções que realizam verificações de limites, como `snprintf` em vez de `sprintf`, para evitar estouros de buffer (falaremos mais sobre isso depois!).

4. **Teste e Valide**: Realize testes rigorosos para identificar possíveis pontos de falha relacionados a overflow e truncamento.

## 💡 O que é um ponteiro

Um ponteiro em C é uma variável que armazena o endereço de memória de outra variável. Eles são usados para manipular diretamente a memória, permitindo a criação de estruturas de dados dinâmicas, passagem eficiente de grandes estruturas para funções e manipulação de arrays.

???+ "Conceitos Básicos de Ponteiros"
    - Declaração: Um ponteiro é declarado usando o operador asterisco (`*`). Por exemplo, `int *p` declara um ponteiro para um inteiro.
    - Atribuição: O operador de endereço (`&`) é usado para obter o endereço de uma variável. Por exemplo, `p = &x` atribui o endereço da variável `x` ao ponteiro `p`.
    - Desreferenciação: O operador asterisco (`*`) também é usado para acessar o valor armazenado no endereço apontado pelo ponteiro. Por exemplo, `*p` retorna o valor de `x` se `p` aponta para `x`.
    - Ponteiros e Arrays: O nome de um array pode ser usado como um ponteiro para o primeiro elemento do array. Isso permite a manipulação eficiente de arrays usando aritmética de ponteiros.
    - Ponteiros Nulos: Um ponteiro nulo (`NULL`) é um ponteiro que não aponta para nenhum endereço válido. É importante verificar se um ponteiro é nulo antes de usá-lo para evitar erros de segmentação.

=== "Exemplo de Ponteiros em C"
    ```c
    #include <stdio.h>

    int main() {
        int x = 10;
        int *p = &x;

        printf("Valor de x: %d\n", x);
        printf("Valor de p: %d\n", *p);

        *p = 20;
        printf("Novo valor de x: %d\n", x);

        return 0;
    }
    ```

## 💡 Array em C

Arrays e structs são dois tipos compostos em C que permitem agrupar múltiplos valores sob um único nome.

???+ "Arrays em C"
    - Um array é uma coleção de elementos do mesmo tipo, armazenados em locais de memória contíguos.
    - Os elementos do array são acessados usando um índice, que começa em 0.
    - Arrays podem ser unidimensionais (vetores) ou multidimensionais (matrizes).
    - Arrays são úteis para armazenar listas de valores, como números, caracteres ou outros tipos de dados.
    - O tamanho do array deve ser definido no momento da declaração e não pode ser alterado posteriormente.

=== "Exemplo de Array Interger"
    ```c
    #include <stdio.h>

    int main() {
        int numeros[5] = {10, 20, 30, 40, 50};

        for(int i = 0; i < 5; i++) {
            printf("Número %d: %d\n", i, numeros[i]);
        }

        return 0;
    }
    ```
=== Exemple "Exemplo de Array de Caracteres (String)"
    ```c
    #include <stdio.h>

    int main() {
        char nome[20] = "João Silva";

        printf("Nome: %s\n", nome);

        return 0;
    }
    ```

## 💡 Struct em C

???+ "Structs em C"
    - Uma struct (estrutura) é um agrupamento de variáveis de diferentes tipos sob um único nome.
    - As variáveis dentro de uma struct são chamadas de membros.
    - Structs são úteis para representar objetos ou entidades com múltiplas propriedades.
    - Membros de uma struct são acessados usando o operador ponto (`.`).
    - Podem ser apontadas por ponteiros para facilitar a manipulação e passagem para funções.
    - typedef pode ser usado para criar um novo nome para uma struct, simplificando sua declaração.

=== "Exemplo de Struct"
    ```c
    #include <stdio.h>

    struct Pessoa {
        char nome[50];
        int idade;
    };

    int main() {
        struct Pessoa p1;

        // Atribuindo valores aos membros da struct
        snprintf(p1.nome, sizeof(p1.nome), "João Silva");
        p1.idade = 30;

        // Exibindo os valores
        printf("Nome: %s\n", p1.nome);
        printf("Idade: %d\n", p1.idade);

        return 0;
    }
    ```

=== "Exemplo de Struct typedef"
    ```c
    #include <stdio.h>

    typedef struct {
        char nome[50];
        int idade;
    } Pessoa;

    int main() {
        Pessoa p1;

        // Atribuindo valores aos membros da struct
        snprintf(p1.nome, sizeof(p1.nome), "Carlos Pereira");
        p1.idade = 28;

        // Exibindo os valores
        printf("Nome: %s\n", p1.nome);
        printf("Idade: %d\n", p1.idade);

        return 0;
    }
    ```

=== "Exemplo de Struct com Ponteiro"
    ```c
    #include <stdio.h>

    struct Pessoa {
        char *nome;
        int idade;
    };

    int main() {
        struct Pessoa p1;

        // Atribuindo valores aos membros da struct
        p1.nome = "Maria Souza";
        p1.idade = 25;

        // Exibindo os valores
        printf("Nome: %s\n", p1.nome);
        printf("Idade: %d\n", p1.idade);

        return 0;
    }
    ```

=== "Exemplo de Struct com Array"
    ```c
    #include <stdio.h>

    struct Turma {
        char nome[50];
        int idades[5];
    };

    int main() {
        struct Turma t1;

        // Atribuindo valores aos membros da struct
        snprintf(t1.nome, sizeof(t1.nome), "Turma A");
        t1.idades[0] = 20;
        t1.idades[1] = 21;
        t1.idades[2] = 22;
        t1.idades[3] = 23;
        t1.idades[4] = 24;

        // Exibindo os valores
        printf("Nome da Turma: %s\n", t1.nome);
        for(int i = 0; i < 5; i++) {
            printf("Idade %d: %d\n", i + 1, t1.idades[i]);
        }

        return 0;
    }
    ```

## 💡 enum

Um `enum` (enumeração) em C é um tipo de dado definido pelo usuário que consiste em um conjunto de constantes inteiras nomeadas. Ele é usado para representar um grupo de valores relacionados de forma mais legível e organizada.

???+ "Conceitos Básicos de enum"
    - Declaração: Um `enum` é declarado usando a palavra-chave `enum`, seguida pelo nome do enum e uma lista de constantes entre chaves.
    - Valores Padrão: Por padrão, o primeiro valor em um enum é atribuído a 0, o segundo a 1, e assim por diante. No entanto, você pode atribuir valores específicos a cada constante.
    - Uso: Enums são úteis para representar estados, opções ou categorias em um programa, tornando o código mais fácil de entender.

=== "Exemplo de enum em C"
    ```c
    #include <stdio.h>

    enum DiaDaSemana {
        DOMINGO,
        SEGUNDA,
        TERCA,
        QUARTA,
        QUINTA,
        SEXTA,
        SABADO
    };

    int main() {
        enum DiaDaSemana hoje = QUARTA;

        if (hoje == QUARTA) {
            printf("Hoje é quarta-feira.\n");
        }

        return 0;
    }
    ```
=== "Exemplo de enum com valores específicos typedef"
    ```c
    #include <stdio.h>

    typedef enum {
        DOMINGO = 1,
        SEGUNDA,
        TERCA,
        QUARTA,
        QUINTA,
        SEXTA,
        SABADO
    } DiaDaSemana;

    int main() {
        DiaDaSemana hoje = QUARTA;

        if (hoje == QUARTA) {
            printf("Hoje é quarta-feira.\n");
        }

        return 0;
    }
    ```

## 💡 Escopo / Declaração de Variáveis Globais

O escopo em C refere-se à visibilidade e ao tempo de vida das variáveis dentro do programa. Existem dois tipos principais de escopo:

???+ "Escopo Local"
    Variáveis declaradas dentro de uma função ou bloco de código têm escopo local. Elas só podem ser acessadas dentro dessa função ou bloco.
    - Exemplo: A variável `x` na função `funcao` não pode ser acessada fora dela.
    
=== "Exemplo de Escopo Local"
    ```c
    #include <stdio.h>
    void funcao() {
        int x = 10; // Variável local
        printf("Valor de x dentro da função: %d\n", x);
    }
    int main() {
        funcao();
        // printf("Valor de x fora da função: %d\n", x); // Isso causaria um erro
        return 0;
    }
    ```
???+ "Escopo Global"
    Variáveis declaradas fora de todas as funções têm escopo global. Elas podem ser acessadas por qualquer função dentro do mesmo arquivo.
    - Exemplo: A variável `y` pode ser acessada tanto na função `funcao` quanto na função `main`.
    ```c
    #include <stdio.h>
    int y = 20; // Variável global
    void funcao() {
        printf("Valor de y dentro da função: %d\n", y);
    }
    int main() {
        funcao();
        printf("Valor de y fora da função: %d\n", y);
        return 0;
    }
    ```

???+ "Variáveis Estáticas"
    Variáveis declaradas com a palavra-chave `static` dentro de uma função mantêm seu valor entre chamadas da função, mas ainda têm escopo local à função.
    - Exemplo: A variável `contador` mantém seu valor entre chamadas da função `incrementar`.
=== "Exemplo de Variável Estática"
    ```c
    #include <stdio.h>
    void incrementar() {
        static int contador = 0; // Variável estática
        contador++;
        printf("Contador: %d\n", contador);
    }
    int main() {
        incrementar();
        incrementar();
        incrementar();
        return 0;
    }
    ```

???+ "const"
    A palavra-chave `const` é usada para declarar variáveis cujo valor não pode ser alterado após a inicialização. Isso ajuda a proteger dados importantes contra modificações acidentais.
    - Exemplo: A variável `PI` é declarada como constante e não pode ser alterada.
    
=== "Exemplo de Variável Constante"
    ```c
    #include <stdio.h>
    int main() {
        const float PI = 3.14159; // Variável constante
        // PI = 3.14; // Isso causaria um erro
        printf("Valor de PI: %.5f\n", PI);
        return 0;
    }
    ```

## 🎯 Resumo

Neste módulo, exploramos os conceitos básicos da linguagem de programação C, incluindo variáveis, tipos de dados, operadores, ponteiros, arrays, structs e enums. 

Compreender esses fundamentos é essencial para desenvolver programas eficientes e eficazes em C. 

À medida que avançamos, construiremos sobre esse conhecimento para criar aplicações mais complexas e interativas.

## ⏭️ Próximo Passo

Continue aprofundando seus conhecimentos em C! Na próxima aula, vamos explorar estruturas de controle, funções e escopo, como `void`, `return`, `if`, `else`, `switch`, `for`, `while` e muito mais.

[📂 Avance para a próxima aula →](/trilhas/python/page-3)