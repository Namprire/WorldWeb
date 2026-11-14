import fs from 'node:fs/promises';
import {format} from 'prettier';
const root=new URL('../evidence/',import.meta.url),symbols={};
for(const name of await fs.readdir(new URL('raw/',root))){
 if(!/^(index-|kit-|hails-).*\.js$/.test(name))continue;
 const raw=await fs.readFile(new URL('raw/'+name,root),'utf8');
 const pretty=await format(raw,{parser:'babel'});await fs.writeFile(new URL(name,root),pretty);
 symbols[name]=pretty.split('\n').flatMap((line,n)=>{const match=line.match(/^function ([\w$]+)\(|^\s{0,2}([\w$]+) = class/);return match?[{symbol:match[1]||match[2],line:n+1}]:[];});
}
await fs.writeFile(new URL('symbols.json',root),JSON.stringify(symbols,null,2));
console.log('Created formatted copies and symbols.json; raw evidence unchanged.');
