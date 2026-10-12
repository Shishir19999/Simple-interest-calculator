/* Unit tables. Each unit: U(id, label, factorToBase, ...aliases). Special categories use toBase/fromBase functions. */
import { D } from './expr.js';

const U = (id, label, f, ...aliases) => ({ id, label, f, aliases: [id, label.toLowerCase(), ...aliases].map((s) => s.toLowerCase()) });

export const CATEGORIES = [
  { id: 'length', name: 'Length', base: 'm', units: [
    U('m', 'Metre', 1, 'meter', 'meters', 'metres'), U('km', 'Kilometre', 1000, 'kilometer', 'kilometers', 'kilometres', 'kms'),
    U('cm', 'Centimetre', 0.01, 'centimeter', 'centimeters', 'centimetres'), U('mm', 'Millimetre', 0.001, 'millimeter', 'millimeters', 'millimetres'),
    U('um', 'Micrometre', 1e-6, 'µm', 'micron', 'microns', 'micrometer'), U('nm', 'Nanometre', 1e-9, 'nanometer', 'nanometers'),
    U('mi', 'Mile', 1609.344, 'miles'), U('yd', 'Yard', 0.9144, 'yards'), U('ft', 'Foot', 0.3048, 'feet', 'foot'),
    U('in', 'Inch', 0.0254, 'inches', 'inch'), U('nmi', 'Nautical mile', 1852, 'nautical miles'), U('ly', 'Light year', 9.4607304725808e15, 'light years', 'lightyear', 'light-year'),
  ] },
  { id: 'area', name: 'Area', base: 'm²', units: [
    U('m2', 'Square metre', 1, 'm²', 'sq m', 'sqm', 'square meter', 'square meters', 'square metres'), U('km2', 'Square kilometre', 1e6, 'km²', 'sq km', 'square kilometer', 'square kilometers'),
    U('cm2', 'Square centimetre', 1e-4, 'cm²', 'sq cm', 'square centimeter', 'square centimeters'), U('mm2', 'Square millimetre', 1e-6, 'mm²', 'sq mm'),
    U('ha', 'Hectare', 1e4, 'hectares'), U('acre', 'Acre', 4046.8564224, 'acres'),
    U('ft2', 'Square foot', 0.09290304, 'ft²', 'sq ft', 'sqft', 'square feet'), U('in2', 'Square inch', 6.4516e-4, 'in²', 'sq in', 'square inches'),
    U('yd2', 'Square yard', 0.83612736, 'yd²', 'sq yd', 'square yards'), U('mi2', 'Square mile', 2589988.110336, 'mi²', 'sq mi', 'square miles'),
  ] },
  { id: 'volume', name: 'Volume', base: 'L', units: [
    U('L', 'Litre', 1, 'liter', 'liters', 'litres'), U('mL', 'Millilitre', 0.001, 'milliliter', 'milliliters', 'millilitres', 'cc'),
    U('m3', 'Cubic metre', 1000, 'm³', 'cubic meter', 'cubic meters', 'cubic metres'), U('cm3', 'Cubic centimetre', 0.001, 'cm³', 'cubic centimeter'),
    U('gal', 'US gallon', 3.785411784, 'gallon', 'gallons', 'us gallon', 'us gallons'), U('galuk', 'UK gallon', 4.54609, 'imperial gallon', 'imperial gallons', 'uk gallon'),
    U('qt', 'US quart', 0.946352946, 'quart', 'quarts'), U('pt', 'US pint', 0.473176473, 'pint', 'pints'),
    U('cup', 'US cup', 0.2365882365, 'cups'), U('floz', 'US fluid ounce', 0.0295735295625, 'fl oz', 'fluid ounce', 'fluid ounces'),
    U('tbsp', 'Tablespoon', 0.01478676478125, 'tablespoon', 'tablespoons'), U('tsp', 'Teaspoon', 0.00492892159375, 'teaspoon', 'teaspoons'),
    U('ft3', 'Cubic foot', 28.316846592, 'ft³', 'cubic feet', 'cubic foot', 'cu ft'), U('in3', 'Cubic inch', 0.016387064, 'in³', 'cubic inches', 'cu in'),
  ] },
  { id: 'mass', name: 'Mass', base: 'kg', units: [
    U('kg', 'Kilogram', 1, 'kilogram', 'kilograms', 'kilo', 'kilos', 'kgs'), U('g', 'Gram', 0.001, 'gram', 'grams', 'gm'), U('mg', 'Milligram', 1e-6, 'milligram', 'milligrams'),
    U('ug', 'Microgram', 1e-9, 'µg', 'mcg'), U('t', 'Tonne', 1000, 'tonnes', 'metric ton', 'metric tons'),
    U('lb', 'Pound', 0.45359237, 'lbs', 'pounds'), U('oz', 'Ounce', 0.028349523125, 'ounces'), U('st', 'Stone', 6.35029318, 'stones'),
    U('ct', 'Carat', 0.0002, 'carats'), U('quintal', 'Quintal', 100, 'quintals'),
  ] },
  { id: 'temperature', name: 'Temperature', base: 'K', special: true, units: [
    { id: 'C', label: 'Celsius', aliases: ['c', 'celsius', '°c', 'degc', 'deg c', 'degrees celsius', 'centigrade'], toBase: (x) => x.plus(273.15), fromBase: (x) => x.minus(273.15) },
    { id: 'F', label: 'Fahrenheit', aliases: ['f', 'fahrenheit', '°f', 'degf', 'deg f', 'degrees fahrenheit'], toBase: (x) => x.minus(32).mul(5).div(9).plus(273.15), fromBase: (x) => x.minus(273.15).mul(9).div(5).plus(32) },
    { id: 'K', label: 'Kelvin', aliases: ['k', 'kelvin'], toBase: (x) => x, fromBase: (x) => x },
    { id: 'R', label: 'Rankine', aliases: ['r', 'rankine', '°r'], toBase: (x) => x.mul(5).div(9), fromBase: (x) => x.mul(9).div(5) },
  ] },
  { id: 'speed', name: 'Speed', base: 'm/s', units: [
    U('m/s', 'Metre per second', 1, 'mps', 'meters per second'), U('km/h', 'Kilometre per hour', 1 / 3.6, 'kmh', 'kph', 'kmph', 'km/hr', 'kilometers per hour'),
    U('mph', 'Mile per hour', 0.44704, 'mi/h', 'miles per hour'), U('kn', 'Knot', 1852 / 3600, 'knot', 'knots', 'kt'), U('ft/s', 'Foot per second', 0.3048, 'fps', 'feet per second'),
    U('mach', 'Mach', 340.29), U('c', 'Speed of light', 299792458, 'speed of light'),
  ] },
  { id: 'pressure', name: 'Pressure', base: 'Pa', units: [
    U('Pa', 'Pascal', 1, 'pascals'), U('kPa', 'Kilopascal', 1000, 'kilopascal'), U('MPa', 'Megapascal', 1e6),
    U('bar', 'Bar', 1e5, 'bars'), U('mbar', 'Millibar', 100, 'millibar', 'hpa'), U('atm', 'Atmosphere', 101325, 'atmosphere', 'atmospheres'),
    U('psi', 'PSI', 6894.757293168, 'pounds per square inch'), U('mmHg', 'mmHg', 133.322387415, 'torr'), U('inHg', 'inHg', 3386.389),
  ] },
  { id: 'energy', name: 'Energy', base: 'J', units: [
    U('J', 'Joule', 1, 'joules'), U('kJ', 'Kilojoule', 1000, 'kilojoules'), U('cal', 'Calorie (thermochemical)', 4.184, 'calorie', 'calories'),
    U('kcal', 'Kilocalorie', 4184, 'kilocalories', 'food calorie'), U('Wh', 'Watt hour', 3600, 'watt hour', 'watt hours'),
    U('kWh', 'Kilowatt hour', 3.6e6, 'kilowatt hour', 'kilowatt hours', 'units'), U('BTU', 'BTU', 1055.05585262, 'btus'),
    U('eV', 'Electronvolt', 1.602176634e-19, 'electronvolt'), U('ftlbf', 'Foot-pound', 1.3558179483314, 'ft lbf', 'foot pound', 'ft-lb'), U('therm', 'Therm', 105506000, 'therms'),
  ] },
  { id: 'power', name: 'Power', base: 'W', units: [
    U('W', 'Watt', 1, 'watts'), U('kW', 'Kilowatt', 1000, 'kilowatts'), U('MW', 'Megawatt', 1e6, 'megawatts'),
    U('hp', 'Horsepower (mechanical)', 745.69987158227, 'horsepower', 'bhp'), U('PS', 'Metric horsepower', 735.49875, 'cv'),
    U('BTU/h', 'BTU per hour', 0.29307107017, 'btu/hr'), U('TR', 'Ton of refrigeration', 3516.8528421),
  ] },
  { id: 'time', name: 'Time', base: 's', units: [
    U('s', 'Second', 1, 'sec', 'secs', 'seconds'), U('ms', 'Millisecond', 0.001, 'milliseconds'), U('us', 'Microsecond', 1e-6, 'µs', 'microseconds'),
    U('ns', 'Nanosecond', 1e-9, 'nanoseconds'), U('min', 'Minute', 60, 'mins', 'minutes'), U('h', 'Hour', 3600, 'hr', 'hrs', 'hours'),
    U('d', 'Day', 86400, 'days'), U('wk', 'Week', 604800, 'week', 'weeks', 'wks'), U('mo', 'Month (average)', 2629746, 'months'),
    U('yr', 'Year (365.2425 d)', 31556952, 'year', 'years', 'yrs', 'y'), U('decade', 'Decade', 315569520, 'decades'), U('century', 'Century', 3155695200, 'centuries'),
  ] },
  { id: 'data', name: 'Data size', base: 'B', units: [
    U('bit', 'Bit', 0.125, 'bits'), U('B', 'Byte', 1, 'bytes'), U('KB', 'Kilobyte (1000 B)', 1e3, 'kilobyte', 'kilobytes'), U('MB', 'Megabyte (10^6 B)', 1e6, 'megabyte', 'megabytes'),
    U('GB', 'Gigabyte (10^9 B)', 1e9, 'gigabyte', 'gigabytes'), U('TB', 'Terabyte (10^12 B)', 1e12, 'terabyte', 'terabytes'), U('PB', 'Petabyte', 1e15, 'petabyte'),
    U('KiB', 'Kibibyte (1024 B)', 1024, 'kibibyte'), U('MiB', 'Mebibyte', 1048576, 'mebibyte'), U('GiB', 'Gibibyte', 1073741824, 'gibibyte'), U('TiB', 'Tebibyte', 1099511627776, 'tebibyte'),
    U('Mbit', 'Megabit', 125000, 'megabit', 'megabits'), U('Gbit', 'Gigabit', 125000000, 'gigabit', 'gigabits'),
  ] },
  { id: 'angle', name: 'Angle', base: 'deg', units: [
    U('deg', 'Degree', 1, '°', 'degrees'), U('rad', 'Radian', 180 / Math.PI, 'radians'), U('grad', 'Gradian', 0.9, 'gon', 'gradians'),
    U('arcmin', 'Arcminute', 1 / 60, 'arcminutes'), U('arcsec', 'Arcsecond', 1 / 3600, 'arcseconds'), U('turn', 'Turn', 360, 'turns', 'revolution', 'revolutions'),
  ] },
  { id: 'fuel', name: 'Fuel economy', base: 'L/100km', special: true, units: [
    { id: 'L/100km', label: 'Litres per 100 km', aliases: ['l/100km', 'l/100 km', 'lp100km'], toBase: (x) => x, fromBase: (x) => x },
    { id: 'km/L', label: 'Kilometres per litre', aliases: ['km/l', 'kmpl', 'kpl'], toBase: (x) => new D(100).div(x), fromBase: (x) => new D(100).div(x) },
    { id: 'mpg', label: 'Miles per US gallon', aliases: ['mpg', 'mpg us', 'miles per gallon'], toBase: (x) => new D('235.214583333').div(x), fromBase: (x) => new D('235.214583333').div(x) },
    { id: 'mpguk', label: 'Miles per UK gallon', aliases: ['mpg uk', 'mpguk'], toBase: (x) => new D('282.480936331').div(x), fromBase: (x) => new D('282.480936331').div(x) },
  ] },
  { id: 'force', name: 'Force', base: 'N', units: [
    U('N', 'Newton', 1, 'newtons'), U('kN', 'Kilonewton', 1000, 'kilonewton'), U('lbf', 'Pound-force', 4.4482216152605, 'pound force'),
    U('kgf', 'Kilogram-force', 9.80665, 'kilogram force'), U('dyn', 'Dyne', 1e-5, 'dyne'),
  ] },
  { id: 'frequency', name: 'Frequency', base: 'Hz', units: [
    U('Hz', 'Hertz', 1), U('kHz', 'Kilohertz', 1e3), U('MHz', 'Megahertz', 1e6), U('GHz', 'Gigahertz', 1e9), U('rpm', 'Revolutions per minute', 1 / 60, 'rev/min'),
  ] },
  { id: 'cooking', name: 'Cooking', base: 'mL', units: [
    U('cup', 'US cup', 236.5882365, 'cups', 'us cup'), U('cupm', 'Metric cup (250 mL)', 250, 'metric cup'), U('cupuk', 'UK cup (284 mL)', 284.130625, 'uk cup'),
    U('tbsp', 'Tablespoon (US)', 14.78676478125, 'tablespoon', 'tablespoons', 'tbs'), U('tbspm', 'Tablespoon (metric 15 mL)', 15, 'metric tablespoon'),
    U('tsp', 'Teaspoon (US)', 4.92892159375, 'teaspoon', 'teaspoons'), U('mL', 'Millilitre', 1, 'milliliter', 'milliliters'), U('L', 'Litre', 1000, 'liter', 'liters', 'litres'),
    U('floz', 'US fluid ounce', 29.5735295625, 'fl oz', 'fluid ounce'), U('pt', 'US pint', 473.176473, 'pint', 'pints'), U('qt', 'US quart', 946.352946, 'quart', 'quarts'),
    U('gal', 'US gallon', 3785.411784, 'gallon', 'gallons'), U('dash', 'Dash (approx. 0.6 mL)', 0.616), U('pinch', 'Pinch (approx. 0.3 mL)', 0.308),
  ] },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));
