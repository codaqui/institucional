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


# Cloudflare Tunnel: economizando IPv4 ao expor serviços em VMs

Este tutorial mostra, passo a passo e com exemplos práticos, como expor serviços que rodam em uma máquina virtual (VM) sem precisar de um IPv4 público dedicado, usando o Cloudflare Tunnel (cloudflared) no plano gratuito. O objetivo é um laboratório reprodutível: criar uma VM, instalar sua aplicação (ex.: um "piping server"), configurar o túnel e publicar um hostname gerenciado pelo Cloudflare.

<!-- more -->

## O que você vai aprender

- Por que usar uma VM para projetos e laboratórios rápidos
- Como criar uma VM (visão geral) — foco no Azure (passos essenciais)
- Criar conta no Cloudflare e preparar o domínio
- Configurar Zero Trust / Access de forma básica
- Instalar e configurar o Cloudflare Tunnel (cloudflared) na VM
- Expor um serviço (ex.: piping server) através do túnel e testar

## Motivador

Projetos caseiros muitas vezes precisam ser acessíveis pela internet. Tradicionalmente isso exige um IPv4 público, que pode ter custo elevado ou ser limitado pelo provedor. O Cloudflare Tunnel permite que você exponha serviços locais por meio de um túnel seguro até a rede Cloudflare, sem precisar de IP público. No plano gratuito é possível reduzir custos e manter controle sobre DNS, políticas e roteamento.

## Checklist rápido (pré-requisitos)

- Conta em um provedor de nuvem (ex.: Azure) com permissão para criar uma VM.
- Conta gratuita no Cloudflare e domínio gerenciável no Cloudflare (DNS).
- Acesso SSH à VM.
    - Recomenda-se usar o painel do Provider apenas para instalar o Cloudflared, e depois usar o Browser SSH do Cloudflare.
- Ferramentas básicas: curl, sudo, systemd

Se alguma etapa não for possível (ex.: você não tem domínio), há alternativas: testar localmente com `cloudflared tunnel run` e usar um subdomínio temporário do Cloudflare durante o login interativo.

## 1 — Breve explicação: máquinas virtuais e por que usá-las

Máquinas virtuais são instâncias isoladas que rodem um sistema operacional completo. Mesmo com arquiteturas modernas (containers, serverless), VMs ainda são úteis para:

- Ambientes persistentes para serviços de background
- Testes de rede e configurações de baixo nível
- Executar binários e ferramentas que exigem ambiente full-OS

Para este tutorial usamos uma VM como host do serviço (piping server) e do agente `cloudflared` que estabelece o túnel.

## 2 — Criando a VM (visão geral — Azure)

### 2.0 - Pré-requisitos:

Instalação do Azure CLI e login na conta Azure.

```bash
az login
```

### 2.1 - Criar grupo de recurso

```bash
az group create --name tutorial-codaqui --location eastus
```

#TODO Inserir GIF mostrando via Interface Web.

### 2.2 - Criar a VM sem IPv4

Para um fluxo mais controlado (e reprodutível) use um ARM template com um arquivo de parâmetros JSON — esse é o esquema esperado para o arquivo de parâmetros. Salve o JSON abaixo como `vm-parameters.json` e tenha o template ARM (`vm-template.json`) ao lado.

Exemplo do comando de deploy:

```bash
az deployment group create \
   --resource-group tutorial-codaqui \
   --template-file vm-template.json \
   --parameters @vm-parameters.json
```

