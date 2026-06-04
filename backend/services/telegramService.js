const TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED === "true";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

export const sendTelegramMessage = async (chatId, text) => {
  if (!TELEGRAM_ENABLED) return { skipped: true, reason: "disabled" };
  if (!TELEGRAM_BOT_TOKEN) return { skipped: true, reason: "missing_token" };
  if (!chatId) return { skipped: true, reason: "missing_chat_id" };

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }

  return { sent: true };
};
