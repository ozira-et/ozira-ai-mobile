// Western zodiac from a birth date (opt-in personalization).
const SIGNS = [
  { name: 'Capricorn', emoji: '♑', from: [12, 22], to: [1, 19] },
  { name: 'Aquarius', emoji: '♒', from: [1, 20], to: [2, 18] },
  { name: 'Pisces', emoji: '♓', from: [2, 19], to: [3, 20] },
  { name: 'Aries', emoji: '♈', from: [3, 21], to: [4, 19] },
  { name: 'Taurus', emoji: '♉', from: [4, 20], to: [5, 20] },
  { name: 'Gemini', emoji: '♊', from: [5, 21], to: [6, 20] },
  { name: 'Cancer', emoji: '♋', from: [6, 21], to: [7, 22] },
  { name: 'Leo', emoji: '♌', from: [7, 23], to: [8, 22] },
  { name: 'Virgo', emoji: '♍', from: [8, 23], to: [9, 22] },
  { name: 'Libra', emoji: '♎', from: [9, 23], to: [10, 22] },
  { name: 'Scorpio', emoji: '♏', from: [10, 23], to: [11, 21] },
  { name: 'Sagittarius', emoji: '♐', from: [11, 22], to: [12, 21] },
];

// birthday: 'YYYY-MM-DD'. Returns { name, emoji } or null.
export function zodiacFor(birthday) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [, m, d] = birthday.split('-').map(Number);
  for (const s of SIGNS) {
    const [fm, fd] = s.from;
    const [tm, td] = s.to;
    if (fm === tm) { if (m === fm && d >= fd && d <= td) return s; continue; }
    // range spans two months (or wraps the year for Capricorn)
    if ((m === fm && d >= fd) || (m === tm && d <= td)) return s;
  }
  return null;
}

export function isValidBirthday(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const now = new Date().getFullYear();
  if (y < 1900 || y > now) return false;
  return true;
}
