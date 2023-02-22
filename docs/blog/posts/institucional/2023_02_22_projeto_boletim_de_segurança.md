---
draft: false 
date: 2023-02-22
categories:
  - Institucional
tags:
  - hello
  - world
  - queroajudar
authors:
  - endersonmenezes
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

        <!-- A Desenvoler.. -->

    === "Com imagens"

            ### 1° Passo
            - *Criar um Diretório no github!*


            ![step1](https://user-images.githubusercontent.com/63540372/220663763-e904004d-2093-4b09-9430-3e509843b4af.gif)

            ### 2° Passo
            - *Criar scripts responsáveis por decodificar os dados.*


            ![step2](https://user-images.githubusercontent.com/63540372/220674190-36a2b387-5cc8-4814-bda0-e773bc25c8bc.gif)

            - Código usado para criação dos scripts: [script.sh](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/script.sh) / [number.sh](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/number.sh)!
            
            ### 3º Passo
            - *Criar pasta .github e arquivo md(Corpo para gerar ISSUES).*
            
            
            ![step3](https://user-images.githubusercontent.com/63540372/220686276-87e4a0d7-15b0-4161-9660-2e23b1190d59.gif)
            
            - Aperte / depois de escrever .github para gerar uma pasta.
            - Código usado para criar o [boletim.md](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/.github/boletim.md).
            
            ### 4° Passo
            - *Criar pasta workflows e arquivo yml(Responsável por iniciar as tarefas).*
            
            
            ![step4](https://user-images.githubusercontent.com/63540372/220690915-99ea2900-9cc1-43de-becf-64a4d69128fa.gif)
            
            - Código usado para criar [boletim-diario.yml](https://raw.githubusercontent.com/codaqui/boletim-diario-seguranca/main/.github/workflows/boletim-diario.yml)
             
             ### 5° Último passo
             - *Para teste e funcionamento de tudo altere o arquivo yml como no gif abaixo*
             
             
             ![step5](https://user-images.githubusercontent.com/63540372/220696236-9cc17481-ea8b-4f3b-9710-df73612b1bad.gif)
             
             ```yml
             on: 
                 schedule:
                   - cron: '0 13 * * *'
             
             ```
             para
             
             ```yml
             on: push
             
             ```
             
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
             - Depois de salvar espere o Actions validar o código.
             - Em seguida altere novamente o código como o anterior do 4° passo.
             - Pronto Está tudo funcionando!
             
<!-- A Desenvoler.. -->
