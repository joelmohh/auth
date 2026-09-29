# Documentação das rotas

Esta documentação descreve as rotas implementadas atualmente pelo serviço.

## Configuração

- Base URL local: `http://localhost:3000`
- Porta: `PORT` ou `3000`
- JSON: envie `Content-Type: application/json` nas requisições com corpo JSON.
- Todas as respostas da API usam JSON.

As rotas são registradas em `app.js` com estes prefixos:

| Prefixo | Arquivo | Finalidade |
| --- | --- | --- |
| `/api/auth` | `routes/auth.api.routes.js` | Cadastro, login e verificação de conta |
| `/api/apps` | `routes/apps.api.routes.js` | Gerenciamento de apps e usuários |
| `/` | `routes/static.routes.js` | Páginas renderizadas em EJS |

## Autenticação

As rotas protegidas exigem um access token no header:

```http
Authorization: Bearer <accessToken>
```

O access token é retornado por `/api/auth/login` e `/api/auth/verify-otp`, tem validade de 1 hora e é validado contra uma sessão ativa no banco.

Durante o login ou a verificação do OTP, o servidor também define o cookie `refreshToken`:

- `httpOnly: true`
- `secure: true`
- `sameSite: Strict`
- validade: 7 dias

Apesar de existir middleware para validar esse cookie, não há endpoint público de refresh ou logout implementado atualmente.

## API de autenticação

### `POST /api/auth/signup`

Cria uma conta e gera um OTP de verificação.

**Corpo:**

```json
{
  "username": "maria",
  "email": "maria@example.com",
  "password": "senha-segura",
  "phone": "+55 11 99999-9999",
  "address": "Rua A, 100",
  "birthday": "1990-01-01",
  "fullName": "Maria Silva",
  "bio": "Sobre a Maria",
  "profilePicture": "https://example.com/profile.jpg",
  "banner": "https://example.com/banner.jpg"
}
```

Somente `username`, `email` e `password` são obrigatórios. Os demais campos são opcionais.

**Resposta `201`:**

```json
{
  "success": true,
  "message": "Account created. Please check your email for the verification code.",
  "email": "maria@example.com",
  "requiresVerification": true
}
```

**Erros principais:**

- `400`: campo obrigatório ausente, e-mail inválido ou usuário/e-mail já existente.
- `500`: erro interno.

> Observação: o OTP atualmente é exibido no log do servidor. O envio de e-mail está desativado no código.

### `POST /api/auth/login`

Autentica uma conta existente.

**Corpo:**

```json
{
  "email": "maria@example.com",
  "password": "senha-segura"
}
```

**Resposta `200`:**

```json
{
  "success": true,
  "message": "Login successful.",
  "accessToken": "<jwt>",
  "redirectURL": "/dashboard"
}
```

Além da resposta, define o cookie `refreshToken`.

**Erros principais:**

- `400`: e-mail ou senha ausentes, ou senha inválida.
- `401`: credenciais inválidas quando o usuário não existe.
- `403`: conta ainda não verificada; um novo OTP é gerado.
- `500`: erro interno.

### `POST /api/auth/verify-otp`

Confirma a conta usando o OTP enviado ao e-mail e cria uma sessão autenticada.

**Corpo:**

```json
{
  "email": "maria@example.com",
  "otp": "123456"
}
```

**Resposta `200`:**

```json
{
  "success": true,
  "message": "OTP verified successfully.",
  "accessToken": "<jwt>"
}
```

Também define o cookie `refreshToken`.

**Erros principais:**

- `400`: campos ausentes, OTP expirado ou inválido.
- `404`: usuário ou OTP não encontrado.
- `500`: erro interno.

### `POST /api/auth/resend-otp`

Remove o OTP anterior e gera um novo para o usuário.

**Corpo:**

```json
{
  "email": "maria@example.com"
}
```

**Resposta `200`:**

```json
{
  "success": true,
  "message": "OTP sent successfully."
}
```

**Erros principais:**

- `400`: e-mail ausente.
- `404`: usuário não encontrado.
- `500`: erro interno.

## API de apps

Todas as rotas desta seção exigem autenticação com `Authorization: Bearer <accessToken>`.

### `GET /api/apps/get`

Lista os apps cujo `owner` é o usuário da sessão.

**Resposta `200`:**

```json
{
  "success": true,
  "apps": [
    {
      "_id": "<appId>",
      "name": "Meu app",
      "description": "Descrição",
      "permissions": [],
      "owner": "<userId>",
      "profilePicture": "",
      "banner": "",
      "backgroundColor": "#000000"
    }
  ]
}
```

### `GET /api/apps/get/:id`

Busca um app específico pertencente ao usuário autenticado.

**Parâmetro de rota:** `id` é o ID MongoDB do app.

