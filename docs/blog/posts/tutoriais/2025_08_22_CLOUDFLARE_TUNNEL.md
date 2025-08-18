---
draft: false 
date: 2025-08-22
categories:
   - Tutoriais
tags:
   - cloudflare
   - networking
   - ipv4
   - virtual-machine
authors:
   - endersonmenezes
# readtime: 10
comments: true
---

# Cloudflare Tunnel: Um Guia Completo para Economizar com IPv4 em Máquinas Virtuais

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce purus est, pellentesque nec fringilla ac, euismod vel enim. Pellentesque quis ante vitae sapien fringilla commodo. Nunc varius libero at tortor pretium, eu rutrum magna lobortis. Sed vestibulum condimentum accumsan. Cras non nisi nisi. Nullam pulvinar fermentum consectetur. Proin laoreet gravida volutpat. Mauris massa neque, iaculis quis finibus quis, sagittis in dolor. Quisque auctor pulvinar ante mollis iaculis. Duis ac faucibus massa.

<!-- more -->

Morbi viverra sem sapien, eget commodo eros dapibus id. Nullam scelerisque consectetur posuere. Ut semper non risus quis scelerisque. Integer rhoncus urna sit amet lacus mollis, a interdum magna gravida. Integer mollis fermentum dui ut pretium. Ut rhoncus pretium neque. Proin malesuada tristique diam a finibus. Praesent scelerisque vel nunc nec mollis. Aliquam erat volutpat. Cras eu suscipit justo. Praesent lacinia enim ut odio mattis, ac tempor risus iaculis.

## Motivador

Projetos caseiros, podem necessitar de um domínio para serem expostos na internet. Para utilizar um domínio, normalmente você vai necessitar de um IPv4, e isso hoje possui um custo alto. A ideia de laboratório aqui é usar o Cloudflare no seu plano gratuito, para fazer um túnel para as aplicações necessárias.

## Tópicos

- Explicar sobre maquina virtual (brevemente)
- Explicar a motivação de usar uma maquina virtual.
    - Conceitual, por mais que projetos produtivos hoje nao se basearem puramente em maquinas virtuais, elas ainda são necessárias em background, então aprender a manusear é ótimo.
- Criar manualmente uma Máquina Virtual no Azure (Tecnico) - Pessoal
- Criar conta no Cloudflare
- Funcionalidades básicas para Domínio
- Funcionalidades básicas de Zero Trust
- Configuração de Tunnel na VM
- Projeto do Tutorial e configurar uma maquina para o Piping Server com Domínio Gratuito