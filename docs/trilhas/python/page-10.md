# Manipulação de Arquivos

## Introdução

A manipulação de arquivos é uma habilidade fundamental em programação, permitindo que aplicações salvem dados persistentemente, processem informações externas e compartilhem resultados. Python oferece ferramentas robustas e intuitivas para trabalhar com diversos formatos de arquivos.

!!! info "Objetivos de Aprendizado"
    - Entender os conceitos básicos de manipulação de arquivos
    - Aprender a ler e escrever arquivos de texto
    - Trabalhar com formatos estruturados como JSON e CSV
    - Manipular arquivos binários
    - Gerenciar caminhos de arquivo com o módulo `os.path`
    - Aplicar boas práticas no trabalho com arquivos

## Conceitos Básicos

=== "Abrindo e Fechando Arquivos"
    ```python
    # Método tradicional
    arquivo = open("dados.txt", "r")  # Modo de leitura
    conteudo = arquivo.read()
    arquivo.close()  # Importante: sempre feche os arquivos!
    
    # Método recomendado: using context manager (with)
    with open("dados.txt", "r") as arquivo:
        conteudo = arquivo.read()
    # O arquivo é fechado automaticamente ao sair do bloco with
    ```

=== "Modos de Abertura"
    ```python
    # Principais modos de abertura
    
    # "r" - Leitura (padrão). Arquivo deve existir.
    with open("arquivo.txt", "r") as f:
        dados = f.read()
    
    # "w" - Escrita. Cria arquivo novo ou sobrescreve existente.
    with open("arquivo.txt", "w") as f:
        f.write("Olá, mundo!")
    
    # "a" - Append (anexar). Adiciona ao final do arquivo.
    with open("arquivo.txt", "a") as f:
        f.write("\nNova linha.")
    
    # "x" - Criação exclusiva. Falha se o arquivo já existir.
    with open("novo_arquivo.txt", "x") as f:
        f.write("Arquivo novo")
    
    # "b" - Modo binário (usado junto com outros modos)
    with open("imagem.jpg", "rb") as f:
        dados_binarios = f.read()
    
    # "t" - Modo texto (padrão, usado junto com outros modos)
    with open("arquivo.txt", "rt") as f:
        texto = f.read()
    
    # "+" - Atualização (leitura e escrita)
    with open("arquivo.txt", "r+") as f:
        texto = f.read()
        f.write("Nova informação")
    ```

=== "Encodings"
    ```python
    # Especificando o encoding (importante para caracteres não-ASCII)
    
    # UTF-8 (recomendado para compatibilidade)
    with open("arquivo.txt", "r", encoding="utf-8") as f:
        texto = f.read()
    
    # Latin-1 (ISO-8859-1)
    with open("arquivo_latin1.txt", "r", encoding="latin-1") as f:
        texto = f.read()
    
    # Tratando erros de encoding
    with open("arquivo_problematico.txt", "r", encoding="utf-8", errors="ignore") as f:
        texto = f.read()  # Ignora caracteres inválidos
    
    with open("arquivo_problematico.txt", "r", encoding="utf-8", errors="replace") as f:
        texto = f.read()  # Substitui caracteres inválidos por '�'
    ```

## Trabalhando com Arquivos de Texto

=== "Leitura Básica"
    ```python
    # Lendo arquivo inteiro
    with open("exemplo.txt", "r", encoding="utf-8") as arquivo:
        conteudo = arquivo.read()
        print(conteudo)
    
    # Lendo linha por linha
    with open("exemplo.txt", "r", encoding="utf-8") as arquivo:
        for linha in arquivo:
            print(linha.strip())  # strip() remove espaços e quebras de linha extras
    
    # Lendo todas as linhas em uma lista
    with open("exemplo.txt", "r", encoding="utf-8") as arquivo:
        linhas = arquivo.readlines()
        print(f"O arquivo tem {len(linhas)} linhas")
        for i, linha in enumerate(linhas):
            print(f"Linha {i+1}: {linha.strip()}")
    ```

