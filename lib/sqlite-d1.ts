import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';

/** D1-compatible interface for the app's SQLite queries, with atomic batch writes. */
export class SQLiteD1 {
 readonly connection:DatabaseSync;
 constructor(path:string,migrations?:string){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  this.connection=new DatabaseSync(path);this.connection.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if(migrations)this.migrate(migrations);
 }
 migrate(directory:string){
  this.connection.exec('CREATE TABLE IF NOT EXISTS _skinuvia_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  for(const name of readdirSync(directory).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
   const sql=readFileSync(join(directory,name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
   const existing=this.connection.prepare('SELECT hash FROM _skinuvia_migrations WHERE name=?').get(name);
   if(existing){if(existing.hash!==hash)throw new Error('Applied migration changed: '+name);continue;}
   this.connection.exec('BEGIN IMMEDIATE');try{this.connection.exec(sql);this.connection.prepare('INSERT INTO _skinuvia_migrations(name,hash) VALUES(?,?)').run(name,hash);this.connection.exec('COMMIT')}catch(e){this.connection.exec('ROLLBACK');throw e;}
  }
 }
 prepare(sql:string){return new SQLiteStatement(this,sql);}
 async batch(statements:SQLiteStatement[]){
  this.connection.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());this.connection.exec('COMMIT');return results}catch(e){this.connection.exec('ROLLBACK');throw e;}
 }
 async exec(sql:string){this.connection.exec(sql);return {count:1,duration:0};}
 close(){this.connection.close();}
}
class SQLiteStatement {
 constructor(readonly db:SQLiteD1,readonly sql:string,readonly values:SQLInputValue[]=[]){ }
 bind(...values:unknown[]){return new SQLiteStatement(this.db,this.sql,values.map(v=>v===undefined?null:typeof v==='boolean'?Number(v):v as SQLInputValue));}
 execute(){
  const prepared=this.db.connection.prepare(this.sql);let results:Record<string,unknown>[]=[],changes=0,lastRow=0;
  if(prepared.columns().length)results=prepared.all(...this.values);
  else{const result=prepared.run(...this.values);changes=Number(result.changes);lastRow=Number(result.lastInsertRowid);}
  return {success:true,results,meta:{changes,last_row_id:lastRow,duration:0,rows_read:results.length,rows_written:changes,changed_db:changes>0,size_after:0}};
 }
 async all<T=Record<string,unknown>>(){return this.execute() as {success:true;results:T[];meta:Record<string,unknown>};}
 async run(){return this.execute();}
 async first<T=Record<string,unknown>>(column?:string){const row=this.db.connection.prepare(this.sql).get(...this.values);return (column?(row?.[column]??null):(row??null)) as T|null;}
 async raw<T=unknown[]>(options?:{columnNames?:boolean}){const stmt=this.db.connection.prepare(this.sql);stmt.setReturnArrays(true);const rows=stmt.all(...this.values) as unknown as T[];return options?.columnNames?[stmt.columns().map(c=>c.name),...rows]:rows;}
}
