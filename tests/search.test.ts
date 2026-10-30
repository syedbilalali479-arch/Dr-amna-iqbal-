import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch,normalizeSearch,sameSearchText} from '../lib/search.ts';

const record={name:'Aámna Iqbal',phone:'0300-1234567',items:[{medicine_name:'Vitamin C Serum'}],vendor:{company_name:'Skin Care Labs'}};

test('search ignores capital letters, accents, punctuation and extra spaces',()=>{
 assert.equal(matchesSearch(record,'AAMNA IQBAL'),true);
 assert.equal(matchesSearch(record,'  aamna   iqbal  '),true);
 assert.equal(matchesSearch(record,'0300 1234567'),true);
 assert.equal(sameSearchText('VENDOR ONE','vendor one'),true);
 assert.equal(normalizeSearch('  Skin—Care  '),'skin care');
});

test('search includes nested medicine data and supports partial words',()=>{
 assert.equal(matchesSearch(record,'vit c ser'),true);
 assert.equal(matchesSearch(record,'skin care labs'),true);
 assert.equal(matchesSearch(record,'missing medicine'),false);
});

test('search dictionary supports common synonyms and small spelling mistakes',()=>{
 assert.equal(matchesSearch({phone:'03123456789'},'mobile'),true);
 assert.equal(matchesSearch({vendor:'Acme'},'supplier acme'),true);
 assert.equal(matchesSearch({patient_name:'Fatima'},'pateint fatima'),true);
});
