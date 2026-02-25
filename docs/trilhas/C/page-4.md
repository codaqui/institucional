# 🎯 Compiladores

## ✨ Introdução a Compiladores

Compiladores são programas que traduzem código-fonte escrito em uma linguagem de programação para outra linguagem, geralmente código de máquina que pode ser executado diretamente pelo computador. Eles desempenham um papel crucial no desenvolvimento de software, permitindo que os desenvolvedores escrevam código em linguagens de alto nível, que são mais fáceis de entender e usar, e depois convertam esse código em uma forma que o computador possa executar.

Os compiladores geralmente passam por várias etapas durante o processo de tradução, incluindo análise léxica, análise sintática, otimização e geração de código. Cada uma dessas etapas desempenha um papel importante na criação de um programa eficiente e funcional.

!!! info "Objetivos de Aprendizado"
    - Compreender o funcionamento básico de um `Compilador`

## ▶️ Etapas do Processo de Compilação

De maneira geral, o processo de compilação pode ser dividido nas seguintes etapas principais:

1. **Análise Léxica**: Nesta etapa, o compilador lê o código-fonte e o divide em unidades menores chamadas "tokens". Os tokens são as menores unidades significativas do código, como palavras-chave, identificadores, operadores e delimitadores.

2. **Análise Sintática**: Após a análise léxica, o compilador verifica se a sequência de tokens segue a gramática da linguagem. Essa etapa é responsável por construir uma árvore de sintaxe abstrata (AST), que representa a estrutura hierárquica do código.

3. **Otimização**: Nesta fase, o compilador tenta melhorar o código intermediário gerado nas etapas anteriores. O objetivo é tornar o código mais eficiente, reduzindo o tempo de execução e o uso de recursos. Isso pode incluir a eliminação de código redundante, a simplificação de expressões e a reorganização de instruções.

4. **Geração de Código**: Finalmente, o compilador gera o código de máquina ou código de byte que pode ser executado pelo computador. Essa etapa envolve a tradução da AST em instruções específicas da arquitetura de hardware alvo.

## 🛠️ Tipos de Compiladores

Existem vários tipos de compiladores, cada um com suas próprias características e usos:
    - **Compiladores de Linha de Comando**: São usados para compilar programas a partir do terminal ou prompt de comando. Exemplos incluem GCC (GNU Compiler Collection) e Clang.

    - **Compiladores Integrados**: São incorporados em ambientes de desenvolvimento integrados (IDEs) e fornecem funcionalidades adicionais, como depuração e análise de código. Exemplos incluem o compilador do Visual Studio e o compilador do Eclipse.

    - **Compiladores Just-In-Time (JIT)**: Compilam o código em tempo de execução, permitindo otimizações dinâmicas com base no comportamento do programa. Exemplos incluem o compilador JIT do Java e o .NET JIT.

## Como os Compiladores Funcionam na Prática

Para entender melhor como os compiladores funcionam na prática, vamos considerar um exemplo simples de código-fonte em C:

=== "Funcionamento do compilador"
    ```c
    #include <stdio.h>

    int main() {
        printf("Hello, World!\n");
        return 0;
    }
    ```

Quando esse código é compilado usando um compilador como GCC, o processo segue as etapas mencionadas anteriormente:

1. **Análise Léxica**: O compilador lê o código e identifica tokens como `#include`, `int`, `main`, `printf`, etc.

2. **Análise Sintática**: O compilador verifica se a estrutura do código está correta e constrói a árvore de sintaxe abstrata.

3. **Otimização**: O compilador pode otimizar o código, embora neste exemplo simples, as otimizações possam ser mínimas.

4. **Geração de Código**: Finalmente, o compilador gera o código de máquina que pode ser executado pelo sistema operacional.

## 📦 Como Compilar um Programa em C e usar Flags

Para compilar um programa em C, você pode usar o seguinte comando no terminal:

```bash
gcc -o meu_programa meu_programa.c
```

Neste comando:

- `gcc` é o compilador.
- `-o meu_programa` especifica o nome do arquivo de saída (neste caso, `meu_programa`).
- `meu_programa.c` é o arquivo de código-fonte que você deseja compilar.

### Usando Flags

O GCC oferece várias flags que podem ser usadas para modificar o comportamento da compilação. Aqui estão algumas das mais comuns:

???+ "Flags"
    - `-Wall`: Ativa todos os avisos recomendados.
    - `-O2`: Ativa otimizações de nível 2.
    - `-g`: Gera informações de depuração.

Um exemplo de uso de flags seria:

???+ "Flags"
    ```bash
    gcc -Wall -O2 -g -o meu_programa meu_programa.c
    ```

Caso você use uma biblioteca externa, como a `QT`, você pode precisar incluir flags adicionais para indicar onde estão os arquivos de cabeçalho e as bibliotecas. Por exemplo:

???+ "Flags"
    ```bash
    gcc -I/path/to/qt/includes -L/path/to/qt/libs -lqtcore -o meu_programa meu_programa.c
    ```

Ou seja existem uma lista de flags existentes e que são criadas conforme a necessidade do programador.

**As mais comuns são**:

???+ "Flags"
    - `-I<diretório>`: Especifica o diretório onde os arquivos de cabeçalho estão localizados.
    - `-L<diretório>`: Especifica o diretório onde as bibliotecas estão localizadas.
    - `-l<nome_da_biblioteca>`: Liga a biblioteca especificada ao programa.
    - `-D<macro>`: Define uma macro para o pré-processador.
    - `-O2`, `-O3`, `-Ofast`: Níveis de otimização para melhorar o desempenho do código gerado.


## 📒 Recursos Adicionais

- [Compilers: Principles, Techniques, and Tools](https://www.amazon.com/Compilers-Principles-Techniques-Tools-2nd/dp/0321486811) - Livro clássico sobre compiladores, também conhecido como "O Livro do Dragão".
- [LLVM Project](https://llvm.org/) - Um conjunto de ferramentas de compilação modular e reutilizável.
- [GCC Documentation](https://gcc.gnu.org/onlinedocs/) - Documentação oficial do GNU Compiler Collection.

## 🎯 Resumo

Compiladores são ferramentas essenciais no desenvolvimento de software, permitindo a tradução de código-fonte em linguagens de alto nível para código executável. Compreender as etapas do processo de compilação e os diferentes tipos de compiladores é fundamental para qualquer programador que deseja otimizar e melhorar seus programas.

Não vamos nos aprofundar neste assunto, pois tratar sobre compiladores exige um conhecimento mais avançado de teoria da computação e linguagens formais, mas é importante ter uma noção básica sobre o tema.

[📂 Avance para a próxima aula →](./page-5.md)