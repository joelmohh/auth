# TODO — Caminho para um MVP seguro e legalmente conforme

> Este documento substitui a seção de roadmap geral por um checklist focado: o mínimo necessário para
> colocar o fluxo de autenticação atual em produção com segurança aceitável e conformidade com a LGPD.
> O roadmap multi-app/OAuth completo (organizações, consoles, SDKs etc.) fica para depois — ver
> "Fora do escopo do MVP" no final.

## Já resolvido (não repetir)

- [x] `cookie-parser` instalado e configurado.
- [x] Rota `/` duplicada/morta removida.
- [x] `Session.expiresAt` criado no schema; TTL do `createdAt` alinhado com o `maxAge` do cookie (7 dias).
- [x] `username` com índice `unique`.
- [x] Imports mortos (`node:os`) removidos.
- [x] JWT carrega `sessionId`; `verifyToken` valida a sessão específica (`_id`, `userId`, `revoked`, `expiresAt`).
- [x] `verifyRefreshToken` passa a checar `revoked`.
- [x] `requireAuth` unificado como alias de `verifyToken` (sem duplicação divergente).
- [x] Refresh token armazenado como hash (`sha256`), nunca em texto puro no banco.

## 🔴 Segurança — bloqueadores para o MVP

Sem isso, não é seguro liberar para usuários reais, mesmo em uma versão inicial.

- [x] **Rate limiting** em `/login`, `/signup`, `/verify-otp`, `/resend-otp` e (quando existir) `/reset-password`.
      Sugestão: `express-rate-limit`, por IP + por conta (ex.: 5 tentativas / 15 min).
- [ ] **Limite de tentativas de OTP** por código (contador no próprio documento `Otp` ou bloqueio após N tentativas
      erradas), independente do rate limit de rede.
- [ ] **Enviar OTP de verdade por e-mail** — descomentar `sendEmail(...)` em `createOtpAndSend` e remover o
      `console.log` do código (hoje o código de verificação vaza no log do servidor e o usuário real nunca recebe).
- [ ] **Trocar `Math.random()` por `crypto.randomInt(100000, 999999)`** na geração do OTP (gerador não
      criptográfico é previsível).
- [ ] **TTL automático no model `Otp`** (índice `expires` sobre `expiresAt`, ou similar) para o documento sumir
      sozinho quando expira, em vez de depender de o app lembrar de deletar.
- [ ] **Endpoint de logout** que seta `revoked: true` na sessão (hoje a checagem de revogação existe, mas nada
      no código realmente revoga uma sessão).
- [ ] **Fluxo de reset de senha funcional**: token de uso único, com expiração curta, invalidado após uso —
      hoje só existe a tela (`resetPassword.ejs`), sem rota de API por trás.
- [ ] **Validação de entrada real** com `express-validator`: hoje o middleware `validate` (e a checagem manual
      adicionada em `/login`) não fazem nada, porque não há nenhuma chain (`body('email').isEmail()`, etc.)
      registrada nas rotas. Aplicar em `/login`, `/signup`, `/verify-otp`, `/resend-otp`.
- [ ] **Política mínima de senha** no `/signup` (tamanho mínimo pelo menos; idealmente checar contra senhas
      comuns/vazadas).
- [ ] **`helmet`** adicionado ao `app.js` e CORS configurado explicitamente (hoje não há nenhum dos dois).
- [ ] **Validação de variáveis de ambiente no boot** (`JWT_SECRET`, `MONGO_URI`, `SMTP_*`) — falhar rápido e
      com mensagem clara se algo obrigatório estiver ausente, em vez de quebrar de forma confusa na primeira
      requisição.
- [ ] **Handler de erro global do Express** (hoje cada rota trata erro individualmente; um throw fora dos
      `try/catch` derruba a request sem resposta JSON padronizada).
- [ ] **Revisar `app.set('trust proxy', true)`** antes de ir pra produção — hoje confia cegamente em qualquer
      `X-Forwarded-For`. Ajustar para o número de proxies reais na frente da aplicação (ou IP específico do
      load balancer/CDN).
