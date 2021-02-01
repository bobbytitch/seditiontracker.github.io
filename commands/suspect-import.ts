import { Command } from "commander";
import { info, warning } from "./common/console";
import fs from "fs";
import { readFile, writeFile } from "./common/file";
import axios from 'axios'
import { HTMLElement, Node, NodeType, parse } from 'node-html-parser';
import { capitalize, first } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp'
import moment from 'moment';

const cmd = new Command();
cmd.parse(process.argv);

const importSuspects = async() => {
  info("Reading list of current suspects");

  await importDoj(getNameSet());
  await importGw(getNameSet());
}

const getNameSet = (): Set<string> => {
  const suspectFiles = fs.readdirSync('./docs/_suspects');
  const nameSet:Set<string> = new Set();

  for (const suspectFile of suspectFiles) {
    const data = readFile(`./docs/_suspects/${suspectFile}`)

    const name = data.match(/name:\s(.*)\n/)[1];
    const firstName = name.split(" ")[0];
    const lastName = name.split(" ").slice(1).join(" ");

    nameSet.add(dasherizeName(firstName, lastName));
  }

  return nameSet;
}

const importGw = async (nameSet: Set<string>) => {
  info("Importing suspects from GW site");

  const html = await axios.get("https://extremism.gwu.edu/Capitol-Hill-Cases");

  const root = parse(html.data);
  const divs:HTMLElement[] = root.querySelectorAll(".panel-body");

  for (let i=0; i < 6; i++) {
    const div = divs[i];
    const entries: HTMLElement[] = div.querySelectorAll("p");

    for (const entry of entries) {
      const nameText = (entry.querySelector("strong") || entry.querySelector("em") || entry.querySelector("font")).innerText

      const [lastName, rest] = nameText.split(",").map( (chunk:string) => chunk.trim().replace("&nbsp;", ""));

      if (lastName == "Curzio") {
        // there are some parsing oddities with this one so just skip it
        continue;
      }
      const firstName = rest.split(" ")[0];
      const nameToCheck = dasherizeName(firstName, lastName);

      if (!nameSet.has(nameToCheck)) {
        if (falsePositives().has(lastName)) {
          continue;
        }

        const residence = entry.innerText.match(/State: (.*)/)[1].replace("Unknown", "");
        const links = getLinks(entry)

        newSuspect(firstName, lastName, null, links, residence);
      }
    }
  }
}

const importDoj = async (nameSet: Set<string>) => {
  info("Importing suspects from DOJ site");

  const html = await axios.get("https://www.justice.gov/opa/investigations-regarding-violence-capitol");

  const root = parse(html.data);
  const tbody = root.querySelector("tbody");

  for (const rowNode of tbody.childNodes) {
    const childNodes = rowNode.childNodes.filter( (node:Node) => { return node.nodeType === NodeType.ELEMENT_NODE })

    const name = childNodes[1].innerText.trim();
    const nameChunks = name.split(",")
    const lastName = capitalize(nameChunks[0].split(" ")[0]);
    const firstName = nameChunks[1].trim().split(" ")[0];
    const nameToCheck = dasherizeName(firstName, lastName);

    if (!nameSet.has(nameToCheck) && !falsePositives().has(nameToCheck)) {
      const parseText = childNodes[5].text.trim() || childNodes[6].text.trim();

      const dateString = parseText.match(/\d{1,2}([\/.-])\d{1,2}\1\d{2,4}/)[0]
      const links = getLinks(<HTMLElement>childNodes[3])

      newSuspect(firstName, lastName, dateString, links);
    } else {
      // see if the links for existing suspects need to be updated
      const links = getLinks(<HTMLElement>childNodes[3])
      for (const [type, url] of Object.entries(links)) {
        const dashedName = `${firstName} ${lastName}`.replace(/\s/g, "-").toLowerCase();
        const fileName = `./docs/_suspects/${dashedName}.md`
        let data = readFile(fileName)

        const linkMarkdown = `- [${type}](https://www.justice.gov${url})`

        // add any missing links
        if (!data.match(new RegExp(type))) {
          console.log(`${dashedName}: ${type}`)
          data = data.trim() + `\n${linkMarkdown}`
          writeFile(fileName, data)
        }

        // replace GW links with DOJ links when possible
        const gwRegEx = new RegExp(`\- \\[${type}\]\\(https:\\/\\/extremism.*\\)`)
        if (data.match(gwRegEx)) {
          console.log(`${dashedName}: ${type}`);
          data = data.replace(gwRegEx, linkMarkdown);
          writeFile(fileName, data);
        }
      }
    }
  }
}

