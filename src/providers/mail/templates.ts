// Escapa texto vindo do usuário antes de pôr no HTML do e-mail
function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[char]!)
}

export function passwordResetMail(name: string, link: string) {
    const firstName = name.split(" ")[0]

    const text = [
        `Olá, ${firstName}.`,
        "",
        "Recebemos um pedido para criar uma senha nova na sua conta do RefundPay.",
        `Para criar a senha, abra este link (vale por 1 hora): ${link}`,
        "",
        "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    ].join("\n")

    const html = `
<div style="font-family: Arial, sans-serif; color: #0C1F1B; max-width: 480px; line-height: 1.5">
  <p>Olá, ${escapeHtml(firstName)}.</p>
  <p>Recebemos um pedido para criar uma senha nova na sua conta do RefundPay.</p>
  <p style="margin: 24px 0">
    <a href="${link}" style="background: #14463A; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold">Criar senha nova</a>
  </p>
  <p style="font-size: 14px; color: #4F6B61">O link vale por 1 hora e só pode ser usado uma vez.</p>
  <p style="font-size: 14px; color: #4F6B61">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
</div>`

    return {subject: "Criar senha nova no RefundPay", text, html}
}
