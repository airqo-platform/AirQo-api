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

const getFlagUrl = (countryName) => {
  if (!countryName) {
    return null;
  }
  const lowerCountryName = countryName.toLowerCase().trim();
  const countryEntry = Object.entries(countryCodes).find(
    ([key, value]) => key.toLowerCase() === lowerCountryName
  );
  if (countryEntry) {
    const code = countryEntry[1];
    return `https://flagcdn.com/w320/${code.toLowerCase()}.png`;
  }
  return null;
};

module.exports = {
  getFlagUrl,
  countryCodes,
};
