import { Command } from "commander";
import { info, warning } from "./common/console";
import fs from "fs";
import axios from 'axios'
import { HTMLElement, parse } from 'node-html-parser';
import { capitalize, isEmpty } from 'lodash';
import moment from 'moment';
import { getSuspect, getSuspectByFile, Suspect, updateSuspect } from "./common/suspect";
const { execSync } = require('child_process')

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
    const suspect = getSuspectByFile(suspectFile)
    const firstName = suspect.name.split(" ")[0];
    nameSet.add(dasherizeName(firstName, suspect.lastName));
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

    addData(nameSet, firstName, lastName, null, {}, residence, age);
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
      if (entry.innerText == "&nbsp;") {
        continue
      }

      const nameText = (entry.querySelector("strong") || entry.querySelector("em") || entry.querySelector("font")).innerText

      const [lastName, rest] = nameText.split(",").map( (chunk:string) => chunk.trim().replace("&nbsp;", "").replace("IV", ""));

      const firstName = rest.split(" ")[0];
      const residence = entry.innerText.match(/State: (.*)/)[1].replace("Unknown", "").replace("&nbsp;", "").replace("Massachusets", "Massachusetts");

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

  const html = await axios.get("https://www.justice.gov/usao-dc/capitol-breach-cases");

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
    const links = getLinks(<HTMLElement>cells[3], "https://www.justice.gov");

    addData(nameSet, firstName, lastName, dateString, links);
  }
}

const falsePositives = (site: string) => {
  const set:Set<string> = new Set();

  switch(site) {
    case "USA":
      set.add("Ryan");
      set.add("Ianni");
      set.add("Jensen");
      set.add("Madden");
      set.add("Courtwright");
      set.add("Blair"); // state charges
      set.add("Moore"); // state charges
      set.add("Kuehn");
      set.add("Sr.");
      break;
    case "GW":
      set.add("Calhoun Jr.");
      set.add("Bentacur");
      set.add("Courtwright");
      set.add("DeCarlo");
      set.add("DeGrave");
      set.add("Phipps");
      set.add("Sparks");
      set.add("Spencer");
      set.add("Mazzocco");
      set.add("McCaughey III");
      set.add("Curzio");
      set.add("Clark")
      break;
    case "DOJ":
      set.add("Capsel");
      set.add("Madden");
      set.add("Alvear");
      break;
  }

  return set
}

const getLinks = (element: HTMLElement, prefix = "") => {
  const links = {}
  const anchors = element.querySelectorAll("a");
  for (const anchor of anchors) {
    const type = linkType(anchor.rawText);
    if (type) {
      links[type] = `${prefix}${anchor.attributes.href}`
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
      case /indictment/.test(description):
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
      case /Information/.test(description):
        return "DOJ Press Release"
      case /Motion for Pretrial Detention/.test(description):
        return "Motion for Pretrial Detention"
      default:
        warning(`unknown link type: ${description}`)
        return "DOJ Press Release"
    }
}

const addData = (nameSet:Set<string>, firstName, lastName, dateString, links, residence?: string, age?: string) => {
  const nameToCheck = dasherizeName(firstName, lastName);

  if (!nameSet.has(nameToCheck)) {
    // suspect does not yet exist in our database so let's add them
    newSuspect(firstName, lastName, dateString, links, residence);
    return;
  }

  // suspect exists already but there may be new data to update
  const suspect = getSuspect(firstName, lastName)

  if (isEmpty(suspect.residence) && !isEmpty(residence)) {
    console.log(`${suspect.name}: ${residence}`)
    suspect.residence = residence
    updateSuspect(suspect)
  }

  if (isEmpty(suspect.age) && !isEmpty(age)) {
    console.log(`${suspect.name}: Age ${age}`)
    suspect.age = age
    updateSuspect(suspect)
  }

  // pick up any new links
  for (const [type, url] of Object.entries(links)) {
    if (!suspect.links[type]) {
      // make sure there is not a similar link already
      if (type == "Complaint" && suspect.links["Statement of Facts"]) {
        continue;
      }

      console.log(`${suspect.name}: ${type}`);
      suspect.links[type] = <string>url

      if (type == "Indictment") {
        suspect.status = "Indicted"
        const previewImage = suspect.image.replace("/images/preview/", "")
        execSync(`yarn suspect preview -f ${previewImage} -s ${suspect.status}`)
      }

      updateSuspect(suspect)
    }
  }

  // TODO - replace non DOJ links
}

const newSuspect = (firstName, lastName, dateString, links, residence?: string, age?: string) => {
  const suspect:Suspect = {
    name: `${firstName} ${lastName}`,
    lastName,
    residence,
    age,
    status: "Charged",
    links: {"News Report": "", ...links},
    jurisdiction: "Federal",
    image: `/images/preview/${dasherizeName(firstName, lastName)}.jpg`,
    suspect: `${dasherizeName(firstName, lastName)}.jpg`,
    title: `${firstName} ${lastName} charged on [longDate]`,
    published: false
  }

  if (dateString) {
    const date = moment(dateString, "MM/DD/YY");
    suspect.date = date.format("YYYY-MM-DD");
    suspect.title = suspect.title.replace("[longDate]", date.format("MMMM Do, YYYY"))
  }

  console.log(`${suspect.name}`);
  updateSuspect(suspect)
}

const dasherizeName = (firstName:string, lastName:string) => {
  return `${firstName} ${lastName}`.replace(/\s/g, "-").toLowerCase();
}

importSuspects();
