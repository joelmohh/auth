# Roadmap da Plataforma de Autenticação

## Objetivo final

Transformar o projeto em uma plataforma de autenticação multi-app, na qual cada usuário possa criar e administrar seus próprios aplicativos de autenticação, configurar provedores OAuth/OIDC, personalizar a experiência visual e fornecer autenticação para aplicações externas.

## Diagnóstico atual

O projeto atualmente é um protótipo visual com partes do fluxo de autenticação implementadas.

### O que já existe

- Aplicação Express com EJS.
- Conexão com MongoDB via Mongoose.
- Cadastro com senha.
- Login com senha.
- Verificação por OTP enviado por e-mail.
- Estrutura inicial de sessões e refresh token.
- Modelos iniciais de usuário, app, sessão, OTP e rede social.
- Telas visuais de login, cadastro, OTP, reset de senha e dashboard.
- SMTP para envio de e-mails.

### Problemas atuais

- OAuth social ainda não possui implementação real.
- Os botões de Google, GitHub, Apple, Microsoft e outros são apenas visuais.
- `App.js`, `Social.js` e `Notifications.js` não exportam seus models.
- O campo global `User.app` não suporta múltiplos aplicativos.
- O e-mail é globalmente único, impedindo isolamento por app.
- `password` é obrigatório, impedindo usuários exclusivamente sociais.
- O modelo `Social` não armazena o identificador estável retornado pelo provedor.
- Refresh tokens são armazenados em texto puro.
- Refresh tokens não possuem rotação nem detecção de reutilização.
- O TTL da sessão é incompatível com a duração declarada do refresh token.
- OTP usa `Math.random()` e não possui limite de tentativas ou rate limit.
- Recuperação de senha não possui API funcional.
- Não existem middleware de autenticação e autorização.
- Não existe isolamento de dados por app.
- O console e o dashboard usam dados estáticos.
- O frontend possui referências quebradas, incluindo `DataTransferItem.success`, `name` versus `fullName` e formulários inexistentes em algumas páginas.
- Não existem testes automatizados.
- Não existem logs de auditoria, métricas, consentimento OAuth ou revogação completa de tokens.

## Arquitetura alvo

A plataforma deve separar a conta administrativa dos usuários finais dos aplicativos.

```text
Usuário administrador
  └── Workspace/Organization
        └── Apps de autenticação
              ├── configurações visuais
              ├── redirect URIs
              ├── OAuth clients
              ├── provedores habilitados
              ├── políticas de login
              └── usuários finais
```

### Entidades principais

- `User`: usuário da plataforma que administra os apps.
- `Organization` ou `Workspace`: agrupamento e proprietário dos apps.
- `App`: aplicativo criado pelo administrador.
- `AppMember`: permissões de administração dentro do app.
- `EndUser`: usuário final autenticado por um app.
- `Identity`: vínculo do usuário com Google, GitHub, Apple, Microsoft etc.
- `OAuthProviderConfig`: configuração de cada provedor OAuth/OIDC.
- `OAuthClient`: client ID, segredo hash e redirect URIs.
- `Session`: sessão e refresh token.
- `AuthTransaction`: estado temporário de login, OAuth, OTP e consentimento.
- `AuditLog`: eventos de segurança e administração.
- `CustomDomain`: domínio personalizado, em uma fase posterior.

# TODO

## Fase 0: Corrigir o protótipo atual

- [x] Corrigir os exports de `App`, `Social` e `Notifications`.
- [ ] Remover imports sem uso.
- [ ] Corrigir o carregamento condicional em `public/js/auth.js`.
- [x] Corrigir `DataTransferItem.success` para `data.success`.
- [ ] Corrigir `fullName` versus `name`.
- [x] Corrigir o uso de `response.redirectURL` para `data.redirectURL`.
- [x] Corrigir o uso de `response.verified` para `data.verified` no login.
- [ ] Criar rotas reais para console e dashboard.
- [ ] Remover dados mockados das telas administrativas.
- [ ] Criar tratamento global de erros do Express.
- [ ] Configurar corretamente cookies e leitura de cookies.
- [ ] Validar variáveis obrigatórias de ambiente na inicialização.
- [ ] Adicionar scripts `dev`, `start` e `test` no `package.json`.
- [ ] Criar testes básicos para cadastro, login e OTP.

