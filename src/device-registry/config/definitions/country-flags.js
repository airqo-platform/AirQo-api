const countryCodes = {
  Uganda: "ug",
  Kenya: "ke",
  Nigeria: "ng",
  Cameroon: "cm",
  Ghana: "gh",
  Senegal: "sn",
  "Ivory Coast": "ci",
  Tanzania: "tz",
  Burundi: "bi",
  Rwanda: "rw",
  "Democratic Republic of the Congo": "cd",
  Zambia: "zm",
  Mozambique: "mz",
  Malawi: "mw",
  Zimbabwe: "zw",
  Botswana: "bw",
  Namibia: "na",
  "South Africa": "za",
  Lesotho: "ls",
  Eswatini: "sz",
  Angola: "ao",
  "Republic of the Congo": "cg",
  Gabon: "ga",
  "Equatorial Guinea": "gq",
  "Central African Republic": "cf",
  Chad: "td",
  Niger: "ne",
  Mali: "ml",
  "Burkina Faso": "bf",
  Togo: "tg",
  Benin: "bj",
  "Sierra Leone": "sl",
  Liberia: "lr",
  Guinea: "gn",
  "Guinea-Bissau": "gw",
  Gambia: "gm",
  "Cape Verde": "cv",
  Mauritania: "mr",
  "Western Sahara": "eh",
  Morocco: "ma",
  Algeria: "dz",
  Tunisia: "tn",
  Libya: "ly",
  Egypt: "eg",
  Sudan: "sd",
  "South Sudan": "ss",
  Eritrea: "er",
  Djibouti: "dj",
  Somalia: "so",
  Ethiopia: "et",
  Comoros: "km",
  Seychelles: "sc",
  Mauritius: "mu",
  Madagascar: "mg",
};

// Pre-built lowercase Map for O(1) lookup instead of O(n) scan per call.
const _flagLookup = new Map(
  Object.entries(countryCodes).map(([k, v]) => [k.toLowerCase(), v])
);

const getFlagUrl = (countryName) => {
  if (!countryName) return null;
  const code = _flagLookup.get(countryName.toLowerCase().trim());
  return code ? `https://flagcdn.com/w320/${code}.png` : null;
};

module.exports = {
  getFlagUrl,
  countryCodes,
};
