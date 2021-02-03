import { Command } from "commander";
import { info, warning } from "./common/console";
import fs from "fs";
import { readFile, writeFile } from "./common/file";
import axios from 'axios'
import { HTMLElement, parse } from 'node-html-parser';
import { capitalize, isEmpty } from 'lodash';
import moment from 'moment';

const cmd = new Command();
cmd.parse(process.argv);

const importSuspects = async() => {
  info("Reading list of current suspects");

  await importDoj(getNameSet());
  await importGw(getNameSet());
  await importUSA(getNameSet());
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

const importUSA = async (nameSet: Set<string>) => {
  info("Importing suspects from USA Today site");

  const html = await axios.get("https://www.usatoday.com/storytelling/capitol-riot-mob-arrests/");
  const root = parse(html.data);
  const divs:HTMLElement[] = root.querySelectorAll(".character.svelte-1b6kbib.svelte-1b6kbib");

  for (const div of divs) {
    const nameText = div.querySelector("h4").innerText.replace("Jr.", "").replace(",", "").trim();
    const names = nameText.split(" ");
    const firstName = names[0];
    const lastName = names.pop();

    if (falsePositives("USA").has(lastName)) {
      continue;
    }

    const lis:HTMLElement[] = div.querySelectorAll("ul li");

    let age = "";
    let date = "";
    let residence = "";

    for (const li of lis) {
      const dateMatch = li.innerText.match(/Arrested or charged on: (.*)/);
      const ageMatch = li.innerText.match(/Age: (\d{1,2})/);
      const residenceMatch = li.innerText.match(/Home state: (.*)/);

      if (ageMatch) {
        age = ageMatch[1];
      }

      if (dateMatch) {
        const dateString = dateMatch[1];
        date = moment(dateString, "M, D, YYYY").format("MM/DD/YY");
      }

      if (residenceMatch) {
        residence = residenceMatch[1];
      }
    }

    addData(nameSet, firstName, lastName, null, {}, residence);
  }
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

      const firstName = rest.split(" ")[0];
      const residence = entry.innerText.match(/State: (.*)/)[1].replace("Unknown", "");

      if (falsePositives("GW").has(lastName)) {
        continue;
      }

      const links = getLinks(entry)
      addData(nameSet, firstName, lastName, null, links, residence)
    }
  }
}

const importDoj = async (nameSet: Set<string>) => {
  info("Importing suspects from DOJ site");

  const html = await axios.get("https://www.justice.gov/opa/investigations-regarding-violence-capitol");

  const root = parse(html.data);
  const tbody = root.querySelector("tbody");
  const rows:HTMLElement[] = tbody.querySelectorAll("tr");

  for (const row of rows) {
    const cells:HTMLElement[] = row.querySelectorAll("td");

    const name = cells[1].innerText.trim();
    const nameChunks = name.split(",")
    const lastName = capitalize(nameChunks[0].split(" ")[0]);
    const firstName = nameChunks[1].trim().split(" ")[0];

    if (falsePositives("DOJ").has(lastName)) {
      continue;
    }

    const dateRegEx = /\d{1,2}([\/.-])\d{1,2}\1\d{2,4}/;
    const dateMatch = cells[5].text.match(dateRegEx) || cells[6].text.match(dateRegEx);
    const dateString = dateMatch ? dateMatch[0] : "";
    const links = getLinks(<HTMLElement>cells[3]);

    addData(nameSet, firstName, lastName, dateString, links);
  }
}

const getFileName = (firstName: string, lastName: string): string => {
  return `./docs/_suspects/${getDashedName(firstName, lastName)}.md`
}

const getDashedName = (firstName: string, lastName: string): string => {
  return `${firstName} ${lastName}`.replace(/\s/g, "-").toLowerCase();
}

const getSuspectData = (firstName: string, lastName: string): string => {
  const fileName = getFileName(firstName, lastName);
  return readFile(fileName)
}

