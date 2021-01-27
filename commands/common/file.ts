import fs from "fs";
import * as path from "path";

export const readFile = (filename: string) => {
  return fs.readFileSync(path.join(__dirname, `../../${filename}`), "utf8");
};

export const writeFile = (filename: string, data: string) => {
  return fs.writeFileSync(path.join(__dirname, `../../${filename}`), data);
};

export const readJson = (filename: string) => {
  return JSON.parse(readFile(filename));
};