### Critério de conclusão

Um usuário consegue cadastrar, verificar a conta e fazer login pelo navegador sem erros de frontend ou backend.

## Fase 1: Fundamentos de segurança

- [ ] Criar middleware `requireAuth`.
- [ ] Validar JWT com issuer, audience e expiração.
- [ ] Incluir `userId`, `appId`, scopes e versão da sessão no token.
- [ ] Armazenar somente hash dos refresh tokens.
- [ ] Implementar rotação de refresh token.
- [ ] Detectar e revogar tokens reutilizados.
- [ ] Corrigir a expiração das sessões.
- [ ] Configurar cookies `httpOnly`, `secure`, `sameSite` e domínio.
- [ ] Adicionar rate limit em login, cadastro, OTP e reset de senha.
- [ ] Trocar `Math.random()` por `crypto.randomInt()` no OTP.
- [ ] Adicionar limite de tentativas de OTP.
- [ ] Remover OTP após uso ou expiração.
- [ ] Criar tokens de reset de senha com uso único e expiração.
- [ ] Adicionar `helmet` e CORS configurável.
- [ ] Não registrar senhas, tokens ou códigos OTP nos logs.

### Critério de conclusão

Sessões, OTP e recuperação de senha possuem expiração, revogação, rate limit e testes de abuso.

## Fase 2: Modelo multi-app

- [ ] Remover o campo global `User.app`.
- [ ] Criar `Organization` ou `Workspace`.
- [ ] Transformar `App` em uma entidade completa.
- [ ] Adicionar `appId`, `ownerId`, `organizationId`, `name`, `slug` e `status`.
- [ ] Adicionar ambientes `development`, `staging` e `production`.
- [ ] Adicionar `clientId`, `clientSecretHash`, `redirectUris` e `allowedOrigins`.
- [ ] Adicionar scopes e políticas de autenticação.
- [ ] Criar relação entre usuários finais e apps.
- [ ] Permitir o mesmo e-mail em apps diferentes.
- [ ] Criar índices compostos por `appId` e identidade.
- [ ] Separar administradores de usuários finais.
- [ ] Criar RBAC com `owner`, `admin`, `developer`, `analyst` e `support`.
- [ ] Aplicar autorização por app em todas as rotas administrativas.

### Critério de conclusão

Um administrador consegue criar dois apps isolados e nenhum dado de um app aparece no outro.

## Fase 3: OAuth e provedores sociais

### Login social

- [ ] Criar uma camada abstrata para provedores.
- [ ] Integrar Google.
- [ ] Integrar GitHub.
- [ ] Integrar Microsoft.
- [ ] Integrar Apple.
- [ ] Integrar Discord.
- [ ] Avaliar integração com X.
- [ ] Usar Authorization Code Flow.
- [ ] Usar PKCE para clientes públicos.
- [ ] Validar `state` contra CSRF.
- [ ] Validar `nonce` em fluxos OIDC.
- [ ] Validar issuer, audience e assinatura dos tokens.
- [ ] Armazenar `provider` e `providerSubject`.
- [ ] Criptografar access tokens e refresh tokens dos provedores.
- [ ] Permitir várias identidades na mesma conta.
- [ ] Criar fluxo para conectar e desconectar provedores.
- [ ] Impedir a remoção do último método de login.

### OAuth/OIDC para aplicações externas

- [ ] Criar endpoint `/oauth/authorize`.
- [ ] Criar endpoint `/oauth/token`.
- [ ] Criar endpoint `/oauth/revoke`.
- [ ] Criar endpoint `/oauth/userinfo`.
- [ ] Criar endpoint de discovery OIDC.
- [ ] Criar endpoint JWKS.
- [ ] Implementar tela de consentimento por app.
- [ ] Validar rigorosamente `redirect_uri`.
- [ ] Implementar authorization code de uso único.
- [ ] Implementar access token e refresh token.
- [ ] Implementar scopes `openid`, `profile` e `email`.
- [ ] Permitir scopes customizados por app.
- [ ] Implementar logout local e logout global.
- [ ] Permitir revogação por usuário e administrador.

