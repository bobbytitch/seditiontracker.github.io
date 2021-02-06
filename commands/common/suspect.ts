import { readFile, writeFile } from "./file";
import { isEmpty} from 'lodash';
import { WriteStream } from "fs";
import fm from 'front-matter';

interface Charge {
  code: string
  name: string
  link: string
}

export interface Suspect {
  published: boolean
  status?: string
  date?: string
  charged?: string
  indicted?: string
  name?: string
  lastName?: string
  links?: { [type:string]: string }
  charges?: {[code:string]: Charge }
  age?: string
  image?: string
  suspect?: string
  booking?: string
  courtroom?: string
  courthouse?: string
  raid?: string
  perpwalk?: string
  occupation?: string
  affiliations?: string
  aka?: string
  quote?: string
  description?: string
  title?: string
  jurisdiction?: string
  residence?: string
}

export const getSuspectByFile = (filename:string) => {
  const data = readFile(`./docs/_suspects/${filename}`)
  const suspect: Suspect = { published: true }

  if (/published: false/.test(data)) {
    suspect.published = false
  }

  suspect.status = data.match(/status: (.*)/)[1];

  if (data.match(/date: (.*)/)) {
    suspect.date = data.match(/date: (.*)/)[1].trim();
  }

  if (data.match(/charged: (.*)/)) {
    suspect.charged = data.match(/charged: (.*)/)[1].trim();
  }

  if (data.match(/indicted: (.*)/)) {
    suspect.indicted = data.match(/indicted: (.*)/)[1].trim();
  }

  suspect.name = data.match(/name: (.*)/)[1];
  suspect.links = getLinks(data.split("---")[2].trim());
  suspect.charges = getCharges(data);
  suspect.lastName = suspect.name.split(" ").slice(1).join(" ");
  suspect.description = data.match(/description: (.*)/)[1];
  suspect.title = data.match(/title: (.*)/)[1];
  suspect.jurisdiction = data.match(/jurisdiction: (.*)/)[1];

  if (data.match(/residence: (.*)/)) {
    suspect.residence = RegExp.$1;
  }

  if (data.match(/age: (\d{1,2})/)) {
    suspect.age = RegExp.$1
  }

  if (data.match(/image: (.*)/)) {
    suspect.image = RegExp.$1;
  }

  if (data.match(/suspect: (.*)/)) {
    suspect.suspect = RegExp.$1;
  }

  if (data.match(/booking: (.*)/)) {
    suspect.booking = RegExp.$1;
  }

  if (data.match(/courthouse: (.*)/)) {
    suspect.courthouse = RegExp.$1;
  }

  if (data.match(/courtroom: (.*)/)) {
    suspect.courtroom = RegExp.$1;
  }

  if (data.match(/raid: (.*)/)) {
    suspect.raid = RegExp.$1;
  }

  if (data.match(/perpwalk: (.*)/)) {
    suspect.perpwalk = RegExp.$1;
  }

  if (data.match(/occupation: (.*)/)) {
    suspect.occupation = RegExp.$1;
  }

  if (data.match(/affiliations: (.*)/)) {
    suspect.affiliations = RegExp.$1;
  }

  if (data.match(/aka: (.*)/)) {
    suspect.aka= RegExp.$1;
  }

  if (data.match(/quote: (.*)/)) {
    suspect.quote= RegExp.$1;
  }

  return suspect
}

const getCharges = (data: string) => {
  const charges: {[code:string]: Charge } = {}
  const content = fm(data)
  if (content.attributes["charges"]) {
    for (const charge of content.attributes["charges"]) {
      charges[charge.code] = charge
    }
  }
  return charges;
}

const nameValue = (stream: WriteStream, name: string, value: string) => {
  if (isEmpty(value)) {
    stream.write(`${name}:\n`)
  } else {
    stream.write(`${name}: ${value.trim()}\n`)
  }
}

export const updateSuspect = (suspect: Suspect) => {
  const fs = require('fs')
  const file = fs.createWriteStream(`docs/_suspects/${dasherizeName(suspect.name)}.md`)

  file.write('---\n')
  nameValue(file, "name", suspect.name)
  nameValue(file, "lastName", suspect.lastName)
  nameValue(file, "aka", suspect.aka)
  nameValue(file, "residence", suspect.residence)
  nameValue(file, "status", suspect.status)
  nameValue(file, "date", suspect.date)
  nameValue(file, "charged", suspect.charged)
  nameValue(file, "indicted", suspect.indicted)
  nameValue(file, "age", suspect.age)
  nameValue(file, "occupation", suspect.occupation)
  nameValue(file, "affiliations", suspect.affiliations)
  nameValue(file, "jurisdiction", suspect.jurisdiction || "Federal")
  nameValue(file, "image", suspect.image)
  nameValue(file, "suspect", suspect.suspect)
  nameValue(file, "booking", suspect.booking)
  nameValue(file, "courtroom", suspect.courtroom)
  nameValue(file, "courthouse", suspect.courthouse)
  nameValue(file, "raid", suspect.raid)
  nameValue(file, "perpwalk", suspect.perpwalk)
  nameValue(file, "quote", suspect.quote)
  nameValue(file, "title", suspect.title)
  nameValue(file, "description", suspect.description || "Click for latest case details. Suspects innocent until proven guilty.")
  nameValue(file, "author", "seditiontrack")
  nameValue(file, "layout", "suspect")
  nameValue(file, "published", suspect.published.toString())
  file.write("charges:\n");
  for (const [code, charge] of Object.entries(suspect.charges)) {
    file.write(` - name: ${charge.name}\n`)
    file.write(`   code: ${charge.code}\n`)
    file.write(`   link: ${charge.link}\n`)
  }
  file.write('---\n')

  for (const [type, url] of Object.entries(suspect.links)) {
    file.write(`- [${type}](${url})\n`)
  }

  file.end()
}

export const getSuspect = (firstName: string, lastName: string) => {
  const dashedName = dasherizeName(`${firstName} ${lastName}`)
  return getSuspectByFile(`${dashedName}.md`)
}

const dasherizeName = (name: string) => {
  return name.replace(/\s/g, "-").toLowerCase();
}


const getLinks = (data: string) => {
  const links = {}
  for (const link of data.split("- ")) {
    if (isEmpty(link.trim())) {
      continue;
    }
    const [,name, url] = link.match(/\[(.*)]\((.*)\)/)
    links[name] = url
  }
  return links
}