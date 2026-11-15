import test from 'node:test';import assert from 'node:assert/strict';
import {parseDate,parseTime,cleanName,nameAppearsIn} from '../lib/whatsapp/when.ts';
const now=new Date('2026-11-15T09:00:00Z'); // Sunday 15 Nov 2026, 2 PM Karachi
test('dates in every common format resolve correctly (day first)',()=>{
 const cases:Array<[string,string|null]>=[
  ['18/11 ko appointment chahiye','2026-11-18'],['18-11-2026','2026-11-18'],['18.11.26 ko','2026-11-18'],['05/12','2026-12-05'],['5/1','2027-01-05'],['7.10 pm',null],
  ['2026-11-20','2026-11-20'],['20 nov','2026-11-20'],['20th November','2026-11-20'],['november 20','2026-11-20'],['Nov 20th 2026','2026-11-20'],
  ['3 dec ko','2026-12-03'],['3 disambar','2026-12-03'],['10 jan','2027-01-10'],['20 نومبر','2026-11-20'],['20 tareekh ko','2026-11-20'],['10 tarikh','2026-12-10'],
  ['kal','2026-11-16'],['kal shaam 7 baje','2026-11-16'],['tomorrow','2026-11-16'],['parson','2026-11-17'],['aaj','2026-11-15'],['آج','2026-11-15'],['کل','2026-11-16'],['پرسوں','2026-11-17'],
  ['monday','2026-11-16'],['peer ko','2026-11-16'],['mangal','2026-11-17'],['budh ko','2026-11-18'],['jumerat','2026-11-19'],['jumma ko','2026-11-20'],['hafte ko','2026-11-21'],['itwar','2026-11-15'],['agle itwar','2026-11-22'],['جمعہ کو','2026-11-20'],
  ['31/02',null],['kitni fees hai',null],['کلینک کہاں ہے',null],['sat baje',null],['agle hafte',null],['Dr sahiba se milna hai',null]];
 for(const [text,expected] of cases)assert.equal(parseDate(text,now),expected,text);
});
test('times in every common format; date numbers are never read as time',()=>{
 const cases:Array<[string,string|null]>=[
  ['7 baje','19:00'],['7 bje','19:00'],['7pm','19:00'],['7 PM','19:00'],['7:30','19:30'],['7.30 pm','19:30'],['19:30','19:30'],['saade 7','19:30'],['sawa 6','18:15'],['paune 8','19:45'],['pone 9 baje','20:45'],
  ['saat baje','19:00'],['sat baje','19:00'],['shaam 6','18:00'],['raat 9 baje','21:00'],['5 بجے','17:00'],['subah 11 baje','11:00'],['11 am','11:00'],
  ['18/11 ko',null],['15-11-2026',null],['20 nov',null],['20 tareekh',null],['18/11 ko 7 baje','19:00'],['20 nov shaam 6','18:00'],['kitni fees hai',null],['2 log aayenge',null]];
 for(const [text,expected] of cases)assert.equal(parseTime(text),expected,text);
});
test('only real names are accepted as patient names',()=>{
 const services=['Hydra Facial','Laser Hair Removal','Skin Consultation'];
 const good:Array<[string,string]>=[['Ayesha','Ayesha'],['mera naam Ali Khan hai','Ali Khan'],['naam: sana bibi','Sana Bibi'],['my name is Fatima Noor','Fatima Noor'],['Muhammad Ahmed Raza','Muhammad Ahmed Raza'],['عائشہ','عائشہ']];
 for(const [v,e] of good)assert.equal(cleanName(v,services),e,v);
 for(const v of ['kal','kal 7 baje','haan','ok','theek hai','18/11','Hydra Facial','facial','appointment chahiye','kitni fees hai','monday','November','Assalam o Alaikum','',null,'yeh bahut lamba sentence hai jo naam nahi hai'])assert.equal(cleanName(v as string,services),null,String(v));
 assert.equal(nameAppearsIn('Ali Khan','mera naam ali khan hai'),true);assert.equal(nameAppearsIn('Bilal','kal 7 baje'),false);
});
import {isClosingOnly,confirmationMessage} from '../lib/whatsapp/messages.ts';
test('closing-only messages are recognised; real messages are not',()=>{
 for(const t of ['ok','Ok 👍','okk','theek hai','thik h','acha','ji','Ji theek hai','thanks','Thank you sir','shukriya','bohat shukriya','JazakAllah','jazakallah khair','Allah Hafiz','ok thanks','ok jazakallah allah hafiz','👍','🙏🌸','bye','شکریہ','جزاک اللہ','done'])assert.equal(isClosingOnly(t),true,t);
 for(const t of ['ok kal 7 baje','thanks, fees kitni hai?','theek hai appointment book kar dein','Ayesha','cancel kar dein','report bhej rahi hoon','haan cancel kar do'])assert.equal(isClosingOnly(t),false,t);
});
test('confirmation message has emojis, details and the location',()=>{const m=confirmationMessage({patientName:'Ayesha',service:'Hydra Facial',date:'2026-11-18',time:'19:00',price:'PKR 5,000'});
 for(const part of ['✅','👤 *Patient:* Ayesha','💆 *Service:* Hydra Facial','📅 *Date:* Wednesday, 18 November 2026','⏰ *Time:* 7:00 PM','💰 *Fee:* PKR 5,000','📍','🗺️ *Location:* https://maps.google.com/','📞'])assert.ok(m.includes(part),part);});
