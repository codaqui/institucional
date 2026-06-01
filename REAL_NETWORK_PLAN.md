<!-- AGENT-INDEX
purpose: Plano teórico de uma rede social local federada integrada ao sistema Codaqui.
audience: Engenheiros, contribuidores, visionários
status: RFC (teoria exploratória — não implementado)
sections:
  - Motivação e contexto
  - Identidade: GitHub como âncora
  - Ponte GitHub → Mastodon (sem hospedar ActivityPub)
  - Rede Social Local (RSL): a camada presencial
  - Mecanismos de proximidade (QR Code, Bluetooth, NFC)
  - Viabilidade técnica PWA (§5.5) — o que funciona hoje sem app nativo
  - Arquitetura técnica proposta
  - Fluxos de usuário
  - Governança, moderação e decaimento temporal (§8)
  - Riscos e limitações
  - Próximos passos
related-docs:
  - AGENTS.md — stack, convenções gerais
  - MULTISITE_PLAN.md — multisite por comunidade
  - CLUB_PLAN.md — plano do Clube Codaqui
agent-protocol:
  - Este é um documento de visão/teoria, NÃO um backlog de sprint.
  - Leia as seções de Arquitetura e Fluxos antes de propor implementação.
  - Cada camada (identidade, federação, proximidade) pode ser desenvolvida de forma independente.
-->

# REAL_NETWORK_PLAN.md — Rede Social Local Federada com Identidade GitHub

> **Status:** RFC exploratório · Não implementado · Data: 2026-05-25
>
> Este documento é um exercício de teoria e arquitetura. Brincamos com a ideia de
> unir **identidade GitHub**, **federação ActivityPub via Mastodon** e **verificação
> presencial de proximidade** (QR Code / Bluetooth) para criar uma rede social
> enraizada no mundo real — sem construir do zero um servidor ActivityPub próprio.

---

## 1. Motivação e contexto

### O problema das redes sociais convencionais

As grandes redes sociais (X, Instagram, LinkedIn) têm três problemas estruturais que
afetam comunidades como a Codaqui:

| Problema | Impacto na Codaqui |
|----------|-------------------|
| **Walled gardens** | Dados dos membros presos em plataformas de terceiros |
| **Algoritmos de engajamento** | Favorecem polarização, não colaboração técnica |
| **Identidade não verificável** | Qualquer conta pode se dizer "desenvolvedor da Codaqui" |
| **Desconexão do mundo real** | Relações digitais sem contrapartida presencial |

### A inspiração: Rede Social Local (RSL)

Luciano Ramalho (ramalho.org) propõe uma rede social federada onde a validação de
conta exige encontros **presenciais** com membros existentes — o convívio no mundo
real como critério de entrada e permanência. A ideia é simples e poderosa:

> *"Você não pode ser um troll, porque é muito fácil ser banido de um lugar físico
> e de uma turma que se encontra regularmente."*

A Codaqui já tem esse ingrediente: **eventos físicos** (DevParaná Conf, workshops,
encontros de comunidade). A questão é: como digitalizamos essa confiança presencial
sem criar um sistema pesado do zero?

---

## 2. Identidade: GitHub como âncora

### Por que GitHub?

A Codaqui já usa GitHub OAuth para autenticação no painel admin e no site. O GitHub
provê três propriedades valiosas:

1. **Identidade verificável** — conta associada a commits, PRs, histórico público
2. **Reputação técnica** — stars, contribuições, organizações são sinais de contexto
3. **Sem custo de onboarding** — membros da comunidade tech já têm conta

### Limitações do GitHub como identidade social

| Limitação | Consequência |
|-----------|-------------|
| Não suporta ActivityPub | Não é federated por natureza |
| Focado em código | Não é apropriado para posts sociais/eventos |
| Privado por padrão em atividades não técnicas | Baixa sinalização social |

### A solução: GitHub como âncora, Mastodon como canal social

```
┌──────────────────────────────────────────────────────┐
│                   IDENTIDADE DO USUÁRIO              │
│                                                      │
│   GitHub ID ──── âncora de confiança técnica         │
│        │                                             │
│        └──── vinculado a ──► Mastodon Handle         │
│                               (conta existente       │
│                               em qualquer instância) │
└──────────────────────────────────────────────────────┘
```

O usuário mantém sua conta GitHub E sua conta Mastodon. A Codaqui apenas **verifica
o vínculo** entre os dois — sem hospedar nada do ActivityPub.

---

## 3. Ponte GitHub → Mastodon (sem hospedar ActivityPub)

### Estratégia: verificação de propriedade cruzada

Mastodon já suporta verificação de links externos via `rel="me"`. O fluxo proposto:

```
1. Usuário cadastra seu handle Mastodon no perfil Codaqui
   ex: @joao@fosstodon.org

2. Sistema Codaqui faz fetch do perfil público Mastodon via API:
   GET https://fosstodon.org/api/v1/accounts/lookup?acct=joao
   → verifica se o campo `fields` contém um link para codaqui.dev

3. O perfil do usuário no Mastodon deve conter um link verificado:
   <a rel="me" href="https://codaqui.dev/membros/joao">Codaqui</a>

4. Quando ambos os lados batem (codaqui.dev aponta para mastodon,
   mastodon aponta para codaqui.dev), o vínculo é considerado verificado.
```

### O que a Codaqui passa a poder fazer

Com o vínculo verificado, o sistema Codaqui pode:

