import { Command } from "commander";
import { info, warning } from "./common/console";
import fs, { link } from "fs";
import { readFile } from "./common/file";
import axios from 'axios'
import { HTMLElement, Node, NodeType, parse } from 'node-html-parser';
import { padStart } from 'lodash';
import moment from 'moment';

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
    const childNodes = rowNode.childNodes.filter( (node:Node) => { return node.nodeType === NodeType.ELEMENT_NODE })

    const name = childNodes[1].innerText.trim();
    const nameToCheck = name.split(",")[0]

    if (!nameSet.has(nameToCheck) && !falsePositives().has(nameToCheck)) {
      const parseText = childNodes[5].text.trim() || childNodes[6].text.trim();

      const dateString = parseText.match(/\d{1,2}([\/.-])\d{1,2}\1\d{2,4}/)[0]
      const firstName = name.replace(`${nameToCheck}, `, "").split(" ")[0];
      const lastName = capitalized(nameToCheck.toLowerCase());
      maxId++;
      const links = dojLinks(<HTMLElement>childNodes[3])

      newSuspect(firstName, lastName, padStart(maxId.toString(), 3, "0"), dateString, links);
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

const dojLinks = (element: HTMLElement) => {
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
    switch(true) {
      case /Indictment/.test(description):
        return "Indictment"
      case /Ammended Complaint/.test(description):
        return "Ammended Complaint"
      case /Ammended Statement of Facts/.test(description):
        return "Ammended Statement of Facts"
      case /Complaint/.test(description):
        return "Complaint"
      case /Affidavit/.test(description):
        return "Affidavit"
      case /Statement of Fact/.test(description):
        return "Statement of Facts"
      default:
        warning(`unknown link type: ${description}`)
        return "DOJ Press Release"
    }
}

/**
 * Recurse the nodes children until an anchor tag is found
 * @param node
 */
// const extractAnchor = (node: Node) => {

// }

const capitalized = (input:string) => {
  return input.replace(/(^|[\s-])\S/g, function (match) { return match.toUpperCase(); });
}

const newSuspect = (firstName, lastName, id, dateString, links) => {
  const date = moment(dateString, "MM/DD/YY");
  console.log(`${id}: ${firstName} ${lastName} ${date.format("MM-DD")}`);
  const template = readFile("./commands/common/template.md");

  let data = template.replace(/\[name]/g, `${firstName} ${lastName}`,);
  data = data.replace("[mugShot]", "");
  data = data.replace("[residence]", "");
  data = data.replace("[status]", "Charged");
  data = data.replace("[age]", "");
  data = data.replace("[action]", "charged");
  data = data.replace(/\[id]/g, id);
  data = data.replace("[date]", date.format("YYYY-MM-DD"));
  data = data.replace("[longDate]", date.format("MMMM Do, YYYY"));
  data = data.replace("published: true", "published: false");

  for (const [type, url] of Object.entries(links)) {
    data = data + `- [${type}](https://www.justice.gov/${url})\n`
  }

  fs.writeFileSync(`./docs/_suspects/${firstName.toLowerCase()}-${lastName.toLowerCase()}.md`, data.toString());

}

importSuspects();
