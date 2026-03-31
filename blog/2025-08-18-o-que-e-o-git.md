---
slug: 2025/08/18/o-que-e-o-git
title: O que é o GIT?
authors:
  - name: Elias Miranda
    title: Student
    url: https://github.com/artumosgoc
    image_url: https://avatars.githubusercontent.com/u/63540372
tags: [Tutoriais, github, linux, queroajudar]
---
Git é um sistema de controle de versão distribuído acessível pela linha de comando (CLI), que permite criar, rastrear e colaborar em um ou vários repositórios diretamente no terminal. Com ele, é possível registrar alterações, criar branches, fazer merges e manter o histórico do código com segurança.

<!--truncate-->

## Como instalar o GIT?

### 📋 **Pré-requisitos**
- Acesso ao terminal/linha de comando
- Privilégios de administrador (sudo)

### 🐧 **Linux**

#### **Distribuições baseadas no Debian (Ubuntu, Mint, etc.)**
```console
sudo apt update && sudo apt install git
```

#### **Distribuições Fedora/RHEL/CentOS**
```console
sudo dnf install git
```

#### **Arch Linux**
```console
sudo pacman -S git
```

### 🍎 **macOS**

#### **Usando Homebrew (Recomendado)**
```console
brew install git
```

#### **Usando MacPorts**
```console
sudo port install git
```

> **💡 Curiosidade:** O Homebrew também pode ser usado no Linux como alternativa aos gerenciadores nativos!

### 🪟 **Windows**

#### **Opção 1: Windows Subsystem for Linux (WSL)**
1. **Instalar WSL:**
   ```console
   wsl --install -d Debian
   ```

2. **Configurar WSL 2 como padrão:**
   ```console
   wsl --set-default-version 2
   ```

3. **Instalar Git no Debian:**
   ```console
   sudo apt update && sudo apt install git
   ```
   **Veja o tópico acima de como instalar no Debian.**

#### **Opção 2: Instalação Nativa**
**Download automático via PowerShell:**
```powershell
winget install --id Git.Git -e --source winget
```

Caso não funcione, você pode baixar o instalador diretamente do site oficial: [git-scm.com](https://git-scm.com/download/win). e instalar manualmente a versão GUI.

### ⚙️ **Configuração Inicial**

**Configurar identidade:**
```console
git config --global user.name "Seu Nome"
git config --global user.email "seuemail@exemplo.com"
```

**No VSCode**

1️⃣ **Clonar um repositório para testar o funcionamento(metodo fácil):**
```console
# Institucional da codaqui por exemplo
git clone https://github.com/codaqui/institucional.git
```
## 🚀 Clonando um Repositório no VSCode

2️⃣ **No seu VSCode, clique no ícone de controle de código-fonte**  

<img width="72" height="63" alt="image" src="https://github.com/user-attachments/assets/fd5c2a4f-409a-4298-a62e-0ed359244679" />

---

3️⃣ **Clique em _CLONE REPOSITORY_**  

<img width="264" height="34" alt="image" src="https://github.com/user-attachments/assets/32475ffe-7c3e-4cda-8a3d-1204bba19c9c" />

---

4️⃣ **Na parte inferior da barra de pesquisa, selecione _CLONE FROM GITHUB_**  

<img width="627" height="74" alt="image" src="https://github.com/user-attachments/assets/f2cd252d-d99d-4806-a26c-3a10f510e8fa" />

---

5️⃣ **Será exibida a seguinte mensagem:**  

<img width="570" height="203" alt="image" src="https://github.com/user-attachments/assets/3d3a4d6d-e8b2-4c88-9cde-5c3a5bc90ab4" />

---

6️⃣ **Clique em ✅ _Allow_**  

---

7️⃣ **Faça login no GitHub** 🔑