- **Publicar no Mastodon em nome do membro** (via OAuth Mastodon) após aprovação
- **Agregar posts públicos do membro** (via API pública do Mastodon) na página de perfil
- **Emitir "badges" de membro verificado** que aparecem no perfil Mastodon via campo `fields`
- **Notificar o membro via Mastodon** sobre eventos, aprovações de reembolso, etc.

### Implementação técnica: o que é necessário

```typescript
// backend/src/mastodon/ (módulo novo)

interface MastodonProfile {
  id: string;
  username: string;
  acct: string;          // ex: joao@fosstodon.org
  url: string;
  fields: Array<{
    name: string;
    value: string;       // contém HTML com rel="me"
    verified_at: string | null;
  }>;
}

// Verifica o vínculo bidirecional
async function verifyMastodonLink(
  githubUsername: string,
  mastodonHandle: string  // ex: joao@fosstodon.org
): Promise<boolean> {
  const [username, instance] = mastodonHandle.split('@');
  const profile = await fetch(
    `https://${instance}/api/v1/accounts/lookup?acct=${username}`
  ).then(r => r.json() as Promise<MastodonProfile>);

  return profile.fields.some(f =>
    f.value.includes(`codaqui.dev/membros/${githubUsername}`) &&
    f.verified_at !== null  // Mastodon confirma que verificou o link
  );
}
```

### O que NÃO precisamos hospedar

| Componente ActivityPub | Necessidade | Nossa abordagem |
|----------------------|-------------|-----------------|
| Servidor ActivityPub | ❌ Não | Usamos instância Mastodon existente do usuário |
| Banco de dados de posts | ❌ Não | Posts vivem no Mastodon do usuário |
| Firehose de mensagens | ❌ Não | Lemos via API pública quando necessário |
| Chaves HTTP Signatures | ❌ Não | O Mastodon do usuário assina por ele |

---

## 4. Rede Social Local (RSL): a camada presencial

### O conceito central

Inspirado diretamente na proposta do Ramalho: **uma conta na rede da Codaqui só é
"ativada" depois de um encontro presencial verificado**.

```
Conta GitHub  ──────────►  Conta Codaqui Network
                               │
                               │  requer:
                               │  • 1 encontro presencial verificado
                               │    (via QR Code em evento Codaqui)
                               │  • OU convite de membro já verificado
                               ▼
                          Membro Ativo da RSL Codaqui
```

### Níveis de confiança

| Nível | Como obtém | Como mantém (renovação) | O que pode fazer |
|-------|-----------|------------------------|-----------------|
| **Visitante** | Qualquer login GitHub | Permanente (não decai) | Ver eventos, seguir trilhas, ver perfis públicos |
| **Participante** | 1 check-in presencial verificado | 1 check-in a cada 6 meses | Postar no feed da comunidade, comentar, solicitar exceção |
| **Membro** | 3+ check-ins OU convite de Membro | 2 check-ins a cada 6 meses | Convidar outros, moderar conteúdo, votar, aprovar exceções |
| **Organizador** | Aprovação pela diretoria | Aprovação anual | Criar eventos oficiais, emitir badges, gerenciar exceções |

> **Decaimento**: Participante sem check-in por 6 meses retorna para Visitante.
> Membro sem check-in por 6 meses retorna para Participante. O nível anterior
> é recuperado com um novo check-in. Exceções por doença/viagem podem ser
> solicitadas e aprovadas por um Organizador (ver §8.2).

---

## 5. Mecanismos de proximidade

### 5.1 QR Code em eventos

O fluxo mais simples e imediato, sem hardware especial:

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE CHECK-IN POR QR CODE                              │
│                                                             │
│  Organizador gera QR Code temporário para o evento          │
│  (válido por ex: 4 horas, vinculado ao event_id)            │
│                                                             │
│  ┌──────────┐     escaneia QR      ┌─────────────────────┐  │
│  │ Visitante│ ──────────────────►  │ /check-in/<token>   │  │
│  │ (logado) │                      │ (página da Codaqui) │  │
│  └──────────┘                      └────────┬────────────┘  │
│                                             │               │
│                                    valida token + GPS       │
│                                    (optional: geofence)     │
│                                             │               │
│                                    registra ProximityEvent  │
│                                    no banco                 │
│                                             │               │
│                                    atualiza nível de        │
│                                    confiança do usuário     │
└─────────────────────────────────────────────────────────────┘
```

**QR Code dinâmico:** gerado pelo organizador via painel admin, com:
- `event_id` + `timestamp` + HMAC assinado com chave do evento
- Tempo de validade configurável (default: duração do evento)
- Limite de usos opcionalmente configurável

**QR Code de pessoa para pessoa** (conexão P2P):

```
Alice abre seu perfil → clica em "Mostrar meu QR de conexão"
→ QR contém: { userId: alice_id, nonce: uuid, expiresAt: +5min }

Bob escaneia o QR de Alice
→ Backend verifica: nonce válido? userId existe? não expirou?
→ Cria ProximityConnection(alice, bob, eventId, method: 'qrcode')
```

### 5.2 Bluetooth Low Energy (BLE) — detecção de proximidade passiva

