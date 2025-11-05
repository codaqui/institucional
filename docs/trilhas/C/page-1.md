# 💻 C e microcontroladores

## ⭐ Introdução

C é uma linguagem de programação de propósito geral desenvolvida por Dennis Ritchie entre 1969 e 1973 na Bell Labs. É uma linguagem de baixo nível, próxima da linguagem de máquina, o que a torna eficiente e rápida. C é amplamente utilizada para desenvolver sistemas operacionais, compiladores, drivers de dispositivos e aplicativos de alto desempenho. 

É uma linguagem estruturada, o que significa que o código é organizado em funções e blocos lógicos. Isso facilita a leitura, manutenção e depuração do código. 

C também oferece controle direto sobre o hardware, permitindo manipular memória e recursos do sistema de forma eficiente.

!!! info "Objetivos de Aprendizado"
    - Compreender os fundamentos da linguagem C
    - Entender a sintaxe básica da linguagem C
    - Entender sua tipagem de dados e operadores
    - Desenvolver habilidades para criar programas simples em C

- Programar é a arte de escrever receitas de bolo de maneira creativa e eficiente, de maneira que existencias binarias possam entender e executar essas receitas perfeitamente.

Lembre-se de que a sintaxe correta é crucial para o funcionamento do programa em C. Erros de sintaxe podem levar a falhas na compilação ou comportamento inesperado durante a execução. Nesse momento não veremos codigos, apenas a teoria.

## Sintaxe Básica

A sintaxe da linguagem C é composta por diversos elementos, incluindo:

???+ "Sintaxe Básica"
    - **Comentários**: Utilizados para documentar o código. Comentários de linha única começam com `//`, enquanto comentários de múltiplas linhas são delimitados por `/*` e `*/`.
    - **Declaração de Variáveis**: As variáveis devem ser declaradas com um tipo específico antes de serem usadas. Exemplo: `int idade;`
    - **Funções**: Blocos de código que realizam tarefas específicas. A função principal é `main()`, onde a execução do programa começa.
    - **Estruturas de Controle**: Instruções como `if`, `else`, `while`, e `for` são usadas para controlar o fluxo do programa.
    - **Operadores**: C suporta uma variedade de operadores, incluindo aritméticos (`+`, `-`, `*`, `/`), relacionais (`==`, `!=`, `<`, `>`), e lógicos (`&&`, `||`, `!`).
    - **Ponto e Vírgula**: Cada instrução em C termina com um ponto e vírgula (`;`), indicando o fim da instrução.
    - **Chaves**: Blocos de código são delimitados por chaves `{}` para agrupar múltiplas instruções.
    - **Inclusão de Bibliotecas**: A diretiva `#include` é usada para incluir bibliotecas padrão ou personalizadas no programa.
    - 

???+ "Tipagem de Dados"
    - **Tipos Primitivos**: C possui vários tipos de dados primitivos, incluindo:
        - `int`: para números inteiros
        - `float`: para números de ponto flutuante (decimais)
        - `char`: para caracteres individuais
        - `double`: para números de ponto flutuante de precisão dupla
        - `void`: representa a ausência de valor ou tipo - vazio
    - **Modificadores de Tipo**: Modificadores como `short`, `long`, `unsigned` podem ser usados para alterar o tamanho e o comportamento dos tipos de dados primitivos.
    - **Declaração e Inicialização**: Variáveis podem ser declaradas e inicializadas em uma única linha. Exemplo: `(opcional:modificadores,constantes e estaticos)(tipo primitivo) (nome variavel) = (valor atribuido);`
    - **Conversão de Tipos**: C permite a conversão explícita (casting) entre diferentes tipos de dados, o que pode ser útil em operações aritméticas e manipulação de dados.
    - **Constantes**: Valores que não podem ser alterados durante a execução do programa. Podem ser definidas usando a palavra-chave `const` ou através de diretivas de pré-processador como `#define`.
    - **returno de Funções**: O tipo de dado também é usado para definir o tipo de valor que uma função retorna. Exemplo: `(tipo primitivo) (nome da funcao)() { (faz retorno) (valor); }`
    - **Parâmetros de Funções**: Funções podem receber parâmetros, que são valores passados para a função quando ela é chamada. Exemplo: `(tipo primitivo) (nome da funcao)( (tipo primitivo) (nome do parametro) ) { (corpo da funcao) }`
    - **operadores de Atribuição**: Usados para atribuir valores às variáveis, como `=`, `+=`, `-=`, `>>=` `<<=`, etc.

???+ "tipagem de funções"
    - **Declaração de Funções**: Funções devem ser declaradas com um tipo de retorno e uma lista de parâmetros. Exemplo: `(tipo primitivo) (soma)((tipo primitivo inteiro) a, (tipo primitivo inteiro) b);`
    - **Definição de Funções**: A definição da função inclui o corpo da função, onde o código é implementado.
    - **Chamada de Funções**: Funções são chamadas pelo nome, passando os argumentos necessários. Exemplo: `resultado = soma(5, 10);`
    - **Escopo de Variáveis**: Variáveis podem ter escopo local (dentro de uma função) ou global (acessível em todo o programa).
    - **Recursão**: C suporta funções recursivas, onde uma função pode chamar a si mesma para resolver problemas.
    - **Protótipos de Função**: Permitem declarar funções antes de sua definição, facilitando a organização do código.
    - **Funções Void**: Funções que não retornam valor são declaradas com o tipo `void`.
    - **Passagem por Valor**: Em C, os parâmetros são passados por valor, o que significa que uma cópia do valor é passada para a função.

=== "Exemplo c"
    ```
    (tipo primitivo)int (nome da funcao)soma ( (tipo primitivo)int a, (tipo primitivo)int b ) 
    {
        (faz retorno)return (parametro1)a + (parametro2)b;
    }
    --------------
    (tipo primitivo)int (nome da funcao/metodo)main() 
    {
        (tipo primitivo)int (nome da variavel)resultado = (nome da funcao)soma(5, 10);
        (função que imprime texto)printf("Resultado: %d\n", (nome da variavel)resultado);
        return 0;
    }
    ----------------
    (condicional)if ( (nome da variavel)resultado > 10 ) 
    {
        (função que imprime texto)printf("Resultado é maior que 10\n");
    }
    ```

Esses conceitos seram forjados e aprofundados ao longo dos próximos módulos, com exemplos práticos e exercícios para consolidar o aprendizado.

## Conclusão

A linguagem C é uma poderosa ferramenta para programação de sistemas e aplicações de alto desempenho. Compreender sua sintaxe, tipos de dados e operadores é fundamental para escrever código eficiente e eficaz. A prática constante e a exploração de exemplos práticos ajudarão a consolidar o conhecimento e a desenvolver habilidades de programação em C.

## Próximos Passos

Agora que você está familiarizado com a sintaxe básica e os tipos de dados em C, é hora de colocar esse conhecimento em prática. Nos próximos módulos, exploraremos conceitos mais avançados, como estruturas de controle, funções, arrays e ponteiros. Além disso, veremos como aplicar esses conceitos na programação de microcontroladores, onde a eficiência e o controle sobre o hardware são essenciais.

Vamos continuar nossa jornada na linguagem C e explorar mais conceitos fundamentais que o ajudarão a se tornar um programador competente em C!

[📂 Avance para a próxima aula →](/trilhas/python/page-2)