// Shared choices for profile customization. All stored profile text is rendered as text, never HTML.
export const PROFILE_CUSTOMIZATION_DEFAULTS = Object.freeze({
  "display_name": "",
  "country_code": "",
  "clan_name": "",
  "clan_tag": "",
  "clan_role": "Member",
  "profile_title": "",
  "tagline": "",
  "status": "",
  "bio": "",
  "main_gamemode": "All-around",
  "favorite_level": "",
  "accent_color": "#a855f7",
  "banner_style": "aurora",
  "profile_theme": "midnight",
  "border_style": "glow",
  "website_url": "",
  "show_nationality": false,
  "show_clan": true,
  "show_title": true,
  "show_tagline": true,
  "show_status": true,
  "show_bio": true,
  "show_gamemode": true,
  "show_favorite_level": false,
  "show_website": false
});

export const COUNTRY_OPTIONS = [
  {
    "value": "",
    "label": "Prefer not to say"
  },
  {
    "value": "AF",
    "label": "Afghanistan"
  },
  {
    "value": "AL",
    "label": "Albania"
  },
  {
    "value": "DZ",
    "label": "Algeria"
  },
  {
    "value": "AS",
    "label": "American Samoa"
  },
  {
    "value": "AD",
    "label": "Andorra"
  },
  {
    "value": "AO",
    "label": "Angola"
  },
  {
    "value": "AI",
    "label": "Anguilla"
  },
  {
    "value": "AQ",
    "label": "Antarctica"
  },
  {
    "value": "AG",
    "label": "Antigua and Barbuda"
  },
  {
    "value": "AR",
    "label": "Argentina"
  },
  {
    "value": "AM",
    "label": "Armenia"
  },
  {
    "value": "AW",
    "label": "Aruba"
  },
  {
    "value": "AU",
    "label": "Australia"
  },
  {
    "value": "AT",
    "label": "Austria"
  },
  {
    "value": "AZ",
    "label": "Azerbaijan"
  },
  {
    "value": "BS",
    "label": "Bahamas"
  },
  {
    "value": "BH",
    "label": "Bahrain"
  },
  {
    "value": "BD",
    "label": "Bangladesh"
  },
  {
    "value": "BB",
    "label": "Barbados"
  },
  {
    "value": "BY",
    "label": "Belarus"
  },
  {
    "value": "BE",
    "label": "Belgium"
  },
  {
    "value": "BZ",
    "label": "Belize"
  },
  {
    "value": "BJ",
    "label": "Benin"
  },
  {
    "value": "BM",
    "label": "Bermuda"
  },
  {
    "value": "BT",
    "label": "Bhutan"
  },
  {
    "value": "BO",
    "label": "Bolivia, Plurinational State of"
  },
  {
    "value": "BQ",
    "label": "Bonaire, Sint Eustatius and Saba"
  },
  {
    "value": "BA",
    "label": "Bosnia and Herzegovina"
  },
  {
    "value": "BW",
    "label": "Botswana"
  },
  {
    "value": "BV",
    "label": "Bouvet Island"
  },
  {
    "value": "BR",
    "label": "Brazil"
  },
  {
    "value": "IO",
    "label": "British Indian Ocean Territory"
  },
  {
    "value": "BN",
    "label": "Brunei Darussalam"
  },
  {
    "value": "BG",
    "label": "Bulgaria"
  },
  {
    "value": "BF",
    "label": "Burkina Faso"
  },
  {
    "value": "BI",
    "label": "Burundi"
  },
  {
    "value": "CV",
    "label": "Cabo Verde"
  },
  {
    "value": "KH",
    "label": "Cambodia"
  },
  {
    "value": "CM",
    "label": "Cameroon"
  },
  {
    "value": "CA",
    "label": "Canada"
  },
  {
    "value": "KY",
    "label": "Cayman Islands"
  },
  {
    "value": "CF",
    "label": "Central African Republic"
  },
  {
    "value": "TD",
    "label": "Chad"
  },
  {
    "value": "CL",
    "label": "Chile"
  },
  {
    "value": "CN",
    "label": "China"
  },
  {
    "value": "CX",
    "label": "Christmas Island"
  },
  {
    "value": "CC",
    "label": "Cocos (Keeling) Islands"
  },
  {
    "value": "CO",
    "label": "Colombia"
  },
  {
    "value": "KM",
    "label": "Comoros"
  },
  {
    "value": "CG",
    "label": "Congo"
  },
  {
    "value": "CD",
    "label": "Congo, The Democratic Republic of the"
  },
  {
    "value": "CK",
    "label": "Cook Islands"
  },
  {
    "value": "CR",
    "label": "Costa Rica"
  },
  {
    "value": "HR",
    "label": "Croatia"
  },
  {
    "value": "CU",
    "label": "Cuba"
  },
  {
    "value": "CW",
    "label": "Curaçao"
  },
  {
    "value": "CY",
    "label": "Cyprus"
  },
  {
    "value": "CZ",
    "label": "Czechia"
  },
  {
    "value": "CI",
    "label": "Côte d’Ivoire"
  },
  {
    "value": "DK",
    "label": "Denmark"
  },
  {
    "value": "DJ",
    "label": "Djibouti"
  },
  {
    "value": "DM",
    "label": "Dominica"
  },
  {
    "value": "DO",
    "label": "Dominican Republic"
  },
  {
    "value": "EC",
    "label": "Ecuador"
  },
  {
    "value": "EG",
    "label": "Egypt"
  },
  {
    "value": "SV",
    "label": "El Salvador"
  },
  {
    "value": "GQ",
    "label": "Equatorial Guinea"
  },
  {
    "value": "ER",
    "label": "Eritrea"
  },
  {
    "value": "EE",
    "label": "Estonia"
  },
  {
    "value": "SZ",
    "label": "Eswatini"
  },
  {
    "value": "ET",
    "label": "Ethiopia"
  },
  {
    "value": "FK",
    "label": "Falkland Islands (Malvinas)"
  },
  {
    "value": "FO",
    "label": "Faroe Islands"
  },
  {
    "value": "FJ",
    "label": "Fiji"
  },
  {
    "value": "FI",
    "label": "Finland"
  },
  {
    "value": "FR",
    "label": "France"
  },
  {
    "value": "GF",
    "label": "French Guiana"
  },
  {
    "value": "PF",
    "label": "French Polynesia"
  },
  {
    "value": "TF",
    "label": "French Southern Territories"
  },
  {
    "value": "GA",
    "label": "Gabon"
  },
  {
    "value": "GM",
    "label": "Gambia"
  },
  {
    "value": "GE",
    "label": "Georgia"
  },
  {
    "value": "DE",
    "label": "Germany"
  },
  {
    "value": "GH",
    "label": "Ghana"
  },
  {
    "value": "GI",
    "label": "Gibraltar"
  },
  {
    "value": "GR",
    "label": "Greece"
  },
  {
    "value": "GL",
    "label": "Greenland"
  },
  {
    "value": "GD",
    "label": "Grenada"
  },
  {
    "value": "GP",
    "label": "Guadeloupe"
  },
  {
    "value": "GU",
    "label": "Guam"
  },
  {
    "value": "GT",
    "label": "Guatemala"
  },
  {
    "value": "GG",
    "label": "Guernsey"
  },
  {
    "value": "GN",
    "label": "Guinea"
  },
  {
    "value": "GW",
    "label": "Guinea-Bissau"
  },
  {
    "value": "GY",
    "label": "Guyana"
  },
  {
    "value": "HT",
    "label": "Haiti"
  },
  {
    "value": "HM",
    "label": "Heard Island and McDonald Islands"
  },
  {
    "value": "VA",
    "label": "Holy See (Vatican City State)"
  },
  {
    "value": "HN",
    "label": "Honduras"
  },
  {
    "value": "HK",
    "label": "Hong Kong"
  },
  {
    "value": "HU",
    "label": "Hungary"
  },
  {
    "value": "IS",
    "label": "Iceland"
  },
  {
    "value": "IN",
    "label": "India"
  },
  {
    "value": "ID",
    "label": "Indonesia"
  },
  {
    "value": "IR",
    "label": "Iran, Islamic Republic of"
  },
  {
    "value": "IQ",
    "label": "Iraq"
  },
  {
    "value": "IE",
    "label": "Ireland"
  },
  {
    "value": "IM",
    "label": "Isle of Man"
  },
  {
    "value": "IL",
    "label": "Israel"
  },
  {
    "value": "IT",
    "label": "Italy"
  },
  {
    "value": "JM",
    "label": "Jamaica"
  },
  {
    "value": "JP",
    "label": "Japan"
  },
  {
    "value": "JE",
    "label": "Jersey"
  },
  {
    "value": "JO",
    "label": "Jordan"
  },
  {
    "value": "KZ",
    "label": "Kazakhstan"
  },
  {
    "value": "KE",
    "label": "Kenya"
  },
  {
    "value": "KI",
    "label": "Kiribati"
  },
  {
    "value": "KP",
    "label": "North Korea"
  },
  {
    "value": "KR",
    "label": "South Korea"
  },
  {
    "value": "KW",
    "label": "Kuwait"
  },
  {
    "value": "KG",
    "label": "Kyrgyzstan"
  },
  {
    "value": "LA",
    "label": "Lao People's Democratic Republic"
  },
  {
    "value": "LV",
    "label": "Latvia"
  },
  {
    "value": "LB",
    "label": "Lebanon"
  },
  {
    "value": "LS",
    "label": "Lesotho"
  },
  {
    "value": "LR",
    "label": "Liberia"
  },
  {
    "value": "LY",
    "label": "Libya"
  },
  {
    "value": "LI",
    "label": "Liechtenstein"
  },
  {
    "value": "LT",
    "label": "Lithuania"
  },
  {
    "value": "LU",
    "label": "Luxembourg"
  },
  {
    "value": "MO",
    "label": "Macao"
  },
  {
    "value": "MG",
    "label": "Madagascar"
  },
  {
    "value": "MW",
    "label": "Malawi"
  },
  {
    "value": "MY",
    "label": "Malaysia"
  },
  {
    "value": "MV",
    "label": "Maldives"
  },
  {
    "value": "ML",
    "label": "Mali"
  },
  {
    "value": "MT",
    "label": "Malta"
  },
  {
    "value": "MH",
    "label": "Marshall Islands"
  },
  {
    "value": "MQ",
    "label": "Martinique"
  },
  {
    "value": "MR",
    "label": "Mauritania"
  },
  {
    "value": "MU",
    "label": "Mauritius"
  },
  {
    "value": "YT",
    "label": "Mayotte"
  },
  {
    "value": "MX",
    "label": "Mexico"
  },
  {
    "value": "FM",
    "label": "Micronesia, Federated States of"
  },
  {
    "value": "MD",
    "label": "Moldova, Republic of"
  },
  {
    "value": "MC",
    "label": "Monaco"
  },
  {
    "value": "MN",
    "label": "Mongolia"
  },
  {
    "value": "ME",
    "label": "Montenegro"
  },
  {
    "value": "MS",
    "label": "Montserrat"
  },
  {
    "value": "MA",
    "label": "Morocco"
  },
  {
    "value": "MZ",
    "label": "Mozambique"
  },
  {
    "value": "MM",
    "label": "Myanmar"
  },
  {
    "value": "NA",
    "label": "Namibia"
  },
  {
    "value": "NR",
    "label": "Nauru"
  },
  {
    "value": "NP",
    "label": "Nepal"
  },
  {
    "value": "NL",
    "label": "Netherlands"
  },
  {
    "value": "NC",
    "label": "New Caledonia"
  },
  {
    "value": "NZ",
    "label": "New Zealand"
  },
  {
    "value": "NI",
    "label": "Nicaragua"
  },
  {
    "value": "NE",
    "label": "Niger"
  },
  {
    "value": "NG",
    "label": "Nigeria"
  },
  {
    "value": "NU",
    "label": "Niue"
  },
  {
    "value": "NF",
    "label": "Norfolk Island"
  },
  {
    "value": "MK",
    "label": "North Macedonia"
  },
  {
    "value": "MP",
    "label": "Northern Mariana Islands"
  },
  {
    "value": "NO",
    "label": "Norway"
  },
  {
    "value": "OM",
    "label": "Oman"
  },
  {
    "value": "PK",
    "label": "Pakistan"
  },
  {
    "value": "PW",
    "label": "Palau"
  },
  {
    "value": "PS",
    "label": "Palestine, State of"
  },
  {
    "value": "PA",
    "label": "Panama"
  },
  {
    "value": "PG",
    "label": "Papua New Guinea"
  },
  {
    "value": "PY",
    "label": "Paraguay"
  },
  {
    "value": "PE",
    "label": "Peru"
  },
  {
    "value": "PH",
    "label": "Philippines"
  },
  {
    "value": "PN",
    "label": "Pitcairn"
  },
  {
    "value": "PL",
    "label": "Poland"
  },
  {
    "value": "PT",
    "label": "Portugal"
  },
  {
    "value": "PR",
    "label": "Puerto Rico"
  },
  {
    "value": "QA",
    "label": "Qatar"
  },
  {
    "value": "RO",
    "label": "Romania"
  },
  {
    "value": "RU",
    "label": "Russian Federation"
  },
  {
    "value": "RW",
    "label": "Rwanda"
  },
  {
    "value": "RE",
    "label": "Réunion"
  },
  {
    "value": "BL",
    "label": "Saint Barthélemy"
  },
  {
    "value": "SH",
    "label": "Saint Helena, Ascension and Tristan da Cunha"
  },
  {
    "value": "KN",
    "label": "Saint Kitts and Nevis"
  },
  {
    "value": "LC",
    "label": "Saint Lucia"
  },
  {
    "value": "MF",
    "label": "Saint Martin (French part)"
  },
  {
    "value": "PM",
    "label": "Saint Pierre and Miquelon"
  },
  {
    "value": "VC",
    "label": "Saint Vincent and the Grenadines"
  },
  {
    "value": "WS",
    "label": "Samoa"
  },
  {
    "value": "SM",
    "label": "San Marino"
  },
  {
    "value": "ST",
    "label": "Sao Tome and Principe"
  },
  {
    "value": "SA",
    "label": "Saudi Arabia"
  },
  {
    "value": "SN",
    "label": "Senegal"
  },
  {
    "value": "RS",
    "label": "Serbia"
  },
  {
    "value": "SC",
    "label": "Seychelles"
  },
  {
    "value": "SL",
    "label": "Sierra Leone"
  },
  {
    "value": "SG",
    "label": "Singapore"
  },
  {
    "value": "SX",
    "label": "Sint Maarten (Dutch part)"
  },
  {
    "value": "SK",
    "label": "Slovakia"
  },
  {
    "value": "SI",
    "label": "Slovenia"
  },
  {
    "value": "SB",
    "label": "Solomon Islands"
  },
  {
    "value": "SO",
    "label": "Somalia"
  },
  {
    "value": "ZA",
    "label": "South Africa"
  },
  {
    "value": "GS",
    "label": "South Georgia and the South Sandwich Islands"
  },
  {
    "value": "SS",
    "label": "South Sudan"
  },
  {
    "value": "ES",
    "label": "Spain"
  },
  {
    "value": "LK",
    "label": "Sri Lanka"
  },
  {
    "value": "SD",
    "label": "Sudan"
  },
  {
    "value": "SR",
    "label": "Suriname"
  },
  {
    "value": "SJ",
    "label": "Svalbard and Jan Mayen"
  },
  {
    "value": "SE",
    "label": "Sweden"
  },
  {
    "value": "CH",
    "label": "Switzerland"
  },
  {
    "value": "SY",
    "label": "Syrian Arab Republic"
  },
  {
    "value": "TW",
    "label": "Taiwan"
  },
  {
    "value": "TJ",
    "label": "Tajikistan"
  },
  {
    "value": "TZ",
    "label": "Tanzania, United Republic of"
  },
  {
    "value": "TH",
    "label": "Thailand"
  },
  {
    "value": "TL",
    "label": "Timor-Leste"
  },
  {
    "value": "TG",
    "label": "Togo"
  },
  {
    "value": "TK",
    "label": "Tokelau"
  },
  {
    "value": "TO",
    "label": "Tonga"
  },
  {
    "value": "TT",
    "label": "Trinidad and Tobago"
  },
  {
    "value": "TN",
    "label": "Tunisia"
  },
  {
    "value": "TM",
    "label": "Turkmenistan"
  },
  {
    "value": "TC",
    "label": "Turks and Caicos Islands"
  },
  {
    "value": "TV",
    "label": "Tuvalu"
  },
  {
    "value": "TR",
    "label": "Türkiye"
  },
  {
    "value": "UG",
    "label": "Uganda"
  },
  {
    "value": "UA",
    "label": "Ukraine"
  },
  {
    "value": "AE",
    "label": "United Arab Emirates"
  },
  {
    "value": "GB",
    "label": "United Kingdom"
  },
  {
    "value": "US",
    "label": "United States"
  },
  {
    "value": "UM",
    "label": "United States Minor Outlying Islands"
  },
  {
    "value": "UY",
    "label": "Uruguay"
  },
  {
    "value": "UZ",
    "label": "Uzbekistan"
  },
  {
    "value": "VU",
    "label": "Vanuatu"
  },
  {
    "value": "VE",
    "label": "Venezuela, Bolivarian Republic of"
  },
  {
    "value": "VN",
    "label": "Viet Nam"
  },
  {
    "value": "VG",
    "label": "Virgin Islands, British"
  },
  {
    "value": "VI",
    "label": "Virgin Islands, U.S."
  },
  {
    "value": "WF",
    "label": "Wallis and Futuna"
  },
  {
    "value": "EH",
    "label": "Western Sahara"
  },
  {
    "value": "YE",
    "label": "Yemen"
  },
  {
    "value": "ZM",
    "label": "Zambia"
  },
  {
    "value": "ZW",
    "label": "Zimbabwe"
  },
  {
    "value": "AX",
    "label": "Åland Islands"
  }
];

