// Gregorian -> Ethiopian calendar (Beyene-Kudlek algorithm).
const MONTHS = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];
const EPOCH_AMETE_MIHRET = 1723856;

function gregorianToJDN(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function toEthiopian(date) {
  const d = date || new Date();
  const jdn = gregorianToJDN(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const r = (((jdn - EPOCH_AMETE_MIHRET) % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - EPOCH_AMETE_MIHRET) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day, monthName: MONTHS[month - 1] || '' };
}

export function ethiopianDateString(date) {
  const e = toEthiopian(date);
  return `${e.monthName} ${e.day}, ${e.year}`;
}
