---
draft: false 
date: 2025-05-04
categories:
   - Tutoriais
tags:
   - github
   - programação
   - queroajudar
   - C++
authors:
   - artumosgoc
# readtime: 10
comments: true
---

# O que é SFML

O SFML(Simple and Fast Multimedia Library) é uma biblioteca de desenvolvimento multimídia escrita em C++ que fornece uma interface simples para lidar com gráficos 2D, 3D, áudio, entrada do usuário (teclado, mouse, joystick), rede e janelas. Ele é amplamente utilizado para criar jogos, simuladores e outras aplicações gráficas devido à sua facilidade de uso, desempenho eficiente e suporte multiplataforma.

<!-- more -->

Se esta seção ainda não foi preenchida, você pode expandi-la explicando os principais recursos do SFML, como:
- **Renderização gráfica**: Criação de formas, sprites, texto e outros elementos visuais.
- **Manipulação de áudio**: Reprodução de sons e músicas.
- **Gerenciamento de janelas**: Criação e controle de janelas de aplicação.
- **Entrada do usuário**: Detecção de eventos de teclado, mouse e outros dispositivos.
- **Rede**: Comunicação via TCP e UDP.

# Projeto em questão

Neste projeto, optei por criar um exemplo simples — um cubo 3D — com o objetivo de apresentar de forma prática o que é possível construir utilizando este framework. A ideia é fornecer uma base visual e acessível para quem está começando, demonstrando como estruturas tridimensionais básicas podem ser renderizadas com facilidade.

Este cubo serve como ponto de partida para explorações mais avançadas, como animações, interações, iluminação e composição de cenas mais complexas. A imagem abaixo ilustra o resultado da implementação e evidenciam parte do potencial que essa ferramenta oferece para o desenvolvimento gráfico.

