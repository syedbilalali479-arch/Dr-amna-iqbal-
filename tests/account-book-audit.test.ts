import assert from 'node:assert/strict';
import test from 'node:test';
import {auditPeriodLabel,clinicDate,dateInAuditPeriod,type AuditPeriod} from '../lib/account-book-audit';

const period=(overrides:Partial<AuditPeriod>={}):AuditPeriod=>({mode:'day',day:'2026-11-03',month:'2026-11',from:'2026-11-02',to:'2026-11-03',...overrides});

test('clinicDate uses the clinic Pakistan timezone',()=>{
 assert.equal(clinicDate(new Date('2026-11-03T21:30:00.000Z')),'2026-11-04');
});

test('daily audit includes only the selected date',()=>{
 assert.equal(dateInAuditPeriod('2026-11-03',period()),true);
 assert.equal(dateInAuditPeriod('2026-11-02',period()),false);
});

test('monthly audit includes the complete selected month',()=>{
 const filter=period({mode:'month'});
 assert.equal(dateInAuditPeriod('2026-11-01',filter),true);
 assert.equal(dateInAuditPeriod('2026-11-30',filter),true);
 assert.equal(dateInAuditPeriod('2026-10-31',filter),false);
});

test('custom audit includes both range boundaries',()=>{
 const filter=period({mode:'range'});
 assert.equal(dateInAuditPeriod('2026-11-02',filter),true);
 assert.equal(dateInAuditPeriod('2026-11-03',filter),true);
 assert.equal(dateInAuditPeriod('2026-11-04',filter),false);
});

test('all-time audit includes every valid date and produces a clear label',()=>{
 const filter=period({mode:'all'});
 assert.equal(dateInAuditPeriod('2021-01-01',filter),true);
 assert.equal(auditPeriodLabel(filter),'All recorded dates');
});
