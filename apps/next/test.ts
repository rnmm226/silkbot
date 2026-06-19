// test.ts

import { semantic_search } from './app/api/chat/tools';

async function run() {
 const r = await semantic_search("TVA");
 console.log(r);
}

run();