**Erros principais:** `404` se o app não existir ou não pertencer ao usuário; `500` em erro interno.

### `POST /api/apps/create`

Cria um app para o usuário autenticado.

**Corpo:**

```json
{
  "name": "Meu app",
  "description": "Descrição do app",
  "profilePicture": "https://example.com/profile.jpg",
  "banner": "https://example.com/banner.jpg",
  "backgroundColor": "#ffffff"
}
```

`name` é obrigatório pelo model `App`. Os demais campos são opcionais e recebem valores padrão quando omitidos.

**Resposta `200`:** `{ "success": true, "app": { "...": "..." } }`

**Erros principais:** `500` em erro interno ou falha de validação do model.

### `PUT /api/apps/details/update/:id`

Atualiza os detalhes de um app pertencente ao usuário autenticado.

**Parâmetro de rota:** `id` é o ID MongoDB do app.

**Corpo:** aceita `name`, `description`, `profilePicture`, `banner` e `backgroundColor`.

**Resposta `200`:** `{ "success": true, "app": { "...": "..." } }`

**Erros principais:** `404` se o app não existir ou não pertencer ao usuário; `500` em erro interno.

### `PUT /api/apps/permissions/update/:id`

Substitui as permissões de um app pertencente ao usuário autenticado.

**Corpo:**

```json
{
  "permissions": ["read", "write"]
}
```

**Resposta `200`:** `{ "success": true, "app": { "...": "..." } }`

**Erros principais:** `404` se o app não existir ou não pertencer ao usuário; `500` em erro interno.

### `DELETE /api/apps/delete/:id`

Exclui um app pertencente ao usuário autenticado.

**Resposta `200`:**

```json
{
  "success": true,
  "message": "App deleted successfully."
}
```

**Erros principais:** `404` se o app não existir ou não pertencer ao usuário; `500` em erro interno.

### `GET /api/apps/:appId/user/:id`

Busca um usuário associado ao app informado.

**Parâmetros de rota:**

- `appId`: ID MongoDB do app.
- `id`: ID MongoDB do usuário.

**Resposta `200`:** `{ "success": true, "user": { "...": "..." } }`

**Erros principais:**

- `404`: app não encontrado.
- `404`: usuário não encontrado nesse app.
- `500`: erro interno.

### `GET /api/apps/:appId/users`

Lista os usuários associados ao app com paginação.

**Query params:**

- `page`: página, padrão `1`.
- `limit`: quantidade por página, padrão `10`.

Exemplo: `/api/apps/65f000000000000000000001/users?page=2&limit=20`

**Resposta `200`:**

```json
{
  "success": true,
  "users": [],
  "totalUsers": 42,
  "currentPage": 2,
  "totalPages": 3
}
```

**Erros principais:** `404` se o app não existir; `500` em erro interno.

### `POST /api/apps/:appId/user/update/:id`

Atualiza os dados de um usuário associado ao app.

**Parâmetros de rota:** `appId` e `id` são IDs MongoDB do app e do usuário.

**Corpo:** aceita `name`, `email`, `phone`, `address`, `birthday`, `fullName`, `bio`, `profilePicture` e `banner`.

**Resposta `200`:** `{ "success": true, "user": { "...": "..." } }`

**Erros principais:** `404` se o usuário não for encontrado no app; `500` em erro interno.

## Páginas web

Estas rotas renderizam templates EJS e não retornam JSON:

| Método | Rota | View |
| --- | --- | --- |
| `GET` | `/` | `login` |
| `GET` | `/login` | `login` |
| `GET` | `/signup` | `signup` |
| `GET` | `/reset-password` | `resetPassword` |
| `GET` | `/verify-otp` | `verifyOtp` |
| `GET` | `/dashboard` | `dashboard/index` |

A rota `/dashboard` não usa middleware de autenticação no servidor; a proteção depende do comportamento do frontend.

## Revisão e pendências encontradas

- Não existe rota de refresh do access token, embora `verifyRefreshToken` esteja implementado.
- Não existe rota de logout para marcar a sessão como `revoked: true`.
- Não existe API de reset de senha; `/reset-password` é apenas uma página.
- O middleware `validate` é usado somente no login, mas não há chains do `express-validator` registradas, então ele não acrescenta validação atualmente.
- As rotas `GET /api/apps/:appId/user/:id`, `GET /api/apps/:appId/users` e `POST /api/apps/:appId/user/update/:id` verificam que o token é válido, mas não verificam se `req.user.id` é dono do `appId`. Isso deve ser corrigido antes de permitir acesso administrativo a dados de apps.
- Os IDs de rota não são validados antes das consultas MongoDB; IDs malformados podem cair no tratamento genérico de erro `500`.
- O cadastro informa que enviará o OTP, mas o envio real por e-mail está comentado e o código é impresso no log.
- Não há rate limiting nas rotas de autenticação.
