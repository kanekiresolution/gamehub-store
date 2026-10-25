import os
import threading
from flask import Flask, request, jsonify, send_from_directory
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
ADMIN_ID = os.environ.get("ADMIN_ID", "").strip()
PAYMENT_DETAILS = os.environ.get("PAYMENT_DETAILS", "Свяжитесь с продавцом для получения реквизитов.").strip()
WEBAPP_URL = os.environ.get("WEBAPP_URL", "").strip()

app = Flask(__name__, static_folder="webapp", static_url_path="")
tg_app = None
bot_loop = None

@app.get("/")
def index():
    return send_from_directory("webapp", "index.html")

@app.get("/api/config")
def config():
    return jsonify({"paymentDetails": PAYMENT_DETAILS})

@app.post("/api/order")
def create_order():
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    customer = str(data.get("customer", "")).strip()[:100]
    contact = str(data.get("contact", "")).strip()[:150]
    note = str(data.get("note", "")).strip()[:500]
    total = data.get("total", 0)

    if not items or not isinstance(items, list):
        return jsonify({"ok": False, "error": "Корзина пуста"}), 400
    try:
        total = float(total)
        if total <= 0 or total > 10_000_000:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Некорректная сумма"}), 400

    lines = []
    try:
        for item in items[:30]:
            title = str(item.get("title", "Товар"))[:100]
            qty = max(1, min(99, int(item.get("qty", 1))))
            price = max(0, float(item.get("price", 0)))
            lines.append(f"• {title} × {qty} — {price * qty:.0f} ₽")
    except (AttributeError, TypeError, ValueError):
        return jsonify({"ok": False, "error": "Некорректные данные заказа"}), 400

    message = (
        "🛒 НОВЫЙ ЗАКАЗ\n\n" + "\n".join(lines) +
        f"\n\nИтого: {total:.0f} ₽" +
        f"\nПокупатель: {customer or 'не указано'}" +
        f"\nКонтакт: {contact or 'не указан'}" +
        f"\nКомментарий: {note or 'нет'}" +
        "\n\nСтатус: ожидает ручного подтверждения оплаты."
    )

    if tg_app and bot_loop and ADMIN_ID:
        try:
            import asyncio
            future = asyncio.run_coroutine_threadsafe(
                tg_app.bot.send_message(chat_id=int(ADMIN_ID), text=message),
                bot_loop
            )
            future.result(timeout=8)
        except Exception as exc:
            app.logger.exception("Не удалось отправить заказ админу: %s", exc)
            return jsonify({"ok": False, "error": "Не удалось уведомить администратора. Попробуйте позже."}), 503
    else:
        return jsonify({"ok": False, "error": "Бот не настроен. Администратор должен добавить BOT_TOKEN и ADMIN_ID."}), 503

    return jsonify({"ok": True, "message": "Заказ создан. Дождитесь подтверждения продавца."})


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.pop("draft", None)
    await update.message.reply_text(
        "Добро пожаловать в DWGhub!\nВыбери игру:",
        reply_markup=menu_markup()
    
        )
    else:
        await update.message.reply_text(
            "Бот создан, но магазин ещё не опубликован.\n"
            "Добавьте публичный HTTPS-адрес Mini App в переменную WEBAPP_URL на хостинге."
        )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Нажмите /start, чтобы открыть магазин.")

def run_bot():
    global tg_app
    if not BOT_TOKEN:
        print("BOT_TOKEN не задан — Telegram-бот не запущен.")
        return
    import asyncio
    async def runner():
        global tg_app, bot_loop
        bot_loop = asyncio.get_running_loop()
        tg_app = Application.builder().token(BOT_TOKEN).build()
        tg_app.add_handler(CommandHandler("start", start))
        tg_app.add_handler(CommandHandler("help", help_command))
        await tg_app.initialize()
        await tg_app.start()
        await tg_app.updater.start_polling()
        while True:
            await asyncio.sleep(3600)
    try:
        asyncio.run(runner())
    except Exception:
        app.logger.exception("Telegram-бот остановился с ошибкой")

_bot_started = False

def start_bot_once():
    global _bot_started
    if _bot_started or not BOT_TOKEN:
        return
    _bot_started = True
    threading.Thread(target=run_bot, daemon=True).start()

start_bot_once()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)

    