Para provar presença sem ação ativa (scan manual), Bluetooth é o caminho:

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO BLE (Web Bluetooth API / App Nativo)                 │
│                                                             │
│  App da Codaqui (PWA ou nativo) ativa advertising BLE       │
│  com um beacon temporário: { userId_hash, event_id }        │
│                                                             │
│  Outros dispositivos próximos detectam o beacon             │
│  → se ambos os usuários estiverem no mesmo evento           │
│    E ambos tiverem o app aberto / BLE ativo                 │
│  → troca de "handshake" BLE mútuo                           │
│  → prova de proximidade enviada ao servidor                 │
│                                                             │
│  Raio efetivo BLE: ~10 metros (vs GPS: ~10 metros outdoor)  │
│  Vantagem: funciona indoor, sem GPS                         │
└─────────────────────────────────────────────────────────────┘
```

**Privacidade BLE:** o beacon nunca transmite o `userId` diretamente — transmite um
`userId_hash` rotativo (renovado a cada 15 minutos, estilo Apple Exposure Notification
do COVID), evitando rastreamento passivo.

```typescript
// Pseudo-código: geração do beacon rotativo
function generateBeaconPayload(userId: string, eventId: string): string {
  const window = Math.floor(Date.now() / (15 * 60 * 1000)); // janela de 15 min
  const hmac = crypto.createHmac('sha256', SECRET_KEY)
    .update(`${userId}:${eventId}:${window}`)
    .digest('hex')
    .slice(0, 16); // 8 bytes suficientes para BLE advertisement
  return hmac;
}
```

### 5.3 NFC (Near Field Communication)

Para o cenário mais íntimo (dois dispositivos se tocando):

```
Alice toca o telefone de Bob
→ NFC transfere: { userId: alice_id, eventId, signature }
→ Assinatura verifica que o dado foi gerado por alice neste evento
→ Bob confirma: "Conectar com Alice?" → tap de confirmação
→ ProximityConnection registrada
```

**NFC no contexto de crachá:** o organizador pode distribuir crachás NFC passivos
(stickers de R$2) com o `userId` gravado. Qualquer participante com telefone NFC
escaneia o crachá e confirma a conexão.

### 5.4 Comparativo dos mecanismos

| Mecanismo | Custo hardware | Funciona offline | Raio | UX | Prova de proximidade |
|-----------|--------------|------------------|------|----|--------------------|
| QR Code (evento) | Zero | ✅ Sim | Sala inteira | ⭐⭐⭐ Simples | Fraco (pode compartilhar foto do QR) |
| QR Code (P2P) | Zero | ✅ Sim | ~2 metros | ⭐⭐ Médio | Médio (requer dois atores presentes) |
| BLE passivo | Zero (usa cel.) | ✅ Sim | ~10m | ⭐⭐⭐⭐ Automático | Forte (mútuo e temporal) |
| NFC crachá | R$2/crachá | ✅ Sim | ~5cm | ⭐⭐⭐ Simples | Forte (física, quase impossível forjar) |
| GPS geofence | Zero | ❌ Precisa rede | ~50m | ⭐⭐⭐ Invisível | Fraco (pode ser falsificado via mock GPS) |

**Recomendação de rollout:**
1. **Fase 1** — QR Code de evento (zero infra, funciona hoje)
2. **Fase 2** — QR Code P2P (profile → QR pessoal)
3. **Fase 3** — BLE passivo (PWA com Web Bluetooth / app React Native)
4. **Fase 4** — NFC crachá (eventos maiores: DevParaná Conf)

---

## 5.5 Viabilidade técnica: o que um PWA consegue fazer hoje?

A pergunta central: **podemos implementar proximidade sem um app nativo?**

A resposta curta: **QR Code sim, BLE/NFC dependem do sistema operacional**.

### QR Code via câmera — funciona em PWA nos dois sistemas

| API | Android (Chrome) | iOS (Safari/Chrome) | Solução |
|-----|:----------------:|:-------------------:|---------|
| `BarcodeDetector` (nativo) | ✅ Chrome 83+ | ❌ Não suportado | Fallback JS |
| `getUserMedia` (câmera) | ✅ | ✅ Safari 11+ | Base universal |
| Leitura QR via JS (`jsQR` / `html5-qrcode`) | ✅ | ✅ | **Funciona em ambos** |

**Conclusão**: QR Code funciona em PWA **hoje, em todos os dispositivos modernos**,
usando `getUserMedia` + biblioteca JS de decodificação. A `BarcodeDetector` nativa
é usada quando disponível (Android Chrome) e o fallback `jsQR` cobre o iOS.

```tsx
// src/components/QrScanner/index.tsx — estratégia de detecção progressiva
async function scanQR(videoElement: HTMLVideoElement): Promise<string> {
  if ('BarcodeDetector' in window) {
    // Android Chrome / Edge: API nativa, mais rápida
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    const [barcode] = await detector.detect(videoElement);
    return barcode?.rawValue ?? '';
  }
  // iOS / Firefox / outros: fallback para jsQR
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoElement, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  return code?.data ?? '';
}
```

### Bluetooth Low Energy (BLE) — bloqueado no iOS

| Plataforma | Web Bluetooth API | Status Apple |
|-----------|:-----------------:|-------------|
| Android Chrome 56+ | ✅ Suportado | — |
| Android Edge / Opera | ✅ Suportado | — |
| Android Firefox | ❌ Não | Deliberado |
| iOS (qualquer browser) | ❌ Bloqueado | Apple: "Not Considering" |
| Desktop Chrome/Edge (Win/Mac) | ✅ Suportado | — |
| Desktop Firefox / Safari | ❌ Não | Deliberado |

**Implicação crítica**: em eventos com público misto iOS/Android, o BLE **não pode
ser o único mecanismo de check-in** via PWA. O QR Code deve ser sempre o fallback.

> A Web Bluetooth API exige: contexto HTTPS + gesto do usuário (não pode ser
> silenciosa/automática) + permissão explícita de localização no Android.

### Web NFC — Android Chrome only

| Plataforma | Web NFC API |
|-----------|:-----------:|
| Android Chrome 89+ | ✅ Suportado |
| Android Samsung Internet | ✅ Suportado |
| iOS (qualquer browser) | ❌ Bloqueado |
| Desktop (todos) | ❌ Não |

**Implicação**: NFC via PWA funciona apenas para usuários Android que abrem o site
no Chrome. Para crachás de evento, isso ainda é útil (a maioria dos dispositivos
corporativos/Android que rodam em estandes tem Chrome).

### Mapa de decisão: PWA vs App Nativo

```
Funcionalidade          PWA hoje    PWA futuro    App Nativo (Expo)
────────────────────────────────────────────────────────────────────
QR Code scan            ✅ Ambos    ✅            ✅
Gerar QR Code           ✅ Ambos    ✅            ✅
BLE advertising         ❌ iOS       ⚠️ Incerto   ✅ Ambos
BLE scanning            ❌ iOS       ⚠️ Incerto   ✅ Ambos
NFC leitura             ❌ iOS       ❌           ✅ Ambos
Push notifications      ✅ Android  ✅ iOS 16.4+  ✅ Ambos
Instalação na tela home ✅ Ambos    ✅            ✅
Funciona offline        ✅ (SW)     ✅            ✅
```

### Estratégia recomendada

```
┌─────────────────────────────────────────────────────────────────┐
│  ESTRATÉGIA PWA-FIRST COM ESCAPE HATCH NATIVO                   │
│                                                                 │
│  1. PWA (Docusaurus + React)                                    │
│     └── QR Code scan/generate: ✅ funciona em tudo             │
│     └── Check-in de evento: ✅ via URL + HMAC token             │
│     └── Conexão P2P: ✅ via QR pessoal com TTL                  │
│                                                                 │
│  2. Android Chrome (BLE/NFC bonus)                              │
│     └── Web Bluetooth: detecta beacons se disponível           │
│     └── Web NFC: lê crachás se disponível                       │
│     └── Fallback automático para QR se API ausente              │
│                                                                 │
│  3. App Expo (React Native) — fase futura opcional             │
│     └── BLE completo: iOS + Android                             │
│     └── NFC completo: iOS + Android                             │
│     └── Compartilha 90% do código com o frontend web           │
│     └── Deploy via Expo EAS (sem App Store manual)              │
└─────────────────────────────────────────────────────────────────┘
```

**Conclusão prática:**
- Para o **Fase 1 e 2** (QR Code), o Docusaurus PWA é suficiente — zero dependência
  de app nativo.
- Para o **Fase 3** (BLE), ou aceitamos Android-only no PWA, ou desenvolvemos um
  app Expo que reusa os componentes React do site.
- O Expo é uma boa opção futura porque o frontend já é React — a curva de migração
  de componentes seria baixa.

---

### Diagrama de camadas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Docusaurus)                        │
│                                                                     │
│  /membros/<username>   /rede   /check-in/<token>   /eventos/*       │
│        │                 │            │                │            │
│  ProfileCard       FeedLocal     CheckInFlow      EventCard         │
│  MastodonBadge     (timeline     (QR scan /        (com check-in    │
│  ProofBadges        RSL posts)   BLE detect)        disponível)     │
└────────────────────────┬────────────────────────────────────────────┘
                         │ REST / WebSocket
┌────────────────────────▼────────────────────────────────────────────┐
│                        BACKEND (NestJS)                             │
│                                                                     │
│  AuthModule        MastodonModule      ProximityModule              │
│  (GitHub OAuth     (verify link,       (check-in tokens,            │
│   + JWT)            aggregate posts)    BLE handshakes,             │
│                                         trust levels)               │
│                                                                     │
│  MembersModule     LedgerModule        EventsModule                 │
│  (roles, profiles) (financeiro)        (eventos presenciais)        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                        BANCO DE DADOS (PostgreSQL)                  │
│                                                                     │
│  members             mastodon_links      proximity_events           │
│  ─────────           ─────────────       ─────────────────          │
│  id (GitHub ID)      member_id           id                         │
│  username            mastodon_handle     member_a_id                │
│  trust_level         instance            member_b_id                │
│  check_in_count      verified_at         event_id                   │
│  last_checkin_at     last_sync           method (qr/ble/nfc)        │
│  decay_warned_at                         occurred_at                │
│  decayed_at                              is_mutual                  │
│                                                                     │
│  decay_exceptions    checkin_tokens      local_posts                │
│  ────────────────    ─────────────────   ────────────               │
│  id                  token (HMAC)        id                         │
│  member_id           event_id            author_id                  │
│  reason (enum)       created_by          content                    │
│  notes (opcional)    expires_at          created_at                 │
│  status (enum)       max_uses            visibility (local/fed)     │
│  approved_until      use_count                                      │
│  reviewed_by                                                        │
│  approved_until                                                     │
└─────────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│             FEDIVERSE (Mastodon — instâncias externas)              │
│                                                                     │
│  fosstodon.org   bolha.us   mastodon.social   cualquier instancia   │
│                                                                     │
│  API pública: GET /api/v1/accounts/lookup                           │
│               GET /api/v1/accounts/:id/statuses                     │
│  OAuth (opcional): publicar em nome do usuário com consentimento    │
└─────────────────────────────────────────────────────────────────────┘
```

