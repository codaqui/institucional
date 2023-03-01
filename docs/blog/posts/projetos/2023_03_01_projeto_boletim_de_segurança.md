---
draft: false 
date: 2023-03-01
categories:
  - Projetos
tags:
  - github
  - actions
  - queroajudar
authors:
  - artumosgoc
# readtime: 10
comments: true
---

# Codaqui e seu Boletim de Segurança!

Oi! Eu sou o Elias, aluno da Codaqui, o meu objetivo aqui é ensinar como eu criei um sistema de envio de e-mails, sem ter um servidor de e-mail e utilizando o GitHub para me alertar do boletim de segurança.

<!-- more -->
Gostaria de já fazer um agradecimento pela ajuda do Fundador da Codaqui, Enderson Menezes, que esteve me auxiliando no processo de criação desse projeto. 

!!! example "Vamos lá!"

    === "Sem imagens"

        **1° Passo**

        1. Vá no seu perfil e procure por `Repositories`.
        2. Crie um novo repositório no github clicando em `New`, com nome de sua preferência.
        
        **2° Passo**

        1. Dentro desse repositório crie dois arquivos `.sh`, clicando em `Add File`, `Create new file`.
        2. Chamados de `number.sh` e `script.sh`.
        3. Ele são responsáveis por decodificar os dados.
        
        - Cógido dos arquivos `.sh`:
        [script.sh](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/script.sh).
        [number.sh](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/number.sh).
        
        **3° Passo**

        1. Crie também uma pasta chamada de `.github`, no repositório
        2. Depois aperte `/`, ele entenderá que você quer gerar uma pasta.
        3. Por fim dentro dessa pasta crie um arquivo chamado `boletim.md`.
        
        - Código do `boletim.md`:
        [boletim.md](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/.github/boletim.md).
        
        **4º Passo**

        1. No mesmo diretório do arquivo `boletim.md`, crie outra pasta chamada de workflows.
        2. Dentro do workflows crie um arquivo chamado de `boletim-diario.yml`.
        
        - Código do `boletim-diario.yml`:
        
        [boletim-diario.yml](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/.github/workflows/boletim-diario.yml)
        
        **5° Passo** 

        OBS: Tudo já está normal, mas e necessário editar algumas parte do `boletim-diario.yml`.
  
        1. Procure por essas partes do códigos e faça oque é pedido abaixo!
          
          1°, altere isso:
          ```yml
          on: 
              schedule:
                - cron: '0 13 * * *'
          
          ```
          para isso:
          
          ```yml
          on: push
          
          ```
          depois altere:
          ```bash
          chmod +X ./number.sh
          bash ./number.sh
          var=$( cat numero_final.txt )
          gh issue close $var
          
          ```
          para isso:
          
          ```bash
          #chmod +X ./number.sh
          #bash ./number.sh
          #var=$( cat numero_final.txt )
          #gh issue close $var
          
          ```
          
          2° quando terminar salve as modificações e espere o Actions validar o código, logo após a criação da primeira `Issue`, modifique o código novamente e volte como estava antes.
          
        - Para receber no E-mail leia nossa [README.md](https://github.com/codaqui/boletim-diario-seguranca/#readme), isso também é valido na sua aplicação.

    === "Com imagens"

        **1° Passo**

        - *Criar um repositório no Github!*


        ![step1](https://user-images.githubusercontent.com/63540372/220663763-e904004d-2093-4b09-9430-3e509843b4af.gif)

        **2° Passo**

        - *Criar scripts responsáveis por decodificar os dados.*
        

        ![step2](https://user-images.githubusercontent.com/63540372/220674190-36a2b387-5cc8-4814-bda0-e773bc25c8bc.gif)

        - Código usado para criação dos scripts: [script.sh](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/script.sh) / [number.sh](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/number.sh)!
        
        **3º Passo**

        - *Criar pasta .github e arquivo md(Corpo para gerar ISSUES).*
        
        
        ![step3](https://user-images.githubusercontent.com/63540372/220686276-87e4a0d7-15b0-4161-9660-2e23b1190d59.gif)
        
        - Aperte / depois de escrever .github para gerar uma pasta.
        - Código usado para criar o [boletim.md](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/.github/boletim.md).
        
        **4° Passo**

        - *Criar pasta workflows e arquivo yml(Responsável por iniciar as tarefas).*
        
        
        ![step4](https://user-images.githubusercontent.com/63540372/220690915-99ea2900-9cc1-43de-becf-64a4d69128fa.gif)
        
        - Código usado para criar [boletim-diario.yml](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/.github/workflows/boletim-diario.yml)
          
        **5° Passo**
        
        - *Para teste e funcionamento de tudo altere o arquivo yml como no gif abaixo*
        
        
        ![step5](https://user-images.githubusercontent.com/63540372/220696236-9cc17481-ea8b-4f3b-9710-df73612b1bad.gif)
        
        altere:
        ```yml
        on: 
            schedule:
              - cron: '0 13 * * *'
        
        ```
        para
        
        ```yml
        on: push
        
        ```
        E também altere:
        ```bash
        chmod +X ./number.sh
        bash ./number.sh
        var=$( cat numero_final.txt )
        gh issue close $var
        
        ```
        para
        
        ```bash
        #chmod +X ./number.sh
        #bash ./number.sh
        #var=$( cat numero_final.txt )
        #gh issue close $var
        
        ```
        - Depois de salvar espere o Actions validar o código e gerar uma nova `Issue`.
        - Em seguida altere novamente o código como o anterior do 4° passo.
        - Pronto Está tudo funcionando!
        - Para receber no E-mail leia nossa [README.md](https://github.com/codaqui/boletim-diario-seguranca/#readme), isso também é valido na sua aplicação.
             
### Observações Importantes

#### 1° Observação

- O código pode ser totalmente moldado por sua preferencia, só é preciso alterar o `script.sh` na linha abaixo
```bash
xmllint --html --xpath "/html/body/div[1]/main/section[2]/div/div/div/div/div/div[2]" boletim1.txt 1> boletim2.txt 2> /dev/null
```
- Especificamente tudo entre `""`, para isso você deve entender a estrutura da página, no qual será pego as informações.

#### 2° Observação

- O horário está marcado para o Actions disparar a `Issue` as 13h, 0GMT, 10h no horário de Brasilia!
- Você pode alterar o horário mudando o código mostrado abaixo:
```yml
  schedule:
     - cron: '0 13 * * *'
```

#### 3° Observação

- Quais quer problemas futuros com o sistema criado podem ser variados, devem ser analisados.
- Possiveis casos previstos:

 1. JasonEtco/create-an-issue@v2 atualiza a maneira de gerenciar o aquivo `.md` na pasta `.github`.
 2. A parte do bash realiza a tarefa sem atualizar o arquivo gerado no processo criando um erro, nesse caso você só da um `push` mostrado no ultimo passo mostrado acima.

#### 4º Observação

- Os nomes de arquivos e variáveis podem ser alteras, mas caso procure fazer isso, verifique se tudos os nomes modificados estão certos para funcionar.
