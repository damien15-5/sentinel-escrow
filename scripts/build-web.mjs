import fs from 'node:fs';
// The dashboard needs the local API; this check packages its assets, not a fake static backend.
for(const file of ['index.html','styles.css','app.js'])if(!fs.statSync(`web/${file}`).size)throw new Error(`Missing web/${file}`);
console.log('Dashboard assets present. Serve with npm start (Node API + local EVM chains).');
