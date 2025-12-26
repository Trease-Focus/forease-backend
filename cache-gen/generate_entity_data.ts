import { entities } from "../src/entities";
import { writeFileSync } from "fs";
import { join } from "path";

const treeNames = Array.from(entities.keys());

const outputPath = join(__dirname, "../cache/entity_data.json");

const data = {
    trees: treeNames
};

writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log(`Generated entity data with ${treeNames.length} trees:`);
console.log(treeNames.join(", "));
