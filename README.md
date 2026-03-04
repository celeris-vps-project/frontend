# Celeris Frontend (Vue Auth MVP)

Minimal Vue 3 frontend for authentication only:
- Login
- Register

## API Contract (from backend-core)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`

Request payload:
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

Success response:
```json
{
  "message": "登录成功/注册成功",
  "token": "jwt-token"
}
```

## Setup
1. Copy env file:
   - `.env.example` -> `.env`
2. Set backend base URL:
   - `VITE_API_BASE_URL=http://localhost:8888`
3. Run:
   - `npm install`
   - `npm run dev`

## Notes
- JWT token is stored in `localStorage` with key `auth_token`.
- Backend must enable CORS if frontend and backend run on different origins.