=== "Leitura Controlada"
    ```python
    # Lendo um número específico de caracteres
    with open("exemplo.txt", "r", encoding="utf-8") as arquivo:
        inicio = arquivo.read(10)  # Primeiros 10 caracteres
        print(f"Início do arquivo: {inicio}")
    
    # Lendo linha por linha com readline()
    with open("exemplo.txt", "r", encoding="utf-8") as arquivo:
        primeira_linha = arquivo.readline()
        segunda_linha = arquivo.readline()
        print(f"1ª linha: {primeira_linha.strip()}")
        print(f"2ª linha: {segunda_linha.strip()}")
    
    # Navegando no arquivo
    with open("exemplo.txt", "r", encoding="utf-8") as arquivo:
        arquivo.seek(10)  # Move o cursor para o 10º byte
        trecho = arquivo.read(5)
        print(f"5 caracteres a partir do 10º byte: {trecho}")
        
        posicao_atual = arquivo.tell()  # Retorna a posição atual
        print(f"Posição atual: {posicao_atual}")
    ```

=== "Escrita Básica"
    ```python
    # Escrevendo texto simples
    with open("saida.txt", "w", encoding="utf-8") as arquivo:
        arquivo.write("Olá, mundo!\n")
        arquivo.write("Esta é a segunda linha.\n")
    
    # Escrevendo múltiplas linhas de uma vez
    linhas = ["Primeira linha", "Segunda linha", "Terceira linha"]
    with open("saida.txt", "w", encoding="utf-8") as arquivo:
        arquivo.writelines(f"{linha}\n" for linha in linhas)
    
    # Anexando ao final do arquivo
    with open("saida.txt", "a", encoding="utf-8") as arquivo:
        arquivo.write("Esta linha será anexada ao final.\n")
    ```

=== "Operações Combinadas"
    ```python
    # Lendo, modificando e reescrevendo
    with open("arquivo.txt", "r", encoding="utf-8") as arquivo:
        conteudo = arquivo.read()
    
    # Processa o conteúdo
    conteudo_modificado = conteudo.replace("antigo", "novo")
    
    with open("arquivo.txt", "w", encoding="utf-8") as arquivo:
        arquivo.write(conteudo_modificado)
    
    # Copiando conteúdo de um arquivo para outro
    with open("origem.txt", "r", encoding="utf-8") as origem:
        with open("destino.txt", "w", encoding="utf-8") as destino:
            for linha in origem:
                destino.write(linha)
    ```

!!! warning "Arquivos grandes"
    Para arquivos muito grandes, evite usar `read()` para ler todo o conteúdo de uma vez, pois isso pode consumir muita memória. Prefira ler linha por linha ou em pequenos blocos, usando um loop.

## Arquivos CSV (Comma-Separated Values)

CSV é um formato popular para armazenar dados tabulares (como planilhas) como texto.

=== "Lendo Arquivos CSV"
    ```python
    import csv
    
    # Lendo um CSV simples
    with open("dados.csv", "r", encoding="utf-8", newline="") as arquivo:
        leitor = csv.reader(arquivo)
        for linha in leitor:
            print(linha)  # linha é uma lista de valores
    
    # Lendo com cabeçalhos
    with open("dados.csv", "r", encoding="utf-8", newline="") as arquivo:
        leitor = csv.DictReader(arquivo)  # Usa a primeira linha como chaves
        for linha in leitor:
            print(linha)  # linha é um dicionário
            print(f"Nome: {linha['nome']}, Idade: {linha['idade']}")
    
    # Especificando delimitador
    with open("dados.tsv", "r", encoding="utf-8", newline="") as arquivo:
        leitor = csv.reader(arquivo, delimiter="\t")  # Tabulação como delimitador
        for linha in leitor:
            print(linha)
    ```

