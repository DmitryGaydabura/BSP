/*
 * Backend URL config — change this to point at your backend.
 *
 * Options:
 *  - Local dev (browser via localhost): 'http://localhost:8080/api'
 *  - ngrok tunnel (for Telegram Mini App):
 *      1. Run: ngrok http 8080
 *      2. Copy the https URL, e.g. 'https://xxxx.ngrok-free.app/api'
 *  - Deployed server: 'https://your-server.com/api'
 */
window.BSP_API_URL = 'https://bsp-backend-production.up.railway.app/api';

/*
 * Telegram Login Widget (web version only — inside Telegram the Mini App uses initData).
 * BSP_TG_BOT_ID is the numeric part of the bot token; BSP_TG_BOT_USERNAME is used for
 * deep links. The bot's domain must be registered with @BotFather (/setdomain) for the
 * widget to work — one domain per bot, so a local/ngrok host needs its own test bot.
 */
window.BSP_TG_BOT_ID = '8408626727';
window.BSP_TG_BOT_USERNAME = 'BlackSeaPadelBot';
