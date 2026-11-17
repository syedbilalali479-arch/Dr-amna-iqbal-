import test from 'node:test';import assert from 'node:assert/strict';
import {formatDisplayDate,parseDisplayDate} from '../lib/display-date.ts';
test('dd/mm/yyyy',()=>{assert.equal(formatDisplayDate('2026-11-05'),'05/11/2026');assert.equal(formatDisplayDate('2026-11-05 10:00:00'),'05/11/2026');assert.equal(parseDisplayDate('5/11/2026'),'2026-11-05');assert.equal(parseDisplayDate('31/02/2026'),null);assert.equal(parseDisplayDate(''),'');});
import {formatDisplayTime,isTimeColumn} from '../lib/display-date.ts';
test('12-hour times',()=>{assert.equal(formatDisplayTime('17:30'),'5:30 PM');assert.equal(formatDisplayTime('00:15'),'12:15 AM');assert.equal(formatDisplayTime('12:00'),'12:00 PM');assert.equal(formatDisplayTime('09:45:00'),'9:45 AM');assert.equal(formatDisplayTime(''),'—');assert.equal(isTimeColumn('appointment_time'),true);assert.equal(isTimeColumn('appointment_date'),false);});