![Gif do Resultado, um cubo tridimensional](https://i.postimg.cc/0Qc8Z3cg/2025-05-05-18-34-10.gif)

# Configuração do Ambiente para Desenvolvimento com SFML

## Instalação do SFML

Para iniciar o processo, precisamos instalar o framework **SFML**. A instalação varia de acordo com o sistema operacional. No caso, estou utilizando **Debian 12** (image-6.1.0-34-amd64). Para instalar o SFML, execute o seguinte comando no terminal(é para funcionar em distros baseadas no debian):

```bash
sudo apt-get install libsfml-dev
```

#### Windows usando vcpkg.

```bash
vcpkg install sfml
```

#### Arch usando pacman.

```bash
sudo pacman -S sfml
```

#### Fedora usando dnf.

```bash
sudo dnf install SFML-devel
```

## Instalação do GCC/G++

Após instalar o SFML, é necessário garantir que o compilador **GCC/G++** esteja instalado. Para isso, utilize o comando:

#### Debian(distros baseadas no debian)

```bash
sudo apt install build-essential
```

No Windows, você pode instalar o GCC/G++ utilizando o **MinGW** ou **MSYS2**:

1. **MinGW**(recomendo):
   - Baixe o instalador do MinGW no site oficial: [MinGW](http://www.mingw.org/).
   - Durante a instalação, selecione os pacotes para o compilador GCC/G++.

2. **MSYS2**:
   - Baixe e instale o MSYS2: [MSYS2](https://www.msys2.org/).
   - No terminal do MSYS2, execute o comando:
     ```bash
     pacman -S mingw-w64-x86_64-gcc
     ```

#### Arch Linux
No Arch Linux, use o gerenciador de pacotes `pacman` para instalar o GCC/G++:

```bash
sudo pacman -S base-devel
```

#### Fedora
No Fedora, use o gerenciador de pacotes `dnf` para instalar o GCC/G++:

```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install gcc-c++
```

# Criando o projeto

1. Crie um diretório para o projeto:
   ```bash
   mkdir meu_projeto_sfml
   cd meu_projeto_sfml
   ```

2. Crie um arquivo de código-fonte principal, `main.cpp`:
   ```bash
   nano main.cpp
   ```

3. Escreva o seguinte código básico no arquivo `main.cpp` para testar a integração com o SFML:
   ```cpp
   #include "WIN.h" // Inclui o arquivo de cabeçalho da classe WIN

   int main()
   {
      // Cria um objeto de janela com (largura, altura, título, cor de fundo e taxa de quadros especificados)
      WIN window(800, 600, "Cubo", sf::Color::Black, 160);

      // Executa o loop principal da janela
      window.run();

      return 0; // Encerra o programa
   }
   // fontes materiais:
   // https://www.sfml-dev.org/tutorials/2.5/window-window.php
   // https://www.sfml-dev.org/tutorials/2.5/graphics-shape.php
   // https://www.sfml-dev.org/tutorials/2.5/graphics-vertex-array.php#vertex-array

   // calculos matematicos:
   // https://pt.wikipedia.org/wiki/Matriz_de_rota%C3%A7%C3%A3o
   ```


4. Crie um arquivo de código-fonte principal, `CUBE.cpp`:
   ```bash
   nano CUBE.cpp
   ```

5. Escreva o seguinte código básico no arquivo `CUBE.cpp` para testar a integração com o SFML:
   ```cpp
   #include "CUBE.h"
   #include <cmath>

   // Construtor
   // Inicializa o cubo com um tamanho especificado e define sua cor padrão como branca
   Cube::Cube(float size) : color(Color::White) {
      // Define os vértices do cubo
      // Calcula metade do tamanho para posicionar os vértices em torno da origem
      float halfSize = size / 2.0f;
      vertices = {
         Vector3f(-halfSize, -halfSize, -halfSize), // Vértice 0
         Vector3f(halfSize, -halfSize, -halfSize),  // Vértice 1
         Vector3f(halfSize, halfSize, -halfSize),   // Vértice 2
         Vector3f(-halfSize, halfSize, -halfSize),  // Vértice 3
         Vector3f(-halfSize, -halfSize, halfSize),  // Vértice 4
         Vector3f(halfSize, -halfSize, halfSize),   // Vértice 5
         Vector3f(halfSize, halfSize, halfSize),    // Vértice 6
         Vector3f(-halfSize, halfSize, halfSize),   // Vértice 7
      };

      // Define as faces do cubo (índices dos vértices)
      // Cada face é representada por 4 índices que apontam para os vértices
      faces = {{
         {0, 1, 2, 3}, // Frente
         {4, 5, 6, 7}, // Trás
         {0, 4, 7, 3}, // Esquerda
         {1, 5, 6, 2}, // Direita
         {0, 1, 5, 4}, // Topo
         {3, 2, 6, 7}, // Fundo
      }};
   }

   // Atualiza a rotação do cubo
   // Aplica rotações nos eixos X, Y e Z para todos os vértices do cubo
   void Cube::rotate(float angleX, float angleY, float angleZ) {
      // Calcula os cossenos e senos dos ângulos para otimizar os cálculos
      float cosX = cos(angleX), sinX = sin(angleX);
      float cosY = cos(angleY), sinY = sin(angleY);
      float cosZ = cos(angleZ), sinZ = sin(angleZ);

      // Itera sobre todos os vértices para aplicar as rotações
      for (auto &vertex : vertices) {
         // Rotação em torno do eixo X
         float y = vertex.y * cosX - vertex.z * sinX;
         float z = vertex.y * sinX + vertex.z * cosX;
         vertex.y = y;
         vertex.z = z;

         // Rotação em torno do eixo Y
         float x = vertex.x * cosY + vertex.z * sinY;
         z = -vertex.x * sinY + vertex.z * cosY;
         vertex.x = x;
         vertex.z = z;

         // Rotação em torno do eixo Z
         x = vertex.x * cosZ - vertex.y * sinZ;
         y = vertex.x * sinZ + vertex.y * cosZ;
         vertex.x = x;
         vertex.y = y;
      }
   }

   // Desenha o cubo na janela
   // Renderiza as faces do cubo na tela
   void Cube::draw(RenderWindow &window) {
      // Obtenha o tamanho da janela para centralizar o cubo
      Vector2u windowSize = window.getSize();
      float centerX = windowSize.x / 2.0f; // Coordenada X do centro da janela
      float centerY = windowSize.y / 2.0f; // Coordenada Y do centro da janela

      // Define as cores para cada face do cubo
      std::array<Color, 6> faceColors = {
         Color::Red,    // Frente
         Color::Green,  // Trás
         Color::Blue,   // Esquerda
         Color::Yellow, // Direita
         Color::Cyan,   // Topo
         Color::Magenta // Fundo
      };

      // Itera sobre as faces do cubo
      for (size_t i = 0; i < faces.size(); i++) {
         ConvexShape polygon; // Cria um polígono convexo para representar a face
         polygon.setPointCount(4); // Cada face tem 4 vértices
         polygon.setFillColor(faceColors[i]); // Define a cor da face

         // Define os pontos do polígono com base nos vértices da face
         for (int j = 0; j < 4; j++) {
               Vector3f vertex = vertices[faces[i][j]]; // Obtém o vértice correspondente
               polygon.setPoint(j, Vector2f(vertex.x + centerX, vertex.y + centerY)); // Ajusta para o centro da tela
         }

         // Desenha o polígono na janela
         window.draw(polygon);
      }
   }
   ```

6. Crie um arquivo de código-fonte principal, `CUBE.h`:
   ```bash
   nano CUBE.h
   ```

7. Escreva o seguinte código básico no arquivo `CUBE.h` para testar a integração com o SFML:
   ```cpp
   #ifndef CUBE_H
   #define CUBE_H

   #include <SFML/Graphics.hpp>
   #include <array>

   using namespace sf;

   // Definição da classe Cube
   class Cube {
   private:
      // Vértices do cubo (8 vértices para um cubo 3D)
      std::array<Vector3f, 8> vertices;

      // Faces do cubo (6 faces, cada uma definida por 4 índices de vértices)
      std::array<std::array<int, 4>, 6> faces;

      // Cor do cubo
      Color color;

      // Matriz de projeção para simular a projeção 3D para 2D
      float projectionMatrix[4][4];

      // Função privada que atualiza a projeção dos vértices do cubo para coordenadas 2D
      void projectVertices();

   public:
      // Construtor da classe Cube, que inicializa o cubo com um tamanho específico
      Cube(float size);

      // Função pública que atualiza a rotação do cubo em torno dos eixos X, Y e Z
      void rotate(float angleX, float angleY, float angleZ);

      // Função pública que desenha o cubo na janela fornecida
      void draw(RenderWindow &window);
   };

   #endif // CUBE_H
   ```

8. Crie um arquivo de código-fonte principal, `WIN.cpp`:
   ```bash
   nano WIN.cpp
   ```

9. Escreva o seguinte código básico no arquivo `WIN.cpp` para testar a integração com o SFML:
   ```cpp
   #include "WIN.h"

   // Construtor
   // O construtor da classe WIN inicializa os atributos da janela, como largura, altura, título, cor de fundo e limite de quadros por segundo.
   // Além disso, inicializa o cubo com um tamanho fixo de 300 e cria a janela SFML.
   WIN::WIN(int width, int height, const std::string &title, Color backgroundColor, int frameRateLimit)
      : cube(300) // Inicializa o cubo com tamanho 300
   {
      this->width = width; // Define a largura da janela
      this->height = height; // Define a altura da janela
      this->title = title; // Define o título da janela
      this->backgroundColor = backgroundColor; // Define a cor de fundo da janela
      this->frameRateLimit = frameRateLimit; // Define o limite de quadros por segundo
      

      // Cria a janela SFML com as configurações especificadas
      window.create(VideoMode(width, height), title, Style::Titlebar | Style::Close);
   }

   // Destrutor
   // O destrutor da classe WIN é declarado, mas não possui implementação específica no momento.
   WIN::~WIN() {
      // Implementação do destrutor (vazia por enquanto)
   }

   // Inicializa a janela
   // Configura o limite de quadros por segundo e limpa a janela com a cor de fundo especificada.
   void WIN::initWindow() {
      window.setFramerateLimit(frameRateLimit); // Define o limite de quadros por segundo
      window.clear(backgroundColor); // Limpa a janela com a cor de fundo
   }

   // Loop principal da janela
   // O método run é responsável por executar o loop principal da aplicação.
   // Ele inicializa a janela, lida com eventos, atualiza o estado e renderiza o conteúdo.
   void WIN::run() {
      initWindow(); // Inicializa a janela

      // Loop principal da aplicação
      while (window.isOpen()) {
         handleEvents(); // Lida com os eventos da janela
         update();       // Atualiza o estado da aplicação
         render();       // Renderiza o conteúdo na janela
      }
   }

   // Lida com eventos
   // Este método processa os eventos da janela, como o fechamento da mesma.
   void WIN::handleEvents() {
      Event event; // Objeto para armazenar eventos
      while (window.pollEvent(event)) { // Verifica se há eventos na fila
         if (event.type == Event::Closed) { // Se o evento for de fechamento
               window.close(); // Fecha a janela
         }
      }
   }

   // Atualiza a janela
   // Atualiza o estado do cubo, aplicando uma rotação contínua.
   void WIN::update() {
      cube.rotate(0.01f, 0.01f, 0.01f); // Rotaciona o cubo em torno dos eixos X, Y e Z
   }

   // Renderiza a janela
   // Limpa a janela, desenha o cubo e exibe o conteúdo renderizado.
   void WIN::render() {
      window.clear(backgroundColor); // Limpa a janela com a cor de fundo
      cube.draw(window);             // Desenha o cubo na janela
      window.display();              // Exibe o conteúdo renderizado na janela
   }
   ```

10. Crie um arquivo de código-fonte principal, `WIN.h`:
      ```bash
      nano WIN.h
      ```

11. Escreva o seguinte código básico no arquivo `WIN.h` para testar a integração com o SFML:
      ```cpp
      #ifndef WIN_H
      #define WIN_H

      #include <SFML/Graphics.hpp>
      #include "CUBE.h"

      using namespace sf;

      // Classe que representa a janela principal do programa
      class WIN {
      private:
         // Propriedades da janela
         RenderWindow window; // Objeto da janela SFML
         int width, height; // Largura e altura da janela
         std::string title; // Título da janela
         Color backgroundColor; // Cor de fundo da janela
         int frameRateLimit; // Limite de taxa de quadros por segundo

         // Objeto do cubo
         Cube cube; // Instância da classe Cube

      public:
         // Construtor
         WIN(int width, int height, const std::string &title, Color backgroundColor, int frameRateLimit);
         // Inicializa os atributos da classe com os valores fornecidos

         // Destrutor
         ~WIN();
         // Libera recursos, se necessário

         // Inicializa a janela
         void initWindow();
         // Configura a janela com os parâmetros fornecidos

         // Executa o loop principal da janela
         void run();
         // Mantém a janela aberta e gerencia o ciclo de eventos, atualização e renderização

         // Lida com os eventos da janela
         void handleEvents();
         // Processa eventos como entrada do teclado, mouse, etc.

         // Atualiza o estado da janela
         void update();
         // Atualiza os elementos da janela, como o cubo

         // Renderiza o conteúdo na janela
         void render();
         // Desenha os elementos na tela
      };

      #endif // WIN_H
      ```


12. Compile o código usando o `g++`:
   ```bash
   g++ *.cpp -o meu_projeto -lsfml-graphics -lsfml-window -lsfml-system
   ./meu_projeto
   ```
   Caso seja **Windows**
   ```bash
   g++ *.cpp -o meu_projeto -I"path\to\vcpkg\installed\x64-windows\include" -L"path\to\vcpkg\installed\x64-windows\lib" -lsfml-graphics -lsfml-window -lsfml-system
   ```
   `path\to\...` substitua pelo caminho correto.