### Novos módulos do backend

```
backend/src/
├── mastodon/
│   ├── mastodon.module.ts
│   ├── mastodon.service.ts        # verifyLink(), fetchRecentPosts(), notifyMember()
│   ├── mastodon.controller.ts     # POST /mastodon/link, GET /mastodon/verify/:handle
│   └── entities/
│       └── mastodon-link.entity.ts
├── proximity/
│   ├── proximity.module.ts
│   ├── proximity.service.ts       # generateToken(), redeemToken(), recordBLEHandshake()
│   ├── proximity.controller.ts    # POST /proximity/checkin, POST /proximity/ble-handshake
│   └── entities/
│       ├── checkin-token.entity.ts
│       └── proximity-event.entity.ts
└── local-feed/
    ├── local-feed.module.ts
    ├── local-feed.service.ts      # getPosts(), createPost(), aggregateMastodon()
    └── entities/
        └── local-post.entity.ts
```

---

## 7. Fluxos de usuário

### Fluxo A: Primeira vez em um evento

```
1. João acessa codaqui.dev e faz login com GitHub
   → Conta criada com trust_level: 'visitor'

2. No evento DevParaná Conf, o organizador exibe o QR Code do evento
   na entrada da sala e no telão

3. João abre /check-in no celular, escaneia o QR
   → Sistema valida: token ativo, evento válido, João não fez check-in ainda
   → ProximityEvent registrado: { member: joão, event: devpr-conf-2026, method: 'qr_event' }
   → trust_level atualizado: 'visitor' → 'participant'
   → Notificação (opcional via Mastodon DM): "Bem-vindo ao DevParaná Conf 2026! 🎉"

4. João agora pode postar no feed local da comunidade
```

