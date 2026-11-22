# Auth Central

> [!WARNING]
> This project is still under development and missing some key parts, but what's here is fully functional.

This project's original aim (and hopefully once it's completed it will achieve it!) is to be an open source tool like [Clerk](https://clerk.com), where you can have multiple login sources like Google, Apple, X, etc. with one simple implementation.

## What works today
- Email + password signup with OTP verification
- OAuth2 provider with PKCE: authorize, token exchange, refresh token rotation and userinfo
- Google login
- Dashboard to manage apps, users and sessions
- Account portal with data export and account deletion

## Project images
![Login screen](https://blob.squarecloud.dev/pub/1046534192915296286/image.png)
![Dashboard](https://blob.squarecloud.dev/pub/1046534192915296286/image1.png)
![Authorization screen](https://blob.squarecloud.dev/pub/1046534192915296286/image2.png)

## This project was made using
- Node.js
- EJS
- MongoDB
- Bootstrap v6
- CSS and JS

## How to run it locally?

Prerequisites: Node.js 18+ and MongoDB (local or Atlas).

1. Clone it
```bash
git clone https://github.com/joelmohh/auth
```
2. Install dependencies with `npm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Run it with `node app.js`
5. Try it on `http://localhost:3000` or your chosen port.

## Testing
Check [DOCS.md](DOCS.md) for the full testing guide: setup from scratch, how to test every flow and what to expect at each step.

## Want to try it out?
Try it at [auth.joelmo.dev](https://auth.joelmo.dev)

## Contributing
Feel free to contribute or create an issue.