=== "Escrevendo Arquivos CSV"
    ```python
    import csv
    
    # Escrevendo um CSV simples
    dados = [
        ["Nome", "Idade", "Cidade"],
        ["João", "25", "São Paulo"],
        ["Maria", "30", "Rio de Janeiro"],
        ["Pedro", "22", "Belo Horizonte"]
    ]
    
    with open("pessoas.csv", "w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        for linha in dados:
            escritor.writerow(linha)  # Escreve uma linha
    
    # Ou, mais diretamente:
    with open("pessoas.csv", "w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerows(dados)  # Escreve todas as linhas
    
    # Escrevendo com dicionários
    dados_dict = [
        {"nome": "João", "idade": 25, "cidade": "São Paulo"},
        {"nome": "Maria", "idade": 30, "cidade": "Rio de Janeiro"},
        {"nome": "Pedro", "idade": 22, "cidade": "Belo Horizonte"}
    ]
    
    with open("pessoas_dict.csv", "w", encoding="utf-8", newline="") as arquivo:
        campos = ["nome", "idade", "cidade"]
        escritor = csv.DictWriter(arquivo, fieldnames=campos)
        escritor.writeheader()  # Escreve a linha de cabeçalho
        escritor.writerows(dados_dict)
    ```

=== "Exemplo Prático: Análise de Dados"
    ```python
    import csv
    from collections import defaultdict
    
    # Suponha um CSV com dados de vendas (produto, quantidade, valor)
    
    # Analisar vendas por produto
    vendas_por_produto = defaultdict(int)
    total_vendas = 0
    
    with open("vendas.csv", "r", encoding="utf-8", newline="") as arquivo:
        leitor = csv.DictReader(arquivo)
        for venda in leitor:
            produto = venda["produto"]
            quantidade = int(venda["quantidade"])
            valor = float(venda["valor"])
            
            vendas_por_produto[produto] += quantidade
            total_vendas += quantidade * valor
    
    # Exibir resultados
    print(f"Total de vendas: R$ {total_vendas:.2f}")
    print("\nQuantidade vendida por produto:")
    for produto, quantidade in sorted(vendas_por_produto.items()):
        print(f"{produto}: {quantidade} unidades")
    ```

## Arquivos JSON

JSON (JavaScript Object Notation) é um formato leve para troca de dados, fácil de ler e escrever.

=== "Lendo Arquivos JSON"
    ```python
    import json
    
    # Lendo um arquivo JSON
    with open("dados.json", "r", encoding="utf-8") as arquivo:
        dados = json.load(arquivo)
        
    print(type(dados))  # <class 'dict'> ou <class 'list'> dependendo do JSON
    
    # Acessando dados
    if isinstance(dados, dict):
        print(f"Nome: {dados.get('nome')}")
        print(f"Idade: {dados.get('idade')}")
    elif isinstance(dados, list):
        for item in dados:
            print(f"Item: {item}")
    ```

=== "Escrevendo Arquivos JSON"
    ```python
    import json
    
    # Criando um dicionário
    pessoa = {
        "nome": "João Silva",
        "idade": 30,
        "cidade": "São Paulo",
        "habilidades": ["Python", "JavaScript", "SQL"],
        "ativo": True,
        "contatos": {
            "email": "joao@exemplo.com",
            "telefone": "123-456-789"
        }
    }
    
    # Salvando como JSON
    with open("pessoa.json", "w", encoding="utf-8") as arquivo:
        json.dump(pessoa, arquivo, indent=4, ensure_ascii=False)
        # indent: formata o JSON para fácil leitura
        # ensure_ascii=False: preserva caracteres não-ASCII (acentos, etc.)
    
    # Convertendo para string JSON
    json_str = json.dumps(pessoa, indent=4, ensure_ascii=False)
    print(json_str)
    
    # Salvando uma lista de objetos
    pessoas = [
        {"nome": "João", "idade": 30},
        {"nome": "Maria", "idade": 25},
        {"nome": "Pedro", "idade": 40}
    ]
    
    with open("pessoas.json", "w", encoding="utf-8") as arquivo:
        json.dump(pessoas, arquivo, indent=4, ensure_ascii=False)
    ```