const COUNTRY_NAMES = new Map(COUNTRY_OPTIONS.map(country => [country.value, country.label]));

export function countryName(code) {
    return COUNTRY_NAMES.get(String(code || '').toUpperCase()) || '';
}

export function countryFlag(code) {
    const value = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(value)) return '';
    return String.fromCodePoint(...[...value].map(char => 127397 + char.charCodeAt(0)));
}

export const ACCENT_OPTIONS = [
    { value: '#a855f7', label: 'Amethyst' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#3b82f6', label: 'Cobalt' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#22c55e', label: 'Emerald' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#eab308', label: 'Gold' },
    { value: '#f97316', label: 'Orange' },
    { value: '#ef4444', label: 'Ruby' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#f43f5e', label: 'Rose' },
    { value: '#e2e8f0', label: 'Silver' },
    { value: '#94a3b8', label: 'Slate' }
];

export const BANNER_OPTIONS = [
    { value: 'aurora', label: 'Aurora' },
    { value: 'nebula', label: 'Nebula' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'sunset', label: 'Sunset' },
    { value: 'forest', label: 'Forest' },
    { value: 'grid', label: 'Cyber grid' },
    { value: 'prism', label: 'Prism' },
    { value: 'monochrome', label: 'Monochrome' }
];

export const THEME_OPTIONS = [
    { value: 'midnight', label: 'Midnight' },
    { value: 'obsidian', label: 'Obsidian' },
    { value: 'arcade', label: 'Arcade' },
    { value: 'dawn', label: 'Dawn' },
    { value: 'deep-sea', label: 'Deep sea' }
];

export const BORDER_OPTIONS = [
    { value: 'glow', label: 'Accent glow' },
    { value: 'soft', label: 'Soft' },
    { value: 'solid', label: 'Solid' },
    { value: 'double', label: 'Double' },
    { value: 'dashed', label: 'Dashed' }
];

export const GAMEMODE_OPTIONS = [
    { value: 'All-around', label: 'All-around' },
    { value: 'Wave', label: 'Wave' },
    { value: 'Ship', label: 'Ship' },
    { value: 'Cube', label: 'Cube' },
    { value: 'Robot', label: 'Robot' },
    { value: 'Ball', label: 'Ball' },
    { value: 'UFO', label: 'UFO' },
    { value: 'Spider', label: 'Spider' },
    { value: 'Swing', label: 'Swing' }
];

export const CLAN_ROLE_OPTIONS = [
    { value: 'Leader', label: 'Leader' },
    { value: 'Co-leader', label: 'Co-leader' },
    { value: 'Officer', label: 'Officer' },
    { value: 'Member', label: 'Member' },
    { value: 'Recruit', label: 'Recruit' }
];
