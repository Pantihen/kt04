# kt04 — блог-API: аутентификация, RBAC, безопасность, тесты

Расширение КТ №3. Express 5 + Prisma 6 (SQLite) + Joi + JWT + bcrypt + helmet + express-rate-limit.
Тесты — Jest + Supertest.

## Запуск

```bash
npm install
cp .env.example .env        # в production задайте свои JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
npx prisma migrate dev      # применить миграции
npm run seed                # демо-аккаунты: admin@example.com / admin123, moderator@example.com / moderator123
npm start                   # src/server.js
npm test                    # все тесты (отдельная база prisma/test.db создаётся автоматически)
```

Структура: `src/app.js` — само приложение (экспортируется для тестов), `src/server.js` — запуск `listen`.

## Аутентификация

| Метод | URL            | Описание |
|-------|----------------|----------|
| POST  | /auth/register | Регистрация `{ email, name, password }`, пароль хэшируется bcrypt, роль всегда USER → 201 |
| POST  | /auth/login    | `{ email, password }` → `{ accessToken, user }` + refresh token в httpOnly cookie. Лимит: 10 запросов / 15 мин |
| POST  | /auth/refresh  | Новый access token по refresh token из cookie (cookie тоже обновляется) |
| POST  | /auth/logout   | Очистка cookie → 204 |
| GET   | /auth/me       | Текущий пользователь (нужен `Authorization: Bearer <accessToken>`) |

Access token живёт 15 минут, refresh — 7 дней; они подписаны разными секретами.
Пароль никогда не возвращается в ответах (глобальный `omit` в PrismaClient).

## RBAC

Все маршруты `/api/*` и `/admin/*` требуют access token. Роль берётся из БД при каждом запросе,
поэтому смена роли действует сразу.

| Маршрут                     | USER        | MODERATOR | ADMIN |
|-----------------------------|-------------|-----------|-------|
| GET /api/posts              | ✓           | ✓         | ✓     |
| POST /api/posts             | ✓           | ✓         | ✓     |
| PATCH /api/posts/:id        | только свои | любые     | любые |
| DELETE /api/posts/:id       | только свои | любые     | любые |
| GET /api/users              | ✗           | ✓         | ✓     |
| PATCH /admin/users/:id/role | ✗           | ✗         | ✓     |

Остальные маршруты: `GET /api/posts/:id`, `GET /api/users/:id` — любая роль;
`PATCH`/`DELETE /api/users/:id` — свой профиль или ADMIN; `POST /api/users` — только ADMIN.
В `POST /api/posts` автором становится текущий пользователь (`authorId` из тела не принимается).

Коды: `401` — нет/неверный токен, `403` — недостаточно прав, `404` — не найдено.

## Безопасность

- `helmet()` — `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` и другие заголовки
- rate limiting на `/auth/login`: не более 10 запросов за 15 минут, затем `429`
- `express.json({ limit: '10kb' })` — большее тело запроса → `413`
- error handler: при `NODE_ENV=production` stack trace и текст внутренних ошибок не отдаются
- refresh cookie: `httpOnly`, `sameSite=strict`, `path=/auth`, `secure` в production

## Тесты (31, `npm test`)

- `tests/auth.test.js` — регистрация (успех, дубль email, валидация), логин (успех, неверный пароль),
  refresh, logout, `/auth/me` с токеном и без
- `tests/rbac.test.js` — владелец удаляет свой пост, чужой USER получает 403, права MODERATOR/ADMIN,
  `GET /api/users` и смена роли
- `tests/security.test.js` — заголовки helmet, лимит 10kb, rate limit
- `tests/unit/` — unit-тесты JWT-утилиты, middleware валидации и error handler

## PostgreSQL

В `prisma/schema.prisma` поменять `provider = "postgresql"`, в `.env` указать `DATABASE_URL="postgresql://..."`,
удалить `prisma/migrations` и выполнить `npx prisma migrate dev --name init`.
Поиск по заголовку тогда автоматически использует `mode: 'insensitive'`.