Exemplo de `vm-template.json`:
```json
{
    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "location": {
            "type": "string"
        },
        "networkInterfaceName": {
            "type": "string"
        },
        "networkSecurityGroupName": {
            "type": "string"
        },
        "networkSecurityGroupRules": {
            "type": "array"
        },
        "subnetName": {
            "type": "string"
        },
        "virtualNetworkName": {
            "type": "string"
        },
        "addressPrefixes": {
            "type": "array"
        },
        "subnets": {
            "type": "array"
        },
        
        "virtualMachineName": {
            "type": "string"
        },
        "virtualMachineComputerName": {
            "type": "string"
        },
        "virtualMachineRG": {
            "type": "string"
        },
        "osDiskType": {
            "type": "string"
        },
        "osDiskSizeGiB": {
            "type": "int"
        },
        "osDiskDeleteOption": {
            "type": "string"
        },
        "virtualMachineSize": {
            "type": "string"
        },
        "nicDeleteOption": {
            "type": "string"
        },
        "adminUsername": {
            "type": "string"
        },
        "adminPassword": {
            "type": "secureString"
        }
    },
    "variables": {
        "nsgId": "[resourceId(resourceGroup().name, 'Microsoft.Network/networkSecurityGroups', parameters('networkSecurityGroupName'))]",
        "vnetName": "[parameters('virtualNetworkName')]",
        "vnetId": "[resourceId(resourceGroup().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
        "subnetRef": "[concat(variables('vnetId'), '/subnets/', parameters('subnetName'))]"
    },
    "resources": [
        {
            "name": "[parameters('networkInterfaceName')]",
            "type": "Microsoft.Network/networkInterfaces",
            "apiVersion": "2022-11-01",
            "location": "[parameters('location')]",
            "dependsOn": [
                "[concat('Microsoft.Network/networkSecurityGroups/', parameters('networkSecurityGroupName'))]",
                "[concat('Microsoft.Network/virtualNetworks/', parameters('virtualNetworkName'))]"
            ],
            "properties": {
                "ipConfigurations": [
                    {
                        "name": "ipconfig1",
                        "properties": {
                            "subnet": {
                                "id": "[variables('subnetRef')]"
                            },
                            "privateIPAllocationMethod": "Dynamic"
                        }
                    }
                ],
                "networkSecurityGroup": {
                    "id": "[variables('nsgId')]"
                }
            }
        },
        {
            "name": "[parameters('networkSecurityGroupName')]",
            "type": "Microsoft.Network/networkSecurityGroups",
            "apiVersion": "2020-05-01",
            "location": "[parameters('location')]",
            "properties": {
                "securityRules": "[parameters('networkSecurityGroupRules')]"
            }
        },
        {
            "name": "[parameters('virtualNetworkName')]",
            "type": "Microsoft.Network/virtualNetworks",
            "apiVersion": "2024-01-01",
            "location": "[parameters('location')]",
            "properties": {
                "addressSpace": {
                    "addressPrefixes": "[parameters('addressPrefixes')]"
                },
                "subnets": "[parameters('subnets')]"
            }
        },
        
        {
            "name": "[parameters('virtualMachineName')]",
            "type": "Microsoft.Compute/virtualMachines",
            "apiVersion": "2024-03-01",
            "location": "[parameters('location')]",
            "dependsOn": [
                "[concat('Microsoft.Network/networkInterfaces/', parameters('networkInterfaceName'))]"
            ],
            "properties": {
                "hardwareProfile": {
                    "vmSize": "[parameters('virtualMachineSize')]"
                },
                "storageProfile": {
                    "osDisk": {
                        "createOption": "fromImage",
                        "managedDisk": {
                            "storageAccountType": "[parameters('osDiskType')]"
                        },
                        "diskSizeGB": "[parameters('osDiskSizeGiB')]",
                        "deleteOption": "[parameters('osDiskDeleteOption')]"
                    },
                    "imageReference": {
                        "publisher": "Canonical",
                        "offer": "0001-com-ubuntu-server-jammy",
                        "sku": "22_04-lts-gen2",
                        "version": "latest"
                    }
                },
                "networkProfile": {
                    "networkInterfaces": [
                        {
                            "id": "[resourceId('Microsoft.Network/networkInterfaces', parameters('networkInterfaceName'))]",
                            "properties": {
                                "deleteOption": "[parameters('nicDeleteOption')]"
                            }
                        }
                    ]
                },
                "securityProfile": {},
                "osProfile": {
                    "computerName": "[parameters('virtualMachineComputerName')]",
                    "adminUsername": "[parameters('adminUsername')]",
                    "adminPassword": "[parameters('adminPassword')]"
                }
            }
        }
    ],
    "outputs": {
        "adminUsername": {
            "type": "string",
            "value": "[parameters('adminUsername')]"
        }
    }
}
```