=== "Trabalhando com JSON Complexo"
    ```python
    import json
    
    # Carregando um JSON complexo
    with open("dados_complexos.json", "r", encoding="utf-8") as arquivo:
        dados = json.load(arquivo)
    
    # Navegando em uma estrutura aninhada
    if "usuarios" in dados:
        for usuario in dados["usuarios"]:
            print(f"Nome: {usuario['nome']}")
            
            if "enderecos" in usuario:
                for endereco in usuario["enderecos"]:
                    print(f"  Rua: {endereco['rua']}, Cidade: {endereco['cidade']}")
            
            if "pedidos" in usuario:
                total_pedidos = sum(pedido["valor"] for pedido in usuario["pedidos"])
                print(f"  Total de pedidos: R$ {total_pedidos:.2f}")
    
    # Modificando e salvando
    dados["ultima_atualizacao"] = "2023-05-10"
    
    with open("dados_atualizados.json", "w", encoding="utf-8") as arquivo:
        json.dump(dados, arquivo, indent=2, ensure_ascii=False)
    ```

=== "Convertendo entre JSON e CSV"
    ```python
    import json
    import csv
    
    # JSON para CSV
    with open("dados.json", "r", encoding="utf-8") as arquivo_json:
        dados = json.load(arquivo_json)
    
    # Supondo que dados é uma lista de dicionários
    if dados and isinstance(dados, list):
        # Extrai as chaves do primeiro item como cabeçalhos
        campos = dados[0].keys()
        
        with open("dados.csv", "w", encoding="utf-8", newline="") as arquivo_csv:
            escritor = csv.DictWriter(arquivo_csv, fieldnames=campos)
            escritor.writeheader()
            escritor.writerows(dados)
    
    # CSV para JSON
    dados_json = []
    
    with open("dados.csv", "r", encoding="utf-8", newline="") as arquivo_csv:
        leitor = csv.DictReader(arquivo_csv)
        for linha in leitor:
            dados_json.append(linha)
    
    with open("dados_convertidos.json", "w", encoding="utf-8") as arquivo_json:
        json.dump(dados_json, arquivo_json, indent=4, ensure_ascii=False)
    ```

## Trabalhando com Arquivos Binários

=== "Leitura e Escrita Binária"
    ```python
    # Lendo arquivo binário
    with open("imagem.jpg", "rb") as arquivo:
        dados = arquivo.read()
        print(f"Tamanho: {len(dados)} bytes")
        print(f"Primeiros bytes: {dados[:10].hex()}")
    
    # Escrevendo arquivo binário
    dados_binarios = bytes([0x48, 0x65, 0x6C, 0x6C, 0x6F])  # "Hello" em ASCII
    with open("dados.bin", "wb") as arquivo:
        arquivo.write(dados_binarios)
    ```

=== "Copiando Arquivos Binários"
    ```python
    def copiar_arquivo(origem, destino, tamanho_buffer=4096):
        """Copia um arquivo binário em blocos para economizar memória."""
        with open(origem, "rb") as arquivo_origem:
            with open(destino, "wb") as arquivo_destino:
                while True:
                    buffer = arquivo_origem.read(tamanho_buffer)
                    if not buffer:
                        break
                    arquivo_destino.write(buffer)
    
    # Uso
    copiar_arquivo("imagem_original.jpg", "imagem_copia.jpg")
    ```

=== "Manipulando Imagens (com Pillow)"
    ```python
    # Precisa instalar: pip install Pillow
    from PIL import Image
    
    # Abrir uma imagem
    imagem = Image.open("foto.jpg")
    print(f"Formato: {imagem.format}")
    print(f"Tamanho: {imagem.size}")
    print(f"Modo: {imagem.mode}")
    
    # Redimensionar
    imagem_redimensionada = imagem.resize((800, 600))
    imagem_redimensionada.save("foto_redimensionada.jpg")
    
    # Converter para escala de cinza
    imagem_pb = imagem.convert("L")
    imagem_pb.save("foto_pb.jpg")
    
    # Recortar
    area = (100, 100, 400, 400)  # (left, upper, right, lower)
    imagem_recortada = imagem.crop(area)
    imagem_recortada.save("foto_recortada.jpg")
    ```

## Gerenciamento de Caminhos e Diretórios

