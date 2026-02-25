# 💻 Microcontroladores em C e 

## ✨ Introdução

Microcontroladores são pequenos computadores em um único chip, usados em sistemas embarcados para controlar dispositivos eletrônicos. Programar microcontroladores em C é uma prática comum devido à eficiência e controle que a linguagem oferece.

Nesta seção, você aprenderá os conceitos básicos de programação em C para microcontroladores, incluindo configuração do ambiente de desenvolvimento, compilação e upload do código para o microcontrolador.

!!! info "Objetivos de Aprendizado"
    - Dar início ao intendimento de funcionamento prático a microcontroladores
    - Desenvolver programas básicos em um ESP32-C3
    - Entender mais sobre o `hardware`

Existem um número enorme de microcontroladores mundo a fora, tudo vai variar da técnologia, aplicabilidade, viabilidade e custo.


## 📳 Características

???+ "Características"
    - Todo microcontrolador tem seu datasheet individual, com suas características(wifi, mais ram, mais nvs ou flash)
    - Possuem divisões físicas para tratamento de informações(tipos de ram, nvs, cores, flash, rom, partições fisicas)

É com o datasheet que conseguimos entender melhor suas caracteristicas, vou usar de base o ESP32-c3, no qual vamos utilizar ao longo da trilha. 

Olhando seu [DATASHEET](https://documentation.espressif.com/esp32-c3_datasheet_en.pdf), logo na página 2 já temos uma imagem ilustrando todos os periféricos físicos disponiveis no microcontrolador, seguido de uma completa descrição de funcionamento de sua CPU e seus drivers IOT.

Suas características notáveis são as seguintes:

Compatível com IEEE 802.11 b/g/n (2.4 GHz)
Largura de banda: 20 MHz / 40 MHz
Suporte a WMM, A-MPDU, A-MSDU, Block ACK
4 interfaces virtuais Wi-Fi
Bluetooth LE 5.0 com Bluetooth Mesh
Processador RISC-V 32-bit single-core até 160 MHz
Desempenho: 483 CoreMark (3.02 CoreMark/MHz)
Suporte a diversos tipos de interfaces de comunicação
Modos: Active, Modem-sleep, Light-sleep, Deep-sleep
Secure Boot e Flash Encryption
Inclui balun, PA, LNA e chave de antena integrados (Potência TX: +21 dBm (802.11b) / +20 dBm (802.11n))

## 🎯 Resumo

Programar microcontroladores em C permite explorar o nível mais próximo do hardware, compreender o comportamento dos periféricos e otimizar recursos. O estudo do datasheet é essencial para dominar o dispositivo e desenvolver aplicações robustas e eficientes.

[📂 Avance para a próxima aula →](./page-6.md)