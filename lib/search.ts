const synonymGroups=[
 ['appointment','booking'],
 ['vendor','supplier','company'],
 ['medicine','medication','drug'],
 ['phone','mobile','contact','cell'],
 ['patient','customer','client'],
 ['purchase','buy','bought','stock'],
 ['sale','sell','sold'],
 ['paid','payment'],
 ['expense','cost']
] as const;

const synonyms=new Map<string,string[]>();
for(const group of synonymGroups)for(const word of group)synonyms.set(word,[...group]);

export function normalizeSearch(value:unknown) {
 const text=typeof value==='string'?value:JSON.stringify(value??'');
 return text.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

function near(a:string,b:string,max:number) {
 if(Math.abs(a.length-b.length)>max)return false;
 let previous=Array.from({length:b.length+1},(_,index)=>index);
 for(let i=1;i<=a.length;i++){
  const current=[i];let rowMinimum=i;
  for(let j=1;j<=b.length;j++){
   const score=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
   current[j]=score;rowMinimum=Math.min(rowMinimum,score);
  }
  if(rowMinimum>max)return false;
  previous=current;
 }
 return previous[b.length]<=max;
}

function wordMatches(candidate:string,haystack:string,words:string[]) {
 if(haystack.includes(candidate))return true;
 if(words.some(word=>word.startsWith(candidate)))return true;
 const tolerance=candidate.length>=7?2:candidate.length>=4?1:0;
 return tolerance>0&&words.some(word=>near(candidate,word,tolerance));
}

export function matchesSearch(value:unknown,query:unknown) {
 const needle=normalizeSearch(query);if(!needle)return true;
 const haystack=normalizeSearch(value);if(haystack.includes(needle))return true;
 const words=haystack.split(' ').filter(Boolean);
 return needle.split(' ').every(term=>(synonyms.get(term)||[term]).some(candidate=>wordMatches(candidate,haystack,words)));
}

export function sameSearchText(a:unknown,b:unknown) {return normalizeSearch(a)===normalizeSearch(b)};
