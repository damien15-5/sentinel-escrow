import fs from 'node:fs';
if(fs.existsSync('.env')) process.loadEnvFile('.env');
export function required(name){const value=process.env[name];if(!value)throw new Error(`Set ${name} in .env (see .env.example)`);return value;}
export function envInt(name,fallback,min=0){const value=Number(process.env[name]??fallback);if(!Number.isSafeInteger(value)||value<min)throw new Error(`Invalid ${name}`);return value;}
export function manifest(){const file=process.env.DEPLOYMENT_FILE||'.state/deployment.json';if(!fs.existsSync(file))throw new Error(`Missing ${file}; run npm run deploy:testnet first`);return JSON.parse(fs.readFileSync(file,'utf8'));}
export function atomic(file,value){fs.mkdirSync(file.slice(0,file.lastIndexOf('/'))||'.',{recursive:true});const temp=`${file}.tmp`;fs.writeFileSync(temp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(temp,file);}
