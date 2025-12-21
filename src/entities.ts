import type { Generate } from "./models/generate";
import { Tree } from "./entities/tree";
import { Sunflower } from "./entities/sunflower";
import { Cedar } from "./entities/cedar";
import { Sakura } from "./entities/sakura";
import { Lavender } from "./entities/lavendar";
import { PinkBallsTree } from "./entities/pink-balls-tree";
import {  WeepingWillow } from "./entities/weeping-willow";
import { Maple } from "./entities/maple";
import { Wisteria } from "./entities/wisteria";

export
const entities: Map<string, Generate> = new Map<string, Generate>([
    ["tree", new Tree()],
    ["sunflower", new Sunflower()],
    ["sakura", new Sakura()],
    ["cedar", new Cedar()],
    ["lavender", new Lavender()],
    ["pink_balls_tree", new PinkBallsTree()],
    ["maple", new Maple()],
    ["wisteria", new Wisteria()],
    ["weeping_willow", new WeepingWillow()]
]);