### Fluxo B: Conexão P2P entre participantes

```
1. João quer se conectar com Maria no evento

2. Maria abre seu perfil → "Mostrar QR de conexão"
   → QR gerado com: { userId: maria_id, nonce: uuid4, expiresAt: +5min }

3. João escaneia o QR de Maria
   → Backend verifica: nonce válido, não expirado, ambos com trust_level ≥ 'participant'
   → ProximityEvent: { member_a: joão, member_b: maria, method: 'qr_p2p', is_mutual: true }
   → Ambos recebem notificação de conexão estabelecida

4. No perfil de João e Maria aparece: "Conectados em DevParaná Conf 2026"
```

### Fluxo C: Vinculação com Mastodon

```
1. Maria acessa /perfil/configuracoes → "Vincular Mastodon"
   → Informa: @maria@fosstodon.org

2. Sistema instrui: "Adicione este link ao seu perfil Mastodon:"
   <a rel="me" href="https://codaqui.dev/membros/maria">Codaqui</a>

3. Maria edita seu perfil no fosstodon.org e adiciona o campo

4. Maria volta e clica "Verificar vínculo"
   → Backend: GET fosstodon.org/api/v1/accounts/lookup?acct=maria
   → Verifica campo com rel="me" para codaqui.dev/membros/maria
   → verified_at = now()
   → Badge "Mastodon verificado" aparece no perfil da Codaqui de Maria
```

### Fluxo D: Feed local de evento

```
Durante o DevParaná Conf 2026:

1. Participantes verificados podem postar no /rede/eventos/devpr-conf-2026/feed

2. Posts com visibility: 'local' ficam apenas no feed da Codaqui
   Posts com visibility: 'federated' são também publicados no Mastodon
   do autor (via OAuth, com consentimento explícito)

3. O feed agrega:
   - Posts criados diretamente no site (visibility: local)
   - Posts do Mastodon dos participantes com hashtag #DevParanáConf2026
   - (futuro) Replies e boosts do Mastodon em threads do evento
```

### Fluxo E: Jornada completa de um participante real — DevParaná Conf 2026

> Esta é a jornada de **Lucas**, dev backend, primeira vez num evento Codaqui.
> Acompanha desde a inscrição até 6 meses depois do evento.

---

#### 📅 Duas semanas antes do evento

```
Lucas vê o post sobre o DevParaná Conf 2026 no Mastodon (bolha.us).
O post foi publicado pela conta da Codaqui e boosted por @devparana@fosstodon.org.

Ele acessa codaqui.dev/eventos → vê a página do evento.

Clica em "Quero ir" → sistema pede login com GitHub.
Lucas faz login pela primeira vez.

→ Conta criada: { trust_level: 'visitor', check_in_count: 0 }

Na sua tela aparece:
  ✅ Conta criada
  💡 "Você ainda não participou de nenhum evento. Vá a um evento e faça o
      check-in para desbloquear o feed da comunidade."

Lucas vê a seção "Vincular Mastodon" e decide linkar sua conta @lucas@bolha.us.
→ Segue as instruções: adiciona rel="me" no perfil dele.
→ Verificação passa. Badge "🦣 Mastodon verificado" aparece no seu perfil.
```

#### 🚪 Dia do evento — chegada (09h00)

```
Lucas chega no auditório. Na entrada há um banner com QR Code grande.
Também aparece no telão nos primeiros 30 minutos de credenciamento.

Lucas abre codaqui.dev no celular (Chrome, Android).
→ O site é um PWA: ele adiciona à tela inicial enquanto espera na fila.

Clica em "Check-in" → câmera abre → escaneia o QR do evento.
→ BarcodeDetector nativo do Android: scan em <1 segundo.

Tela de confirmação: "Você está no DevParaná Conf 2026! 🎉"
→ ProximityEvent registrado: { lucas, devpr-conf-2026, method: 'qr_event' }
→ trust_level: 'visitor' → 'participant'
→ Notificação push (se permissão ativa): "Bem-vindo! Seu nível foi atualizado."
→ Se Mastodon vinculado: DM automática enviada pelo sistema.

Lucas agora pode ver e postar no /rede/eventos/devpr-conf-2026.
```