=== "Trabalhando com Caminhos"
    ```python
    import os
    import os.path
    
    # Caminhos absolutos vs. relativos
    caminho_absoluto = "/home/usuario/documentos/arquivo.txt"
    caminho_relativo = "documentos/arquivo.txt"
    
    # Obtendo o diretório atual
    diretorio_atual = os.getcwd()
    print(f"Diretório atual: {diretorio_atual}")
    
    # Juntando caminhos (funciona em todos os sistemas operacionais)
    caminho = os.path.join("pasta", "subpasta", "arquivo.txt")
    print(caminho)  # Ex: pasta/subpasta/arquivo.txt (no Unix)
    
    # Extraindo componentes do caminho
    arquivo = "/home/usuario/documentos/relatorio.pdf"
    print(f"Diretório: {os.path.dirname(arquivo)}")       # /home/usuario/documentos
    print(f"Nome do arquivo: {os.path.basename(arquivo)}") # relatorio.pdf
    print(f"Nome sem extensão: {os.path.splitext(os.path.basename(arquivo))[0]}")  # relatorio
    print(f"Extensão: {os.path.splitext(arquivo)[1]}")    # .pdf
    
    # Verificando existência
    existe = os.path.exists(arquivo)
    e_arquivo = os.path.isfile(arquivo)
    e_diretorio = os.path.isdir(os.path.dirname(arquivo))
    
    print(f"Existe? {existe}")
    print(f"É arquivo? {e_arquivo}")
    print(f"É diretório? {e_diretorio}")
    
    # Obtendo informações do arquivo
    if os.path.exists(arquivo):
        tamanho = os.path.getsize(arquivo)  # tamanho em bytes
        data_mod = os.path.getmtime(arquivo)  # timestamp da última modificação
        
        import datetime
        data_formatada = datetime.datetime.fromtimestamp(data_mod).strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"Tamanho: {tamanho} bytes")
        print(f"Última modificação: {data_formatada}")
    ```

=== "Operações com Diretórios"
    ```python
    import os
    import shutil
    
    # Listar conteúdo de um diretório
    for item in os.listdir("."):  # "." representa o diretório atual
        tipo = "Diretório" if os.path.isdir(item) else "Arquivo"
        print(f"{item} - {tipo}")
    
    # Listar com mais detalhes usando glob
    import glob
    
    # Todos os arquivos Python no diretório atual
    arquivos_py = glob.glob("*.py")
    print(f"Arquivos Python: {arquivos_py}")
    
    # Todos os arquivos em uma estrutura de diretórios
    arquivos_txt = glob.glob("**/*.txt", recursive=True)
    print(f"Arquivos de texto em todos os subdiretórios: {arquivos_txt}")
    
    # Criar diretório
    os.makedirs("nova_pasta/subpasta", exist_ok=True)
    
    # Copiar arquivo
    shutil.copy2("origem.txt", "destino.txt")
    
    # Mover arquivo
    shutil.move("arquivo.txt", "nova_pasta/arquivo.txt")
    
    # Remover arquivo
    os.remove("arquivo_para_remover.txt")
    
    # Remover diretório vazio
    os.rmdir("diretorio_vazio")
    
    # Remover diretório com conteúdo
    shutil.rmtree("diretorio_com_arquivos")
    ```

=== "Caminhando em uma Árvore de Diretórios"
    ```python
    import os
    
    def listar_arquivos_recursivamente(diretorio):
        """Lista todos os arquivos em um diretório e seus subdiretórios."""
        for raiz, dirs, arquivos in os.walk(diretorio):
            print(f"\nDiretório: {raiz}")
            
            if arquivos:
                print("Arquivos:")
                for arquivo in arquivos:
                    caminho_completo = os.path.join(raiz, arquivo)
                    tamanho = os.path.getsize(caminho_completo)
                    print(f"  - {arquivo} ({tamanho} bytes)")
    
    # Uso
    listar_arquivos_recursivamente(".")  # Lista a partir do diretório atual
    ```

## Boas Práticas

=== "Gerenciamento de Recursos"
    ```python
    # SEMPRE use 'with' para abrir arquivos
    
    # Correto:
    with open("arquivo.txt", "r") as arquivo:
        conteudo = arquivo.read()
    
    # Evite:
    arquivo = open("arquivo.txt", "r")
    try:
        conteudo = arquivo.read()
    finally:
        arquivo.close()
    
    # Ruim (pode deixar o arquivo aberto em caso de exceção):
    arquivo = open("arquivo.txt", "r")
    conteudo = arquivo.read()
    arquivo.close()
    ```

