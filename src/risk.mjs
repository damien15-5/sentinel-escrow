import fs from 'node:fs';
import {keccak256,toUtf8Bytes} from 'ethers';
import {features, FEATURE_NAMES} from '../model/features.mjs';
import {forward} from '../model/network.mjs';
export const modelBytes=fs.readFileSync(new URL('../model/weights.json',import.meta.url));
export const MODEL_HASH=keccak256(modelBytes);
const model=JSON.parse(modelBytes);
export function assess(listing, context={}) {
  const started=performance.now(); const x=features(listing);
  const {probability}=forward(model,x);
  const report={schemaVersion:1,model:model.name,modelHash:MODEL_HASH,context,contentHash:keccak256(toUtf8Bytes(listing)),score:Math.round(probability*10000),features:Object.fromEntries(FEATURE_NAMES.map((name,i)=>[name,x[i]])),assessedAt:new Date().toISOString(),inferenceMs:Math.round((performance.now()-started)*1000)/1000,disclosure:'Live local neural inference. Synthetic training; score is not a calibrated fraud probability.'};
  const serialized=JSON.stringify(report);
  return {...report,reportHash:keccak256(toUtf8Bytes(serialized)),serialized};
}
