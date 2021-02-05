import { readFile, writeFile } from "./file";
import { isEmpty} from 'lodash';

export interface Suspect {
  published: boolean
  status?: string
  date?: string
  name?: string
  lastName?: string
  links?: { [type:string]: string }
  age?: number
  image?: string
  suspect?: string
  booking?: string
  courtroom?: string
  courthouse?: string
  raid?: string
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

  suspect.name = data.match(/name: (.*)/)[1];
  suspect.links = getLinks(data.split("---")[2].trim());
  suspect.lastName = suspect.name.split(" ").slice(1).join(" ");
  suspect.description = data.match(/description: (.*)/)[1];
  suspect.title = data.match(/title: (.*)/)[1];
  suspect.jurisdiction = data.match(/jurisdiction: (.*)/)[1];

  if (data.match(/residence: (.*)/)) {
    suspect.residence = RegExp.$1;
  }

  if (data.match(/age: (\d{1,2})/)) {
    suspect.age = parseInt(RegExp.$1)
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

  cleanSuspect(suspect)

  return suspect
}

const cleanSuspect = (suspect: Suspect) => {
  // set empty string when shit is not assigned
  const fields = ["aka", "residence", "date", "age", "occupation", "affiliation", "jurisdiction", "image", "preview", "booking", "courtroom", "courthouse", "quote", "affiliations"]
  for (const field of fields) {
    if (isEmpty(suspect[field])) {
      if (Number.isInteger(suspect[field])) {
        continue;
      }
      suspect[field] = ""
    }
  }
}

export const updateSuspect = (suspect: Suspect) => {
  const fs = require('fs')
  const file = fs.createWriteStream(`docs/_suspects/${dasherizeName(suspect.name)}.md`)

  cleanSuspect(suspect)

  file.write('---\n')
  file.write(`name: ${suspect.name}\n`)
  file.write(`lastName: ${suspect.lastName}\n`)
  file.write(`aka: ${suspect.aka}\n`)
  file.write(`residence: ${suspect.residence}\n`)
  file.write(`status: ${suspect.status}\n`)
  file.write(`date: ${suspect.date}\n`)
  file.write(`age: ${suspect.age}\n`)
  file.write(`occupation: ${suspect.occupation}\n`)
  file.write(`affiliations: ${suspect.affiliations}\n`)
  file.write(`jurisdiction: ${suspect.jurisdiction}\n`)
  file.write(`image: ${suspect.image}\n`)
  file.write(`suspect: ${suspect.suspect}\n`)
  file.write(`booking: ${suspect.booking}\n`)
  file.write(`courtroom: ${suspect.courtroom}\n`)
  file.write(`courthouse: ${suspect.courthouse}\n`)
  file.write(`quote: ${suspect.quote}\n`)
  file.write(`title: ${suspect.title}\n`)
  file.write(`description: ${suspect.description}\n`)
  file.write(`author: seditiontrack\n`)
  file.write(`layout: suspect\n`)
  file.write(`published: ${suspect.published}\n`)
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