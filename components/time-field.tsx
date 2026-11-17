"use client";
import {useState} from 'react';
import {formatDisplayTime} from '../lib/display-date';

type Props={value?:string;defaultValue?:string;onChange?:(time:string)=>void;name?:string;required?:boolean;step?:number;'aria-label'?:string};

/**
 * Time picker that always shows 12-hour times (5:30 PM), whatever the browser language.
 * The value given and returned stays 24-hour HH:MM, so storage and validation do not change.
 */
export function TimeField({value,defaultValue,onChange,name,required,step=15,...rest}:Props){
 const controlled=value!==undefined;
 const [own,setOwn]=useState(defaultValue||'');
 const current=controlled?value||'':own;
 const slots:string[]=[];
 for(let m=0;m<24*60;m+=step)slots.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);
 if(current&&!slots.includes(current))slots.push(current);
 slots.sort();
 return <select name={name} required={required} value={current} aria-label={rest['aria-label']} onChange={e=>{if(!controlled)setOwn(e.target.value);onChange?.(e.target.value)}}>
  <option value="">Select time</option>
  {slots.map(slot=><option key={slot} value={slot}>{formatDisplayTime(slot)}</option>)}
 </select>;
}
