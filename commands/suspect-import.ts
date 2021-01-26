import { Command } from "commander";
import { info } from "./common/console";
import fs from "fs";
import { readFile } from "./common/file";
import axios from 'axios'
import { parse } from 'node-html-parser';
import { padStart } from 'lodash';

const cmd = new Command();
cmd.parse(process.argv);

const importSuspects = async() => {
  info("Reading list of current suspects");

  const suspectFiles = fs.readdirSync('./docs/_suspects');
  const nameSet:Set<string> = new Set();
  let maxId = 0;

  for (const suspectFile of suspectFiles) {
    const data = readFile(`./docs/_suspects/${suspectFile}`)

    const name = data.match(/name:\s(.*)\n/)[1];
    const lastName = name.split(" ").slice(1).join(" ");
    nameSet.add(lastName.toUpperCase());

    const id = data.match(/before:\s(\d{0,3})(\..{3})?\n/)[1];
    maxId = parseInt(id) > maxId ? parseInt(id) : maxId;
  }

  info("Importing suspects from DOJ site");

  const html = await axios.get("https://www.justice.gov/opa/investigations-regarding-violence-capitol");

  const root = parse(html.data);
  const tbody = root.querySelector("tbody");

  for (const rowNode of tbody.childNodes) {
    const name = rowNode.childNodes[2].innerText.trim();
    const nameToCheck = name.split(",")[0]

    if (!nameSet.has(nameToCheck) && !falsePositives().has(nameToCheck)) {
      const firstName = name.replace(`${nameToCheck}, `, "").split(" ")[0];
      const lastName = capitalized(nameToCheck.toLowerCase());
      maxId++;
      newSuspect(firstName, lastName, padStart(maxId.toString(), 3, "0"));
    }
  }
}

const falsePositives = () => {
  const set:Set<string> = new Set();
  set.add("CALHOUN Jr.");
  set.add("MCCAUGHEY III");
  set.add("MISH Jr.");
  return set;
}

const capitalized = (input:string) => {
  return input.replace(/(^|[\s-])\S/g, function (match) { return match.toUpperCase(); });
}

const newSuspect = (firstName, lastName, id) => {
  console.log(`${id}: ${firstName} ${lastName}`);
  const template = readFile("./commands/common/template.md");

  let data = template.replace(/\[name]/g, `${firstName} ${lastName}`,);
  data = data.replace("[mugShot]", "");
  data = data.replace("[residence]", "");
  data = data.replace("[status]", "Charged");
  data = data.replace("[age]", "");
  data = data.replace("[action]", "charged");
  data = data.replace(/\[id]/g, id);
  data = data.replace("published: true", "published: false");

  fs.writeFileSync(`./docs/_suspects/${firstName.toLowerCase()}-${lastName.toLowerCase()}.md`, data.toString());

}

importSuspects();