### Critério de conclusão

Uma aplicação externa consegue redirecionar para a plataforma, autenticar por senha ou OAuth social, receber um authorization code e trocá-lo por tokens válidos.

## Fase 4: Console de criação e customização

- [ ] Transformar o console estático em páginas autenticadas.
- [ ] Criar tela de apps do usuário.
- [ ] Criar fluxo para criar um app.
- [ ] Gerar automaticamente `clientId`.
- [ ] Exibir o client secret somente uma vez.
- [ ] Permitir rotação do client secret.
- [ ] Configurar redirect URIs.
- [ ] Configurar allowed origins.
- [ ] Habilitar e desabilitar provedores.
- [ ] Selecionar métodos de autenticação.
- [ ] Suportar senha, magic link, OTP, OAuth social e passkeys.
- [ ] Customizar nome, logo, cores, tipografia e fundo.
- [ ] Customizar textos de login, cadastro, erro e consentimento.
- [ ] Configurar campos obrigatórios do perfil.
- [ ] Configurar política de senha.
- [ ] Configurar verificação de e-mail.
- [ ] Configurar MFA.
- [ ] Criar preview em tempo real.
- [ ] Criar publicação de versões da configuração.
- [ ] Permitir rollback da configuração anterior.

### Critério de conclusão

Cada usuário consegue criar um app, personalizar a tela de autenticação e usar essa configuração em um fluxo real.

## Fase 5: Administração e operação

- [ ] Listar usuários por app.
- [ ] Pesquisar por e-mail, telefone e ID.
- [ ] Visualizar identidades conectadas.
- [ ] Suspender e reativar usuários.
- [ ] Revogar sessões.
- [ ] Forçar reset de senha.
- [ ] Exportar usuários.
- [ ] Importar usuários com validação.
- [ ] Criar logs de auditoria.
- [ ] Registrar logins, falhas, alterações de senha, OAuth, sessões e configurações.
- [ ] Criar métricas de login, erros, conversão e provedores.
- [ ] Criar página de uso e limites.
- [ ] Criar alertas para comportamento suspeito.
- [ ] Definir retenção e anonimização de dados.

## Fase 6: Produção e escala

- [ ] Separar ambientes de desenvolvimento, staging e produção.
- [ ] Usar Redis para rate limit, sessões temporárias e OAuth state.
- [ ] Usar fila para envio de e-mails.
- [ ] Migrar logs para armazenamento estruturado.
- [ ] Configurar rotação de chaves JWT.
- [ ] Usar KMS ou secret manager para secrets.
- [ ] Criar health checks.
- [ ] Criar métricas e tracing.
- [ ] Configurar backup e restauração do MongoDB.
- [ ] Criar testes de integração com provedores OAuth.
- [ ] Criar testes de carga.
- [ ] Criar documentação de integração.
- [ ] Criar SDKs para JavaScript, Node e React.
- [ ] Criar documentação com exemplos.
- [ ] Adicionar política de privacidade e termos de uso.
- [ ] Implementar processo de exclusão de dados conforme a LGPD.

# Ordem recomendada

1. Corrigir o protótipo atual.
2. Implementar segurança, sessões e recuperação de senha.
3. Criar o modelo multi-app.
4. Implementar o console autenticado.
5. Integrar Google e GitHub.
6. Implementar OAuth/OIDC para apps externos.
7. Adicionar Microsoft, Apple, Discord e demais provedores.
8. Adicionar customização visual e políticas de autenticação.
9. Criar auditoria, métricas e operação.
10. Preparar produção, SDKs e documentação.

## Decisão estrutural mais importante

A conta que cria e administra aplicativos precisa ser separada dos usuários finais autenticados por esses aplicativos. Manter o modelo atual, baseado em `User.app`, limita múltiplos apps, OAuth, isolamento de dados e personalização por cliente.
