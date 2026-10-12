import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, findUnit, CATEGORIES } from '../src/lib/units.js';

const near = (d, v, eps = 1e-6) => assert.ok(Math.abs(d.toNumber() - v) <= eps * Math.max(1, Math.abs(v)), `${d} vs ${v}`);

test('length', () => { near(convert('length', 1, 'mi', 'km'), 1.609344); near(convert('length', 12, 'in', 'ft'), 1); near(convert('length', 5, 'km', 'mi'), 3.1068559611867); });
test('temperature', () => {
  near(convert('temperature', 100, 'C', 'F'), 212); near(convert('temperature', 32, 'F', 'C'), 0);
  near(convert('temperature', 0, 'K', 'C'), -273.15); near(convert('temperature', -40, 'C', 'F'), -40);
});
test('mass, volume, area', () => {
  near(convert('mass', 1, 'kg', 'lb'), 2.2046226218); near(convert('volume', 1, 'gal', 'L'), 3.785411784);
  near(convert('area', 1, 'acre', 'm2'), 4046.8564224); near(convert('area', 1, 'ha', 'acre'), 2.4710538147);
});
test('speed, pressure, energy, power', () => {
  near(convert('speed', 100, 'km/h', 'mph'), 62.137119224); near(convert('pressure', 1, 'atm', 'psi'), 14.695948775);
  near(convert('energy', 1, 'kWh', 'kcal'), 860.4206500956); near(convert('power', 1, 'hp', 'kW'), 0.74569987158);
});
test('data uses decimal and binary prefixes', () => {
  near(convert('data', 1, 'GB', 'MB'), 1000); near(convert('data', 1, 'GiB', 'MiB'), 1024); near(convert('data', 8, 'bit', 'B'), 1);
});
test('fuel economy', () => {
  near(convert('fuel', 30, 'mpg', 'L/100km'), 7.8404861, 1e-6); near(convert('fuel', 10, 'km/L', 'L/100km'), 10);
  assert.throws(() => convert('fuel', 0, 'mpg', 'km/L'));
});
test('round trip every category', () => {
  for (const c of CATEGORIES) for (const a of c.units) for (const b of c.units) {
    near(convert(c.id, convert(c.id, 7.5, a.id, b.id), b.id, a.id), 7.5, 1e-9);
  }
});
test('alias lookup', () => {
  assert.equal(findUnit('km').cat, 'length'); assert.equal(findUnit('Miles').unit, 'mi'); assert.equal(findUnit('f').cat, 'temperature'); assert.equal(findUnit('nonsense'), null);
});