#### 🤝 Durante o evento — coffee break (10h30)

```
Lucas bate papo com Ana, que faz parte da equipe Codaqui (Membro).

Ana quer se conectar com Lucas formalmente na rede.
→ Ana abre seu perfil → "Mostrar meu QR de conexão"
→ QR gerado: { userId: ana_id, nonce: abc123, expiresAt: +5min }

Lucas escaneia o QR de Ana com a câmera do PWA.
→ Backend valida: nonce OK, não expirado, ambos ≥ 'participant'
→ ProximityEvent: { ana, lucas, devpr-conf-2026, method: 'qr_p2p', mutual: true }
→ Ambos recebem: "✅ Conexão estabelecida com @lucas / @ana no DevParaná Conf 2026"

No perfil de Lucas agora aparece a seção "Conexões verificadas":
  🤝 Ana — DevParaná Conf 2026
```

#### 📢 Durante a palestra — post no feed local (11h15)

```
Lucas assiste à palestra de Kubernetes e quer compartilhar um insight.

Abre /rede → "Nova postagem" → escreve:
  "Alguém mais ficou de queixo caído com o talk de K8s? Aquela parte de
   sidecar containers mudou minha visão de observabilidade."

Escolhe visibilidade: [🏠 Só aqui] ou [🌐 Também no Mastodon]
Lucas escolha "Também no Mastodon" → sistema pede autorização OAuth uma vez.
→ Post publicado no feed local da Codaqui E no @lucas@bolha.us com #DevParanáConf2026

Ana, que segue Lucas no Mastodon, vê o boost e responde lá.
A resposta aparece também no feed da Codaqui (agregação por hashtag).
```

#### 🌅 Final do evento (18h00)

```
Lucas vê seu perfil atualizado:
  ✅ trust_level: participant
  ✅ check_in_count: 1
  ✅ Conexões presenciais: 1 (Ana)
  ✅ Posts no feed: 2
  🦣 Mastodon verificado: @lucas@bolha.us
  📅 Próxima revalidação: até 2026-11-25 (6 meses)

Ele recebe um e-mail/DM:
  "Obrigado por participar do DevParaná Conf 2026! 🎉
   Seu nível na rede Codaqui foi atualizado para Participante.
   Continue participando dos próximos eventos para manter seu nível."
```

#### ⚠️ 5 meses depois (outubro/2026) — aviso de decaimento

```
O cron job roda diariamente. Detecta:
  last_checkin_at = 2026-05-25 (dia do evento)
  hoje = 2026-10-25 (5 meses exatos)
  decay_warned_at = null → dispara aviso

Lucas recebe e-mail + DM no Mastodon:
  "Hey Lucas! Faz 5 meses desde seu último check-in no DevParaná Conf.
   Se você não comparecer a um evento Codaqui até 2026-11-25, seu nível
   Participante voltará para Visitante.
   
   Próximos eventos: [link para /eventos]
   Teve algum imprevisto? [Solicitar exceção]"
```

#### ✅ Lucas vai ao próximo evento (novembro/2026)

```
Lucas vai ao Workshop de Python da Codaqui.
Faz o check-in via QR.

→ last_checkin_at = 2026-11-10
→ decay_warned_at = null (reset)
→ trust_level continua: 'participant'
→ check_in_count: 2

Agora Lucas está a 1 check-in de se tornar Membro (precisa de 3+).
```

#### ❌ Cenário alternativo: Lucas não consegue ir (doença)

```
Em outubro, Lucas está com dengue. Não vai conseguir ir a eventos por 2 meses.

Acessa /perfil/excecao:
  Motivo: [Saúde] ← enum, não precisa detalhar
  Retorno estimado: dezembro de 2026
  Notas: (campo opcional, Lucas deixa em branco)

→ Solicitação enviada para Ana (Membro) ou qualquer Organizador

Ana aprova em /admin/excecoes:
  decay_exception.approved_until = 2027-02-01 (margem generosa)

Lucas recebe: "Exceção aprovada até fevereiro. Cuide-se! 🙏"

O cron job ignora Lucas durante esse período.
Quando Lucas se recuperar e fizer um novo check-in,
a exceção é encerrada automaticamente.
```

---

## 8. Governança, moderação e decaimento temporal

### Por que a governança é mais simples em redes locais

O ponto central da RSL (Ramalho) se aplica diretamente à Codaqui:

> Uma instância local tem moderação humana natural — as pessoas se conhecem
> presencialmente. Comportamento tóxico tem custo social real.

### 8.1 Decaimento temporal de nível (Trust Decay)

A novidade central desta RSL: **níveis de confiança têm prazo de validade**. Uma
conta inativa presencialmente *decai* automaticamente com o tempo.

O objetivo não é punir, mas incentivar a participação real e manter a rede viva.

#### Ciclo de revalidação

| Nível | Requisito de manutenção | Janela | Consequência se não renovar |
|-------|------------------------|--------|-----------------------------|
| **Participante** | 1 check-in em evento | A cada 6 meses | Decai para Visitante |
| **Membro** | 2 check-ins em eventos | A cada 6 meses | Decai para Participante |
| **Organizador** | Aprovação anual pela diretoria | 1 ano | Decai para Membro |