=== "Tratamento de Exceções"
    ```python
    # Sempre trate exceções ao trabalhar com arquivos
    try:
        with open("arquivo.txt", "r") as arquivo:
            conteudo = arquivo.read()
    except FileNotFoundError:
        print("Arquivo não encontrado.")
    except PermissionError:
        print("Sem permissão para acessar o arquivo.")
    except UnicodeDecodeError:
        print("Erro de decodificação. Verifique o encoding do arquivo.")
    except Exception as e:
        print(f"Erro não esperado: {e}")
    
    # Para operações em lote, continue mesmo após erro
    arquivos = ["arquivo1.txt", "arquivo2.txt", "arquivo3.txt"]
    
    for nome_arquivo in arquivos:
        try:
            with open(nome_arquivo, "r") as arquivo:
                # Processa o arquivo
                print(f"Processando {nome_arquivo}...")
        except Exception as e:
            print(f"Erro ao processar {nome_arquivo}: {e}")
            continue  # Continue para o próximo arquivo
    ```

=== "Desempenho"
    ```python
    # Otimizando leitura de grandes arquivos
    
    # Em vez de ler todo o arquivo de uma vez:
    def processar_arquivo_grande(nome_arquivo):
        with open(nome_arquivo, "r") as arquivo:
            # Processa uma linha por vez
            for linha in arquivo:
                # Faz algo com a linha
                processar_linha(linha)
    
    # Otimizando a escrita com buffers
    def escrever_muitas_linhas(nome_arquivo, num_linhas):
        with open(nome_arquivo, "w", buffering=8192) as arquivo:
            for i in range(num_linhas):
                arquivo.write(f"Linha {i}\n")
    ```

=== "Sanitização de Caminhos"
    ```python
    import os
    
    # Sempre sanitize caminhos fornecidos por usuários
    def caminho_seguro(base_dir, caminho_usuario):
        """Garante que o caminho do usuário não escape do diretório base."""
        # Obter o caminho absoluto normalizado
        caminho_completo = os.path.normpath(os.path.join(base_dir, caminho_usuario))
        
        # Verificar se o caminho está dentro do diretório base
        if não caminho_completo.startswith(os.path.abspath(base_dir)):
            raise ValueError("Tentativa de acesso a um diretório não permitido")
            
        return caminho_completo
    
    # Uso
    try:
        arquivo = caminho_seguro("/home/usuario/arquivos", "../../../etc/passwd")
        # Isso levantará uma exceção
    except ValueError as e:
        print(f"Erro: {e}")
    ```

## Exemplos Práticos

=== "Analisador de Log"
    ```python
    # Analisador de arquivo de log simples
    def analisar_log(arquivo_log):
        erros = []
        avisos = []
        infos = 0
        
        try:
            with open(arquivo_log, "r", encoding="utf-8") as log:
                for linha in log:
                    if "ERROR" in linha:
                        erros.append(linha.strip())
                    elif "WARNING" in linha:
                        avisos.append(linha.strip())
                    elif "INFO" in linha:
                        infos += 1
                        
            print(f"Análise do arquivo de log: {arquivo_log}")
            print(f"Total de mensagens INFO: {infos}")
            print(f"Total de avisos: {len(avisos)}")
            print(f"Total de erros: {len(erros)}")
            
            if erros:
                print("\nErros encontrados:")
                for erro em erros[:5]:  # Primeiros 5 erros
                    print(f"  {erro}")
                if len(erros) > 5:
                    print(f"  ... e mais {len(erros) - 5} erros")
                    
        except Exception as e:
            print(f"Erro ao analisar o arquivo de log: {e}")
            
    # Uso
    analisar_log("aplicacao.log")
    ```