Exemplo de `vm-parameters.json` (schema/valores):

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": { "value": "eastus" },
    "networkInterfaceName": { "value": "tutorial-codaqui329" },
    "networkSecurityGroupName": { "value": "tutorial-codaqui-nsg" },
    "networkSecurityGroupRules": { "value": [] },
    "subnetName": { "value": "default" },
    "virtualNetworkName": { "value": "tutorial-codaqui-vnet" },
    "addressPrefixes": { "value": ["10.1.0.0/16"] },
    "subnets": { "value": [{ "name": "default", "properties": { "addressPrefix": "10.1.1.0/24" } }] },
    "virtualMachineName": { "value": "tutorial-codaqui" },
    "virtualMachineComputerName": { "value": "tutorial-codaqu" },
    "virtualMachineRG": { "value": "teste" },
    "osDiskType": { "value": "Premium_LRS" },
    "osDiskSizeGiB": { "value": 64 },
    "osDiskDeleteOption": { "value": "Delete" },
    "virtualMachineSize": { "value": "Standard_B1s" },
    "nicDeleteOption": { "value": "Detach" },
    "adminUsername": { "value": "codaqui" },
    "adminPassword": { "value": "CoDAqui123!" }
  }
}
```

Observações:

- O template cria uma VM Ubuntu Linux (gratuita) com autenticação por senha.
- Use uma senha forte (exemplo: `CoDAqui123!`) ou altere no arquivo de parâmetros.
- Sem IP público, use o Azure Serial Console ou Azure Bastion para acessar a VM após o deploy.
- O Cloudflare Tunnel fará o roteamento, eliminando a necessidade de IP público fixo.

Depois do deploy, você pode conectar via console do Azure Portal (Serial Console) usando o usuário `codaqui` e a senha definida.

Observação: a VM precisa de saída para internet para que o `cloudflared` consiga estabelecer o túnel.

## 3 — Criar conta no Cloudflare e configurar DNS

1. Crie uma conta gratuita em https://dash.cloudflare.com
2. Adicione seu domínio e aponte NS para o Cloudflare
3. No painel DNS, adicione um registro CNAME ou A para o subdomínio que você quer usar; mais adiante vamos mapear esse hostname para o túnel (Cloudflare criará o registro correto quando usarmos `cloudflared tunnel route dns`).

Dica: no plano gratuito você já tem acesso ao serviço de DNS e a funcionalidades básicas de Zero Trust (Access). Não é necessário contratar plano pago para este fluxo básico.

## 4 — Noções básicas de Zero Trust (opcional nessa etapa)

O Zero Trust no Cloudflare (Access) permite proteger o acesso ao host com políticas (e.g., SSO, lista de usuários). Para um laboratório você pode:

- Criar uma aplicação em Access e exigir autenticação via GitHub/Google
- Usar políticas por endereço IP ou por identidade

Essas configurações ficam no painel "Zero Trust" (antigo Access) e podem ser aplicadas ao hostname que vamos criar.

## 5 — Instalar e configurar o Cloudflare Tunnel na VM

Passos principais:

1. Instalar `cloudflared`
2. Logar o `cloudflared` na conta Cloudflare (gera um arquivo de credenciais)
3. Criar o túnel e mapear um hostname
4. Criar arquivo de configuração e rodar como serviço

Exemplo (Ubuntu/Debian):

```bash
# baixar o binário mais recente
curl -L -o cloudflared \
   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# fazer login (abre uma URL para autenticação no Cloudflare)
cloudflared tunnel login

# criar o túnel (gera um UUID)
cloudflared tunnel create lab-tunnel

# vincular um hostname DNS gerenciado pelo Cloudflare ao túnel
cloudflared tunnel route dns lab-tunnel app.example.com

# criar config em /etc/cloudflared/config.yml
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<'YAML'
tunnel: <TUNNEL-UUID>
credentials-file: /etc/cloudflared/<TUNNEL-UUID>.json
ingress:
   - hostname: app.example.com
      service: http://localhost:8080
   - service: http_status:404
YAML

# instalar como serviço systemd (opcional: cloudflared oferece comando helper)
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<'UNIT'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared --config /etc/cloudflared/config.yml run
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
```

Notas:
- Substitua `<TUNNEL-UUID>` e `app.example.com` pelos valores reais retornados pelos comandos.
- Se `cloudflared tunnel login` não puder abrir um navegador na VM, execute o login em uma máquina local e copie o arquivo de credenciais para a VM, ou use um Service Token/Account para automação.

## 6 — Exemplo: Deploy de um "Piping Server" local e exposição via Tunnel

Para o exemplo vamos supor que exista um serviço HTTP simples rodando na porta 8080 (poderia ser o piping server ou qualquer app). Se você quiser testar rápido:

```bash
# exemplo rápido com Python (na VM)
python3 -m http.server 8080 --bind 127.0.0.1
```

Com o túnel configurado e o DNS apontado, a URL https://app.example.com ficará disponível publicamente e será roteada para a aplicação local.

Teste:

```bash
curl -I https://app.example.com
```

Você deve receber uma resposta HTTP 200 (ou o cabeçalho do servidor simples).

## 7 — Segurança e boas práticas

- Use `cloudflared tunnel route dns` para que o Cloudflare gerencie o DNS do hostname
- Restrinja o acesso com Zero Trust/Access quando expor serviços administrativos
- Mantenha `cloudflared` atualizado
- Automatize o deploy do tunnel com scripts/secrets quando usar em produção

## 8 — Limitações e casos de uso

- Cloudflare Tunnel não substitui redes privadas complexas ou balanceamento interno avançado
- Para serviços com alto throughput verifique limites do plano e latência
- Economiza custo de IP público e simplifica roteamento para pequenos serviços e laboratórios

## Conclusão

O Cloudflare Tunnel é uma solução prática para expor serviços rodando em VMs sem a necessidade de um IPv4 público dedicado. Para laboratórios e projetos pessoais ele reduz custo e adiciona camadas úteis de segurança e gestão via Cloudflare.

Se quiser, no próximo artigo podemos:

- Automatizar criação do túnel via CI/CD
- Integrar autenticação SSO (Zero Trust) ao hostname
- Expor múltiplos serviços com path-based routing

---

Se preferir que eu atualize também um passo a passo completo com prints, arquivos de configuração e exemplos de systemd mais avançados, me diga que eu adiciono na sequência.