> **Exemplo prático:** Maria fez seu primeiro check-in em maio de 2026 e virou
> Participante. Se até novembro de 2026 ela não comparecer a nenhum outro evento,
> sua conta retorna automaticamente para Visitante. Para recuperar, basta fazer um
> novo check-in em qualquer evento.

#### Janela de decaimento

```
t=0            t=+5 meses        t=+6 meses       t=+6m+7 dias
│              │                 │                │
▼              ▼                 ▼                ▼
Check-in   Aviso por e-mail   Período de      Decaimento
realizado  ("Você está a 1    graça (7 dias)  efetivado
            mês de perder                    (trust_level -1)
            seu nível!")
```

#### Implementação técnica

```typescript
// backend/src/proximity/trust-decay.service.ts
@Cron('0 0 * * *')  // roda todo dia à meia-noite
async processTrustDecay(): Promise<void> {
  const sixMonthsAgo = subMonths(new Date(), 6);
  const warningDate  = subMonths(new Date(), 5); // aviso com 1 mês de antecedência

  // 1. Envia aviso aos que estão chegando no limite
  const toWarn = await this.membersRepo.find({
    where: {
      trust_level: In(['participant', 'member']),
      last_checkin_at: LessThan(warningDate),
      decay_warned_at: IsNull(),
    },
  });
  for (const m of toWarn) {
    await this.notifyDecayWarning(m);
    await this.membersRepo.update(m.id, { decay_warned_at: new Date() });
  }

  // 2. Aplica decaimento efetivo (após 6 meses + 7 dias de graça)
  const decayThreshold = subDays(sixMonthsAgo, 7);
  const toDecay = await this.membersRepo.find({
    where: {
      trust_level: In(['participant', 'member']),
      last_checkin_at: LessThan(decayThreshold),
      decay_exception: IsNull(),  // sem exceção aprovada
    },
  });
  for (const m of toDecay) {
    const newLevel = m.trust_level === 'member' ? 'participant' : 'visitor';
    await this.membersRepo.update(m.id, {
      trust_level: newLevel,
      decayed_at: new Date(),
      decay_warned_at: null,  // reset para o próximo ciclo
    });
    await this.notifyDecayApplied(m, newLevel);
  }
}
```

### 8.2 Fluxo de exceção (doença, viagem, licença)

Nenhum sistema humano funciona sem compaixão. Um membro que está doente, em
licença-maternidade/paternidade, em viagem de longa duração ou enfrentando uma
emergência pessoal **não deve perder seu nível** por ausência inevitável.

#### Como funciona

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE EXCEÇÃO DE DECAIMENTO                             │
│                                                             │
│  1. Membro abre /perfil/excecao                             │
│     → seleciona motivo: saúde | viagem | familiar | outro   │
│     → informa data estimada de retorno                      │
│     → campo de texto livre (opcional, não obrigatório)      │
│                                                             │
│  2. Solicitação vai para fila de admin em /admin/excecoes   │
│     → status: pendente                                      │
│                                                             │
│  3. Qualquer Organizador pode aprovar ou rejeitar           │
│     → aprovação: decay_exception = { approved_until, by }  │
│     → rejeição: membro notificado com motivo opcional       │
│                                                             │
│  4. Durante o período de exceção:                           │
│     → campo decay_exception protege contra o cron job       │
│     → aviso de "X dias restantes na exceção" no perfil      │
│                                                             │
│  5. Ao retornar, membro faz 1 check-in e a exceção se       │
│     encerra automaticamente (ou expira em approved_until)   │
└─────────────────────────────────────────────────────────────┘
```

#### Entidade de exceção

```typescript
// backend/src/proximity/entities/decay-exception.entity.ts
@Entity('decay_exceptions')
export class DecayException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  member_id: string;

  @Column({ type: 'enum', enum: ['health', 'travel', 'family', 'other'] })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;  // campo livre, opcional — privacidade do membro

  @Column({ type: 'timestamp' })
  requested_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  return_estimated_at: Date;

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: string;

  @Column({ nullable: true })
  reviewed_by: string;  // member_id do organizador que aprovou

  @Column({ type: 'timestamp', nullable: true })
  approved_until: Date;  // o decaimento fica pausado até esta data

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date;
}
```

#### Políticas sugeridas de aprovação

| Motivo | Duração máxima de exceção sugerida | Aprovação automática? |
|--------|-----------------------------------|-----------------------|
| Saúde / internação | Até 12 meses | ❌ Manual (com compaixão) |
| Licença-maternidade/paternidade | Até 12 meses | ✅ Pode ser automática |
| Viagem longa / intercâmbio | Até 6 meses | ✅ Pode ser automática |
| Outro | Até 6 meses | ❌ Manual |

> **Princípio:** o campo `notes` é livre e não obrigatório. O membro nunca é obrigado
> a detalhar uma doença ou situação pessoal. O motivo categorizado (enum) é suficiente
> para a decisão do organizador.

### 8.3 Regras de moderação de conteúdo

| Regra | Critério | Consequência |
|-------|---------|-------------|
| **Posting rate limit** | 10 posts/hora por participante | Throttle automático |
| **Trust requirement** | Posts no feed exigem trust_level ≥ participant | Rejeição silenciosa |
| **Revogação de trust** | 3 denúncias de membros → revisão manual | Downgrade para visitor |
| **Remoção de vínculo Mastodon** | Trust revogado → badge removido | Usuário notificado |
| **QR de evento expira** | Tokens com TTL configurável | Impossível fazer check-in retroativo |

### 8.4 Papéis de moderação

```
Visitante ──► Participante ──► Membro ──► Organizador
                    │               │
                    │               └──► pode moderar posts
                    │               └──► pode aprovar exceções
                    │
                    └──► pode reportar posts
                    └──► pode solicitar exceção de decaimento
