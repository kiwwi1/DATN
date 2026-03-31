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
