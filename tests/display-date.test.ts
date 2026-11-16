import test from 'node:test';import assert from 'node:assert/strict';
import {formatDisplayDate,parseDisplayDate} from '../lib/display-date.ts';
test('dd/mm/yyyy',()=>{assert.equal(formatDisplayDate('2026-11-05'),'05/11/2026');assert.equal(formatDisplayDate('2026-11-05 10:00:00'),'05/11/2026');assert.equal(parseDisplayDate('5/11/2026'),'2026-11-05');assert.equal(parseDisplayDate('31/02/2026'),null);assert.equal(parseDisplayDate(''),'');});