export const getCategory = (id) => byId.get(id);

/** Convert a number/Decimal/string between two units of the same category. Returns a Decimal. */
export function convert(catId, value, fromId, toId) {
  const cat = byId.get(catId);
  if (!cat) throw new Error('Unknown category');
  const from = cat.units.find((u) => u.id === fromId);
  const to = cat.units.find((u) => u.id === toId);
  if (!from || !to) throw new Error('Unknown unit');
  const x = new D(value);
  if (cat.special) {
    if (catId === 'fuel' && x.lte(0)) throw new Error('Fuel economy must be above zero');
    return to.fromBase(from.toBase(x));
  }
  return x.mul(String(from.f)).div(String(to.f));
}

// Alias lookup for natural-language conversion ("5 km to miles"). Cooking is excluded so the general units win.
const aliasMap = new Map();
for (const cat of CATEGORIES) {
  if (cat.id === 'cooking') continue;
  for (const u of cat.units) for (const a of u.aliases) if (!aliasMap.has(a)) aliasMap.set(a, { cat: cat.id, unit: u.id, label: u.label });
}
const setAlias = (a, cat, unit, label) => aliasMap.set(a, { cat, unit, label });
setAlias('m', 'length', 'm', 'Metre'); setAlias('c', 'temperature', 'C', 'Celsius'); setAlias('f', 'temperature', 'F', 'Fahrenheit');
setAlias('k', 'temperature', 'K', 'Kelvin'); setAlias('t', 'mass', 't', 'Tonne'); setAlias('d', 'time', 'd', 'Day');
setAlias('"', 'length', 'in', 'Inch'); setAlias("'", 'length', 'ft', 'Foot'); setAlias('l', 'volume', 'L', 'Litre');
setAlias('gb', 'data', 'GB', 'Gigabyte'); setAlias('mb', 'data', 'MB', 'Megabyte'); setAlias('kb', 'data', 'KB', 'Kilobyte'); setAlias('tb', 'data', 'TB', 'Terabyte');
setAlias('hz', 'frequency', 'Hz', 'Hertz'); setAlias('w', 'power', 'W', 'Watt'); setAlias('j', 'energy', 'J', 'Joule'); setAlias('n', 'force', 'N', 'Newton');
setAlias('pa', 'pressure', 'Pa', 'Pascal'); setAlias('kw', 'power', 'kW', 'Kilowatt'); setAlias('kwh', 'energy', 'kWh', 'Kilowatt hour'); setAlias('ml', 'volume', 'mL', 'Millilitre');

export function findUnit(text) {
  return aliasMap.get(String(text).trim().toLowerCase().replace(/\s+/g, ' ')) || null;
}
export function registerCurrencies(codes) {
  for (const c of codes) aliasMap.set(c.toLowerCase(), { cat: 'currency', unit: c, label: c });
}