const falsePositives = (site: string) => {
  const set:Set<string> = new Set();

  switch(site) {
    case "USA":
      set.add("Ryan");
      set.add("Ochs");
      set.add("Ianni");
      set.add("Jensen");
      set.add("Rodean");
      set.add("Shively");
      set.add("Madden");
      set.add("Capsel");
      set.add("Courtwright");
      break;
    case "GW":
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
      set.add("Curzio");
      break;
    case "DOJ":
      set.add("CALHOUN Jr.");
      set.add("MCCAUGHEY III");
      set.add("MISH Jr.");
      break;
  }

  return set
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

  return links
}

const linkType = (description: string) => {
    description = description.replace("&nbsp;", " ");

    switch(true) {
      case /Affidavit/.test(description):
      case /Affidavit in Support of Criminal Complaint/.test(description):
      case /Statement of Fact/.test(description):
        return "Statement of Facts"
      case /Indictment/.test(description):
        return "Indictment"
      case /Ammended Complaint/.test(description):
        return "Ammended Complaint"
      case /Complaint/.test(description):
      case /complaint/.test(description):
        return "Complaint"
      case /Charged/.test(description):
      case /Indicted/.test(description):
      case /Arrested/.test(description):
        return "DOJ Press Release"
      case /Government Detention Exhibits/.test(description):
        return "Detention Exhibits"
      case /Detention Exhibit (\d)/.test(description):
        return `Detention Exhibit ${RegExp.$1}`;
      case /Detention Memo/.test(description):
      case /Government Detention Memorandum/.test(description):
      case /Memorandum in Support of Pretrial Detention/.test(description):
        return "Detention Memo"
      case /Arrest Warrant/.test(description):
        return "Arrest Warrant"
      case /Ammended Statement of Facts/.test(description):
        return "Ammended Statement of Facts"
      case /^S$/.test(description):
      case /^tatement of Facts/.test(description):
        // ignore messed up GW links
        return null;
      default:
        warning(`unknown link type: ${description}`)
        return "DOJ Press Release"
    }
}

const addData = (nameSet:Set<string>, firstName, lastName, dateString, links, residence?: string, age?: string) => {
  const nameToCheck = dasherizeName(firstName, lastName);
  const fullName = `${firstName} ${lastName}`
  if (!nameSet.has(nameToCheck)) {
    // suspect does not yet exist in our database so let's add them
    newSuspect(firstName, lastName, dateString, links, residence);
  }

  // suspect exists already but there may be new data to update
  let data = getSuspectData(firstName, lastName);
  const fileName = getFileName(firstName, lastName);

  if (!isEmpty(residence) && data.match(/residence:\s*\n/)) {
    data = data.replace(/residence:\s*\n/, `residence: ${residence}\n`)
    console.log(`${fullName}: ${residence}`);
    writeFile(fileName, data);
  }

  for (const [type, url] of Object.entries(links)) {
    const fullUrl = /https:\/\//.test(<string>url) ? url : `https://www.justice.gov${url}`

    if (!data.match(new RegExp(type))) {
      console.log(`${fullName}: ${type}`)
      const linkMarkdown = `- [${type}](${fullUrl})`
      data = data.trim() + `\n${linkMarkdown}`
      writeFile(fileName, data)
    } else {
      // replace GW links with DOJ links when possible
      if (data.match(new RegExp(`[${type}]\(https:\/\/.*\)`))) {
        console.log(`found GW link: ${RegExp.$1}`)
      }
    }

    // replace GW links with DOJ links when possible
    const gwRegEx = new RegExp(`\- \\[${type}\]\\(https:\\/\\/extremism.*\\)`)
    if (data.match(gwRegEx)) {
      console.log(`${fullName}: ${type}`);
      data = data.replace(gwRegEx, `- [${type}](${fullUrl})`);
      writeFile(fileName, data);
    }
  }
}

const newSuspect = (firstName, lastName, dateString, links, residence?: string, age?: string) => {
  console.log(`${firstName} ${lastName}`);

  const dashedName = dasherizeName(firstName, lastName)
  const template = readFile("./commands/common/template.md");

  let data = template.replace(/\[name]/g, `${firstName} ${lastName}`,);
  data = data.replace("[firstName]", firstName);
  data = data.replace("[lastName]", lastName);
  data = data.replace("[mugShot]", "");
  data = data.replace("[residence]", residence ? residence : "")
  data = data.replace("[age]", age ? age : "")
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
