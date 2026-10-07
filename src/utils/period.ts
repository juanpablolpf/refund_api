// Períodos de mês no horário de Brasília (UTC-3, sem horário de verão desde 2019).
// Ex.: um pedido feito às 22h do dia 31 conta no mês 31, não no mês seguinte (que já seria em UTC).
const OFFSET_HOURS = 3

function currentYearMonth(now: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(now)
    const year = Number(parts.find((p) => p.type === "year")!.value)
    const month = Number(parts.find((p) => p.type === "month")!.value)
    return { year, month }
}

// offset 0 = mês atual, -1 = mês passado
export function monthRange(offset = 0, now = new Date()) {
    const { year, month } = currentYearMonth(now)
    const start = new Date(Date.UTC(year, month - 1 + offset, 1, OFFSET_HOURS))
    const end = new Date(Date.UTC(year, month + offset, 1, OFFSET_HOURS))
    return { start, end }
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })

export function formatDateBR(date: Date) {
    return dateFormat.format(date)
}
