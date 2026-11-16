import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
export function compile() {
  const sources = {};
  function walk(dir) { for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.sol')) sources[file.replaceAll('\\','/')] = {content:fs.readFileSync(file,'utf8')};
  }}
  walk('contracts');
  const input = {language:'Solidity', sources, settings:{optimizer:{enabled:true,runs:200}, evmVersion:'shanghai', outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter(e=>e.severity==='error');
  if (errors.length) throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
  fs.mkdirSync('artifacts',{recursive:true});
  for (const contracts of Object.values(output.contracts)) for (const [name, artifact] of Object.entries(contracts))
    fs.writeFileSync(`artifacts/${name}.json`,JSON.stringify({contractName:name,abi:artifact.abi,bytecode:'0x'+artifact.evm.bytecode.object,deployedBytecode:'0x'+artifact.evm.deployedBytecode.object},null,2));
  fs.writeFileSync('artifacts/compiler-input.json',JSON.stringify(input,null,2));
  console.log(`Compiled ${Object.keys(sources).length} Solidity sources with ${solc.version()}`);
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) compile();