- [ ] **Garantir que segredos nunca vão para log** (`logs.js`) — revisar todos os `logError` para não incluir
      senha, token de acesso/refresh ou código OTP em texto claro no stack/mensagem logada.
- [ ] **Índice único em `Session.refreshToken`** (defesa em profundidade; colisão é improvável com
      `crypto.randomBytes(64)`, mas o índice também acelera a busca).

## 🟠 Conformidade legal (LGPD) — bloqueadores para o MVP

Aplicável mesmo em MVP, porque o sistema já coleta dados pessoais (nome, e-mail, telefone, endereço,
data de nascimento, foto, IP, device info).

- [ ] **Política de Privacidade e Termos de Uso** publicados e linkados na tela de `/signup`, com **aceite
      explícito** (checkbox não pré-marcado) registrado no momento do cadastro.
- [ ] **Base legal definida** para cada dado coletado — hoje o cadastro pede `phone`, `address`, `birthday`,
      `bio`, `profilePicture`, `banner` sem que fique claro por que são necessários. Reavaliar: campos que não
      são essenciais para o MVP devem ser removidos ou marcados como opcionais com finalidade explícita
      (princípio da minimização, art. 6º, III da LGPD).
- [ ] **Endpoint de exclusão de conta** que apaga (ou anonimiza) o `User` e faz cascade nos documentos
      relacionados: `Session`, `Otp`, `Social`, `Notification`. Hoje não existe nenhuma rota de exclusão.
- [ ] **Endpoint de exportação/acesso aos dados** (mesmo que simples: um JSON com os dados do próprio usuário)
      para atender ao direito de acesso e portabilidade (art. 18).
- [ ] **Retenção definida para dados que hoje ficam indefinidamente**: logs de erro (`modules/logs.js` nunca
      limpa arquivos antigos), sessões expiradas/revogadas, OTPs expirados. Definir por quanto tempo cada um
      fica guardado e automatizar a limpeza.
- [ ] **Aviso de uso de cookies** (mesmo sendo cookie técnico/essencial de sessão, e não de rastreamento, é
      boa prática informar no momento do login).
- [ ] **Confirmar se há tratamento de dados de menores de idade** no público-alvo; se sim, exige consentimento
      específico dos pais/responsáveis (art. 14) — se não, deixar isso explícito nos Termos de Uso.
- [ ] **Não logar dados pessoais sensíveis** nos arquivos de log (mesmo item de segurança acima, mas também é
      exigência legal — art. 46, medidas de segurança).
- [ ] **Plano mínimo de resposta a incidente**: quem é avisado e em quanto tempo se houver vazamento (art. 48
      exige comunicação à ANPD e aos titulares "em prazo razoável"). Não precisa ser elaborado para o MVP, mas
      precisa existir por escrito.
- [ ] **Verificar contratos/DPA dos fornecedores** que processam dados em nome de vocês (provedor de e-mail
      SMTP, hospedagem do MongoDB) — confirmar que há cláusula de proteção de dados.
- [ ] **Definir/related: encarregado de dados (DPO)** e um canal de contato visível (e-mail ou formulário),
      mesmo que a função seja acumulada por alguém do time no início.

## 🟡 Recomendado antes do lançamento (não bloqueia o MVP, mas é barato resolver agora)

- [ ] Separar mensagens de erro para falha de infraestrutura vs. token inválido em `verifyToken`
      (hoje ambos caem no mesmo `403`).
- [ ] `Otp.otp` comparado com `!==` — considerar comparação em tempo constante para reduzir risco de timing
      attack (baixo risco prático aqui, mas é barato trocar).
- [ ] Definir tamanho máximo para campos livres (`bio`, `address`, etc.) no schema, para evitar payloads
      abusivos.
- [ ] Adicionar `issuer`/`audience` na assinatura e verificação do JWT.

## Fora do escopo do MVP

O restante do roadmap original (multi-app, OAuth/OIDC para terceiros, console administrativo, RBAC,
customização visual, auditoria avançada, SDKs) continua válido como visão de produto, mas não é
pré-requisito para lançar um MVP seguro e conforme com a lei. Ver histórico do `TODO.md` anterior para
essas fases.