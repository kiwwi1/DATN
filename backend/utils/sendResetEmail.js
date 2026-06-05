import nodemailer from "nodemailer";

const getTransporter = () => {
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_APP_PASSWORD?.replace(/\s/g, "");
    if (!user || !pass) {
        throw new Error("Thiếu MAIL_USER hoặc MAIL_APP_PASSWORD trong .env");
    }
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
};

/**
 * @param {string} to
 * @param {string} otp - 6-digit OTP code
 */
export const sendVerificationEmail = async (to, otp) => {
    const from = process.env.MAIL_FROM || process.env.MAIL_USER;
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"Shop" <${from}>`,
        to,
        subject: "Xác minh email đăng ký tài khoản",
        text: `Mã xác minh của bạn là: ${otp}\n\nMã có hiệu lực trong 15 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#111">Xác minh email của bạn</h2>
            <p>Cảm ơn bạn đã đăng ký! Vui lòng nhập mã OTP bên dưới để hoàn tất đăng ký:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px;margin:20px 0">${otp}</div>
            <p style="color:#666;font-size:13px">Mã có hiệu lực trong <strong>15 phút</strong>. Nếu bạn không thực hiện đăng ký, hãy bỏ qua email này.</p>
          </div>
        `,
    });
};

/**
 * @param {string} to
 * @param {string} resetUrl - full URL to frontend reset page with ?token=
 */
export const sendPasswordResetEmail = async (to, resetUrl) => {
    const from = process.env.MAIL_FROM || process.env.MAIL_USER;
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"Shop" <${from}>`,
        to,
        subject: "Đặt lại mật khẩu",
        text: `Bạn đã yêu cầu đặt lại mật khẩu. Mở liên kết sau (có hiệu lực 1 giờ):\n\n${resetUrl}\n\nNếu bạn không yêu cầu, bỏ qua email này.`,
        html: `
          <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;">Đặt lại mật khẩu</a></p>
          <p>Hoặc copy liên kết: <br/><code>${resetUrl}</code></p>
          <p style="color:#666;font-size:12px;">Liên kết có hiệu lực 1 giờ. Nếu bạn không yêu cầu, bỏ qua email này.</p>
        `,
    });
};

/**
 * @param {string} to - địa chỉ email người nhận
 * @param {string} userName - tên người dùng
 * @param {{ name: string, oldPrice: number, newPrice: number, discountPct: number, productUrl: string, thumbUrl?: string }} product
 */
export const sendPriceDropEmail = async (to, userName, product) => {
    const from = process.env.MAIL_FROM || process.env.MAIL_USER;
    const transporter = getTransporter();

    const fmt = (n) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

    const thumbHtml = product.thumbUrl
        ? `<img src="${product.thumbUrl}" alt="${product.name}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin-right:16px;flex-shrink:0;" />`
        : "";

    await transporter.sendMail({
        from: `"Shop" <${from}>`,
        to,
        subject: `Giá giảm ${product.discountPct > 0 ? `-${product.discountPct}%` : ""} — ${product.name}`,
        text:
            `Xin chào ${userName},\n\n` +
            `Sản phẩm "${product.name}" trong giỏ hàng của bạn vừa giảm giá!\n` +
            `Giá cũ: ${fmt(product.oldPrice)}\n` +
            `Giá mới: ${fmt(product.newPrice)}\n` +
            (product.discountPct > 0 ? `Giảm: ${product.discountPct}%\n` : "") +
            `\nXem ngay: ${product.productUrl}`,
        html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">🏷️ Thông báo giảm giá</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">Xin chào <strong>${userName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;">Sản phẩm trong giỏ hàng của bạn vừa <strong style="color:#dc2626;">giảm giá</strong>!</p>

            <!-- Product card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="padding:16px;display:flex;align-items:center;">
                  <div style="display:flex;align-items:center;gap:16px;">
                    ${thumbHtml}
                    <div>
                      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#111827;">${product.name}</p>
                      <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;text-decoration:line-through;">${fmt(product.oldPrice)}</p>
                      <p style="margin:0;font-size:22px;font-weight:700;color:#dc2626;">${fmt(product.newPrice)}</p>
                      ${product.discountPct > 0 ? `<span style="display:inline-block;margin-top:6px;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;">Giảm ${product.discountPct}%</span>` : ""}
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#111111;">
                  <a href="${product.productUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Mua ngay →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Bạn nhận email này vì đã bật thông báo giảm giá cho sản phẩm này. Để tắt, vào <a href="${process.env.FRONTEND_URL || ""}/profile/notification-settings" style="color:#6b7280;">cài đặt thông báo</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
        `.trim(),
    });
};