=== "Conversor de Formato"
    ```python
    import json
    import csv
    import os
    
    def converter_csv_para_json(arquivo_csv, arquivo_json=None):
        """Converte um arquivo CSV para JSON."""
        if arquivo_json is None:
            nome_base = os.path.splitext(arquivo_csv)[0]
            arquivo_json = f"{nome_base}.json"
            
        dados = []
        
        try:
            with open(arquivo_csv, "r", encoding="utf-8", newline="") as csv_file:
                leitor = csv.DictReader(csv_file)
                for linha em leitor:
                    # Converter strings numéricas para números
                    for chave, valor em linha.items():
                        if valor.isdigit():
                            linha[chave] = int(valor)
                        elif valor.replace(".", "", 1).isdigit() and valor.count(".") <= 1:
                            linha[chave] = float(valor)
                    dados.append(linha)
                    
            with open(arquivo_json, "w", encoding="utf-8") as json_file:
                json.dump(dados, json_file, indent=2, ensure_ascii=False)
                
            print(f"Arquivo convertido com sucesso: {arquivo_csv} -> {arquivo_json}")
            print(f"Total de registros: {len(dados)}")
            return True
            
        except Exception as e:
            print(f"Erro durante a conversão: {e}")
            return False
            
    # Uso
    converter_csv_para_json("dados.csv")
    ```

=== "Backup de Diretório"
    ```python
    import os
    import shutil
    import zipfile
    import datetime
    
    def fazer_backup(diretorio_origem, diretorio_destino=None):
        """Cria um backup compactado de um diretório."""
        # Nome do arquivo de backup
        data_atual = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        nome_diretorio = os.path.basename(os.path.normpath(diretorio_origem))
        nome_backup = f"backup_{nome_diretorio}_{data_atual}.zip"
        
        # Diretório de destino
        if diretorio_destino is None:
            diretorio_destino = os.getcwd()
            
        caminho_backup = os.path.join(diretorio_destino, nome_backup)
        
        try:
            # Criar arquivo ZIP
            with zipfile.ZipFile(caminho_backup, "w", zipfile.ZIP_DEFLATED) as zipf:
                # Percorrer todos os arquivos e subdiretórios
                for raiz, _, arquivos em os.walk(diretorio_origem):
                    for arquivo em arquivos:
                        caminho_completo = os.path.join(raiz, arquivo)
                        # Caminho relativo dentro do ZIP
                        caminho_relativo = os.path.relpath(caminho_completo, diretorio_origem)
                        zipf.write(caminho_completo, caminho_relativo)
                        
            print(f"Backup criado com sucesso: {caminho_backup}")
            return caminho_backup
            
        except Exception as e:
            print(f"Erro ao criar backup: {e}")
            return None
            
    # Uso
    fazer_backup("./meus_documentos", "./backups")
    ```

## Resumo

Nesta aula, você aprendeu sobre:

- **Operações básicas** de leitura e escrita em arquivos
- **Diferentes modos** de abertura de arquivos
- **Trabalhando com encodings** para lidar com diferentes conjuntos de caracteres
- **Manipulação de arquivos CSV** para dados tabulares
- **Manipulação de arquivos JSON** para dados estruturados
- **Trabalhando com arquivos binários**
- **Gerenciamento de caminhos e diretórios** com os módulos `os` e `os.path`
- **Boas práticas** para trabalhar com arquivos em Python
- **Exemplos práticos** de manipulação de arquivos

!!! info "Recursos de aprendizado"
    - [Documentação oficial sobre manipulação de arquivos](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files){:target="_blank"}
    - [Documentação do módulo csv](https://docs.python.org/3/library/csv.html){:target="_blank"}
    - [Documentação do módulo json](https://docs.python.org/3/library/json.html){:target="_blank"}
    - [Documentação do módulo os.path](https://docs.python.org/3/library/os.path.html){:target="_blank"}
    - [Documentação do módulo shutil](https://docs.python.org/3/library/shutil.html){:target="_blank"}

## Próximos Passos

Na próxima aula, exploraremos iteradores e geradores, poderosas ferramentas para processamento de dados de forma eficiente.

[Avance para a próxima aula →](/docs/trilhas/python/page-11)

[← Voltar para Módulos](/docs/trilhas/python/page-9)