const escapeRegEx = (regEx):RegExp => {
  const escaped = regEx.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(escaped);
}

const falsePositives = () => {
  const set:Set<string> = new Set();
  set.add("CALHOUN Jr.");
  set.add("MCCAUGHEY III");
  set.add("MISH Jr.");
  set.add("Calhoun Jr.");
  set.add("Bentacur");
  set.add("Capsel");
  set.add("Courtwright");
  set.add("DeCarlo");
  set.add("DeGrave");
  set.add("Fichett");
  set.add("Phipps");
  set.add("Rodean");
  set.add("Shively");
  set.add("Sidorsky");
  set.add("Sparks");
  set.add("Spencer");
  set.add("Mazzocco");
  set.add("Griffin");
  set.add("McCaughey III");
  return set;
}

const getLinks = (element: HTMLElement) => {
  const links = {}
  const anchors = element.querySelectorAll("a");
  for (const anchor of anchors) {
    const type = linkType(anchor.rawText);
    if (type) {
      links[type] = anchor.attributes.href
    }
  }

  // sometimes the complaint is combined with statement of facts
  if (links["Complaint"] && !links["Statement of Facts"] && !links["Affidavit"]) {
    links["Statement of Facts"] = links["Complaint"];
  }

  return links
}

const linkType = (description: string) => {
    switch(true) {
      case /Indictment/.test(description):
        return "Indictment"
      case /Ammended Complaint/.test(description):
        return "Ammended Complaint"
      case /Ammended Statement of Facts/.test(description):
        return "Ammended Statement of Facts"
      case /Complaint/.test(description):
      case /complaint/.test(description):
        return "Complaint"
      case /Affidavit/.test(description):
        return "Affidavit"
      case /Statement of Fact/.test(description):
        return "Statement of Facts"
      case /Charged/.test(description):
      case /Indicted/.test(description):
      case /Arrested/.test(description):
        return "DOJ Press Release"
      default:
        warning(`unknown link type: ${description}`)
        return "DOJ Press Release"
    }
}

const newSuspect = (firstName, lastName, dateString, links, residence?: string) => {
  console.log(`${firstName} ${lastName}`);

  const dashedName = dasherizeName(firstName, lastName)
  const template = readFile("./commands/common/template.md");

  let data = template.replace(/\[name]/g, `${firstName} ${lastName}`,);
  data = data.replace("[firstName]", firstName);
  data = data.replace("[lastName]", lastName);
  data = data.replace("[mugShot]", "");
  data.replace("[residence]", residence ? residence : "")
  data = data.replace("[residence]", "");
  data = data.replace("[status]", "Charged");
  data = data.replace("[age]", "");
  data = data.replace("[action]", "charged");
  data = data.replace(/\[dashedName]/g, dashedName);
  data = data.replace("published: true", "published: false");

  if (dateString) {
    const date = moment(dateString, "MM/DD/YY");
    data = data.replace("[date]", date.format("YYYY-MM-DD"));
    data = data.replace("[longDate]", date.format("MMMM Do, YYYY"));
  }

  for (const [type, url] of Object.entries<string>(links)) {
    if (url.includes("https")) {
      data = data + `- [${type}](${url})\n`
    } else {
      data = data + `- [${type}](https://www.justice.gov${url})\n`
    }
  }

  fs.writeFileSync(`./docs/_suspects/${firstName.toLowerCase()}-${lastName.toLowerCase()}.md`, data.toString());

}

const dasherizeName = (firstName:string, lastName:string) => {
  return `${firstName} ${lastName}`.replace(/\s/g, "-").toLowerCase();
}

importSuspects();
