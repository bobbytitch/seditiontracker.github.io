import { Command } from "commander";
import { info } from "./common/console";
import fs from "fs";
import { readFile } from "./common/file";

const cmd = new Command();
cmd.parse(process.argv);

const unpublished = async() => {
  info("Generating list of unpublished suspects");

  const suspectFiles = fs.readdirSync('./docs/_suspects');
  const nameSet:Set<string> = new Set();
  let maxId = 0;

  for (const suspectFile of suspectFiles) {
    const data = readFile(`./docs/_suspects/${suspectFile}`)

    const name = data.match(/name:\s(.*)\n/)[1];
    const lastName = name.split(" ").slice(1).join(" ");
    nameSet.add(lastName.toUpperCase());

    if (data.match(/published: false/)) {
      console.log(name);
    }
  }
}

unpublished();
