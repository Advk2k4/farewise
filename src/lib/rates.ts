// Rough default travel prices per country, in local currency.
//   taxi: [flag fall, per km, per minute] for a metered taxi or standard ride-hail car
//   fare: a typical single public-transport ride; fuel: petrol per litre
// Ballpark 2025–26 big-city figures, only meant to rank options sensibly. Every value is editable in Settings.

// auto: [flag fall for the first 1.5 km, per km after] where auto-rickshaws / tuk-tuks are a normal option
export type Country = { name: string; cur: string; taxi: [number, number, number]; fare: number; fuel: number; auto?: [number, number] }
export type Rates = { cur: string; taxiBase: number; taxiKm: number; taxiMin: number; fare: number; fuel: number; lper100: number; autoBase?: number; autoKm?: number }

export const COUNTRIES: Record<string, Country> = {
  US:{name:'United States', cur:'USD', taxi:[3.0, 1.7, 0.40], fare:2.9, fuel:0.95},
  CA:{name:'Canada', cur:'CAD', taxi:[4.0, 1.9, 0.50], fare:3.35, fuel:1.60},
  MX:{name:'Mexico', cur:'MXN', taxi:[30, 10, 2.0], fare:5, fuel:24},
  BR:{name:'Brazil', cur:'BRL', taxi:[5.5, 3.0, 0.40], fare:5, fuel:6.1},
  AR:{name:'Argentina', cur:'ARS', taxi:[1500, 1200, 150], fare:700, fuel:1400},
  CL:{name:'Chile', cur:'CLP', taxi:[450, 850, 170], fare:800, fuel:1250},
  CO:{name:'Colombia', cur:'COP', taxi:[5500, 1500, 300], fare:3200, fuel:15000},
  PE:{name:'Peru', cur:'PEN', taxi:[5, 2.0, 0.50], fare:2, fuel:6.5},
  GB:{name:'United Kingdom', cur:'GBP', taxi:[3.8, 2.0, 0.35], fare:2.8, fuel:1.40},
  IE:{name:'Ireland', cur:'EUR', taxi:[4.4, 1.3, 0.40], fare:2.0, fuel:1.75},
  FR:{name:'France', cur:'EUR', taxi:[4.2, 1.3, 0.50], fare:2.15, fuel:1.80},
  DE:{name:'Germany', cur:'EUR', taxi:[4.3, 2.2, 0.50], fare:3.5, fuel:1.75},
  ES:{name:'Spain', cur:'EUR', taxi:[2.6, 1.3, 0.35], fare:1.5, fuel:1.55},
  IT:{name:'Italy', cur:'EUR', taxi:[4.0, 1.4, 0.50], fare:2.2, fuel:1.80},
  PT:{name:'Portugal', cur:'EUR', taxi:[3.25, 0.9, 0.25], fare:1.85, fuel:1.75},
  NL:{name:'Netherlands', cur:'EUR', taxi:[4.3, 2.3, 0.40], fare:3.4, fuel:2.00},
  BE:{name:'Belgium', cur:'EUR', taxi:[2.95, 2.0, 0.50], fare:2.6, fuel:1.75},
  AT:{name:'Austria', cur:'EUR', taxi:[4.5, 1.8, 0.60], fare:2.4, fuel:1.60},
  CH:{name:'Switzerland', cur:'CHF', taxi:[6.5, 3.8, 1.00], fare:3.0, fuel:1.85},
  SE:{name:'Sweden', cur:'SEK', taxi:[50, 15, 7], fare:42, fuel:18},
  NO:{name:'Norway', cur:'NOK', taxi:[70, 17, 8], fare:45, fuel:21},
  DK:{name:'Denmark', cur:'DKK', taxi:[39, 12, 6], fare:24, fuel:14},
  FI:{name:'Finland', cur:'EUR', taxi:[5.9, 1.6, 0.80], fare:3.2, fuel:1.85},
  PL:{name:'Poland', cur:'PLN', taxi:[9, 3.5, 1.0], fare:4.4, fuel:6.3},
  CZ:{name:'Czechia', cur:'CZK', taxi:[60, 36, 7], fare:30, fuel:38},
  GR:{name:'Greece', cur:'EUR', taxi:[4.0, 0.9, 0.20], fare:1.2, fuel:1.90},
  TR:{name:'Türkiye', cur:'TRY', taxi:[60, 40, 10], fare:27, fuel:46},
  IL:{name:'Israel', cur:'ILS', taxi:[15, 2.0, 0.60], fare:6, fuel:7.3},
  AE:{name:'United Arab Emirates', cur:'AED', taxi:[12, 2.2, 0.50], fare:5, fuel:2.9},
  SA:{name:'Saudi Arabia', cur:'SAR', taxi:[10, 2.1, 0.50], fare:4, fuel:2.33},
  EG:{name:'Egypt', cur:'EGP', taxi:[15, 6, 1.0], fare:10, fuel:17},
  ZA:{name:'South Africa', cur:'ZAR', taxi:[10, 9, 1.0], fare:15, fuel:22},
  KE:{name:'Kenya', cur:'KES', taxi:[150, 50, 4], fare:100, fuel:180},
  NG:{name:'Nigeria', cur:'NGN', taxi:[700, 350, 40], fare:500, fuel:900},
  IN:{name:'India', cur:'INR', taxi:[50, 18, 1.5], fare:30, fuel:105, auto:[30, 16]},
  PK:{name:'Pakistan', cur:'PKR', taxi:[150, 60, 5], fare:60, fuel:270, auto:[120, 45]},
  BD:{name:'Bangladesh', cur:'BDT', taxi:[60, 30, 2], fare:30, fuel:125, auto:[60, 25]},
  SG:{name:'Singapore', cur:'SGD', taxi:[4.4, 0.65, 0.35], fare:1.6, fuel:2.8},
  MY:{name:'Malaysia', cur:'MYR', taxi:[4, 1.25, 0.30], fare:2.5, fuel:2.05},
  TH:{name:'Thailand', cur:'THB', taxi:[35, 7, 2], fare:30, fuel:35, auto:[60, 20]},
  ID:{name:'Indonesia', cur:'IDR', taxi:[7500, 4500, 600], fare:4000, fuel:13000},
  PH:{name:'Philippines', cur:'PHP', taxi:[50, 15, 2], fare:20, fuel:62},
  VN:{name:'Vietnam', cur:'VND', taxi:[12000, 16000, 500], fare:7000, fuel:22000},
  CN:{name:'China', cur:'CNY', taxi:[13, 2.5, 0.50], fare:3, fuel:7.8},
  HK:{name:'Hong Kong', cur:'HKD', taxi:[29, 9.5, 1.9], fare:10, fuel:22},
  TW:{name:'Taiwan', cur:'TWD', taxi:[85, 20, 5], fare:25, fuel:30},
  JP:{name:'Japan', cur:'JPY', taxi:[500, 390, 50], fare:210, fuel:175},
  KR:{name:'South Korea', cur:'KRW', taxi:[4800, 760, 160], fare:1500, fuel:1650},
  AU:{name:'Australia', cur:'AUD', taxi:[4.2, 2.3, 0.90], fare:4.5, fuel:1.95},
  NZ:{name:'New Zealand', cur:'NZD', taxi:[3.5, 3.0, 0.90], fare:3.0, fuel:2.6}
}


export const FALLBACK_COUNTRY = 'US'
export function defaultRates(cc?: string | null): Rates {
  const c = COUNTRIES[cc ?? ''] ?? COUNTRIES[FALLBACK_COUNTRY]
  return { cur: c.cur, taxiBase: c.taxi[0], taxiKm: c.taxi[1], taxiMin: c.taxi[2], fare: c.fare, fuel: c.fuel, lper100: 7.5, ...(c.auto ? { autoBase: c.auto[0], autoKm: c.auto[1] } : {}) }
}
export const countryName = (cc?: string | null) => (cc && COUNTRIES[cc]?.name) || cc || 'Unknown'