```

---

## 9. Privacidade por design

### Princípios

1. **Minimalismo de dados**: nunca guardar localização GPS permanente — apenas
   "esteve no evento X" (booleano)

2. **BLE sem identidade direta**: beacons BLE usam hash rotativo, nunca o user ID

3. **Mastodon opt-in**: vínculo Mastodon é voluntário e revogável a qualquer momento

4. **Dados de proximidade com TTL**: `proximity_events` com mais de 2 anos são
   anonimizados (member_id → hash irreversível)

5. **Consentimento explícito para federação**: post no Mastodon em nome do usuário
   só acontece após OAuth explícito com scope `write:statuses`

### O que nunca coletamos

- ❌ Histórico de posição GPS contínuo
- ❌ Contatos da agenda do celular
- ❌ Conteúdo de mensagens privadas no Mastodon
- ❌ Dados biométricos

---

## 10. Riscos e limitações

| Risco | Probabilidade | Mitigação |
|-------|-------------|-----------|
| QR Code compartilhado (foto do QR de evento) | Média | `max_uses` configurável + geofence opcional |
| Mastodon handle mudando de instância | Baixa | Re-verificação periódica (semanal) |
| Web Bluetooth API não disponível em iOS Safari | Alta | Fallback para QR P2P; BLE apenas Android/desktop |
| Instância Mastodon do usuário fora do ar | Média | Cache de 24h para perfis verificados |
| Abuso de check-in (alguém escaneia QR sem estar no evento) | Baixa (requer QR real) | Confirmação de segundo fator (geo ou segundo QR de saída) |
| Escala — RSL perde o senso de "local" se crescer demais | Filosófico | Limite soft de membros por instância/comunidade |

---

## 11. Conexão com o ecossistema existente

### Como isso se encaixa no que já existe na Codaqui

| Sistema existente | Integração com a RSL |
|------------------|---------------------|
| **GitHub OAuth + JWT** | Base de identidade — sem mudança, apenas enriquecida |
| **Eventos (`static/events/`)** | `event_id` da RSL referencia eventos existentes |
| **Multisite por comunidade** | Cada comunidade parceira pode ter sua própria instância RSL |
| **Stripe + transparência financeira** | Doadores verificados presencialmente ganham badge especial |
| **Trilhas de aprendizado** | Conclusão de trilha + presença verificada = certificado assinado digitalmente |
| **Clube Codaqui** | Membros do Clube com check-in verificado podem ter benefícios extras |

---

## 12. Inspirações e referências

| Fonte | O que tomamos emprestado |
|-------|--------------------------|
| [Luciano Ramalho — Rede Social Local](https://ramalho.org/posts/rede-social-local/) | Validação presencial como critério de entrada e permanência |
| [ActivityPub W3C](https://www.w3.org/TR/activitypub/) | Protocolo de federação (via Mastodon, sem hospedar) |
| [ActivityPub + WebFinger](https://swicg.github.io/activitypub-webfinger/) | Descoberta de identidade federada |
| [Apple Exposure Notification](https://covid19.apple.com/contacttracing) | Beacons BLE rotativos sem expor identidade |
| [Mastodon rel="me" verification](https://docs.joinmastodon.org/user/profile/#verified-links) | Verificação de identidade cruzada sem servidor próprio |
| [The Federation / Fediverse](https://the-federation.info/) | Mapa do ecossistema federado — escolha de instâncias para membros |

---

## 13. Próximos passos (se quisermos ir além da teoria)

### Sprint 0 — Experimento mínimo (1 dia de trabalho)

- [ ] Adicionar campo `mastodon_handle` em `members` (migration TypeORM)
- [ ] Endpoint `POST /mastodon/link` + `GET /mastodon/verify`
- [ ] Exibir handle verificado no perfil existente em `/membros`

### Sprint 1 — QR Code de evento (1 semana)

- [ ] Módulo `proximity` no backend
- [ ] Entidade `checkin_token` (HMAC, TTL, max_uses)
- [ ] Página `/check-in/[token]` no frontend
- [ ] Painel admin: botão "Gerar QR do evento" em `/admin`
- [ ] Trust level exibido no perfil

### Sprint 2 — QR P2P (1 semana)

- [ ] Geração de QR pessoal no perfil do usuário
- [ ] Página de escaneamento e confirmação
- [ ] Listagem de "Conexões presenciais" no perfil

### Sprint 3 — Feed local (2 semanas)

- [ ] Entidade `local_post`
- [ ] Feed em `/rede` ou dentro de cada evento
- [ ] Integração opcional com Mastodon (leitura de posts com hashtag)

### Sprint 4 — BLE (depende de app nativo ou PWA)

- [ ] Avaliar Web Bluetooth API vs React Native (Expo)
- [ ] Implementar beacon rotativo
- [ ] Handshake mútuo e registro no backend

---

> **Lembrete filosófico final:**
>
> *"Prefiro qualidade e não quantidade nas minhas conexões humanas."* — Ramalho
>
> A RSL da Codaqui não precisa ter 1 milhão de usuários para ter valor. Se um evento
> com 200 pessoas gera 200 conexões verificadas, com trilhas concluídas, badges reais
> e uma rede de apoio mútuo — isso já é infinitamente mais valioso do que 10 mil
> seguidores fantasmas em qualquer plataforma centralizada.
