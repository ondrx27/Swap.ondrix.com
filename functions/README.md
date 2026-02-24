# Cloudflare Pages Functions (Same-Domain API)

Функции автоматически работают на том же домене что и сайт.

## Структура

```
functions/
  api/
    sign.js   → POST /api/sign
    quote.js  → GET /api/quote
```

## Переменные окружения

Для работы функций необходимо добавить следующие переменные:

| Переменная | Описание | Пример |
|------------|----------|--------|
| `MOONPAY_SECRET_KEY` | Секретный ключ MoonPay (sk_*) | `sk_test_...` или `sk_live_...` |
| `MOONPAY_API_KEY` | Публичный ключ MoonPay (pk_*) | `pk_test_...` или `pk_live_...` |

## Деплой

```bash
# 1. Собрать проект
npm run build

# 2. Задеплоить на Cloudflare Pages
wrangler pages deploy dist --project-name=jupiter-exchange

# 3. Добавить переменные окружения в настройках Pages:
#    Dashboard → Pages → [project] → Settings → Environment variables
#    - MOONPAY_SECRET_KEY
#    - MOONPAY_API_KEY
```

## Как работает

1. Cloudflare Pages автоматически находит папку `functions/`
2. Файлы `api/sign.js` и `api/quote.js` становятся API endpoints
3. Сайт на `domain.com`, API на `domain.com/api/*`
4. Без CORS проблем - всё на одном домене

## Локальная разработка

```bash
# Вариант 1: Использовать локальный Express сервер
npm run dev          # Vite на :5173
npm run server       # API на :3001

# Вариант 2: Использовать Wrangler для эмуляции Cloudflare
npm run build
wrangler pages dev dist
```

### Локальные секреты

Для локальной разработки с Wrangler создайте файл `.dev.vars`:

```bash
MOONPAY_SECRET_KEY=sk_test_your_key
MOONPAY_API_KEY=pk_test_your_key
```

⚠️ **Важно:** Файл `.dev.vars` уже добавлен в `.gitignore` и не должен коммититься в git!

## API Endpoints

### POST /api/sign

Подписывает MoonPay URL с использованием HMAC-SHA256.

**Request:**
```json
{
  "url": "https://buy.moonpay.com?apiKey=pk_test_...&currencyCode=sol"
}
```

**Response:**
```json
{
  "signedUrl": "https://buy.moonpay.com?apiKey=...&signature=...",
  "signature": "encoded_signature"
}
```

### GET /api/quote

Получает котировку на покупку криптовалюты.

**Request:**
```
GET /api/quote?currencyCode=sol&baseCurrencyAmount=50&baseCurrencyCode=usd
```

**Response:**
```json
{
  "quoteCurrencyAmount": 0.25,
  "feeAmount": 4.99,
  "totalAmount": 54.99,
  "baseCurrencyAmount": 50
}
```
