"use client";
import {useRef,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {formatDisplayDate,parseDisplayDate} from '../lib/display-date';

type Props={
 value?:string;
 defaultValue?:string;
 onChange?:(iso:string)=>void;
 name?:string;
 required?:boolean;
 min?:string;
 max?:string;
 'aria-label'?:string;
};

/**
 * Date input that always shows DD/MM/YYYY, whatever the browser language.
 * The value given and returned is ISO (YYYY-MM-DD); a hidden input carries it in forms.
 */
export function DateField({value,defaultValue,onChange,name,required,min,max,...rest}:Props){
 const controlled=value!==undefined;
 const [own,setOwn]=useState(defaultValue||'');
 const iso=controlled?value||'':own;
 const [text,setText]=useState(iso?formatDisplayDate(iso):'');
 const picker=useRef<HTMLInputElement>(null),typed=useRef<HTMLInputElement>(null);
 // When the value changes from outside, show it (adjusting state during render, not in an effect).
 const [seen,setSeen]=useState(iso);
 if(seen!==iso){setSeen(iso);if(parseDisplayDate(text)!==iso)setText(iso?formatDisplayDate(iso):'');}
 const commit=(next:string)=>{if(!controlled)setOwn(next);onChange?.(next);};
 const typedChange=(t:string)=>{
  setText(t);
  const parsed=parseDisplayDate(t);
  const out=parsed!==null&&((min&&parsed&&parsed<min)||(max&&parsed&&parsed>max));
  typed.current?.setCustomValidity(parsed===null?'Date DD/MM/YYYY format mein likhein':out?'Date allowed range se bahar hai':'');
  if(parsed!==null&&!out&&parsed!==iso)commit(parsed);
 };
 const openPicker=()=>{const el=picker.current;if(!el)return;try{el.showPicker();}catch{el.focus();el.click();}};
 return <span className="dateField" style={{position:'relative',display:'flex',alignItems:'center',gap:4}}>
  <input ref={typed} {...rest} type="text" inputMode="numeric" placeholder="DD/MM/YYYY" autoComplete="off" required={required} value={text}
   onChange={e=>typedChange(e.target.value)} onBlur={()=>{if(parseDisplayDate(text)!==null)setText(iso?formatDisplayDate(iso):'');}} style={{flex:1,minWidth:0}}/>
  <button type="button" aria-label="Calendar se date chunein" onClick={openPicker} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:6,border:0,background:'transparent',cursor:'pointer',color:'inherit'}}><CalendarDays size={18}/></button>
  <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" value={iso} min={min} max={max}
   onChange={e=>{const next=e.target.value;setText(next?formatDisplayDate(next):'');typed.current?.setCustomValidity('');commit(next);}}
   style={{position:'absolute',right:0,bottom:0,width:1,height:1,opacity:0,pointerEvents:'none',border:0,padding:0}}/>
  {name&&<input type="hidden" name={name} value={iso}/>}
 </span>;
}
