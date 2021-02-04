import { readFile, writeFile } from "./file";
import { isEmpty} from 'lodash';

interface Suspect {
  published: boolean
  status?: string
  date?: string
  name?: string
  lastName?: string
  links?: { [type:string]: string }
  age?: number
  image?: string
  preview?: string
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

  if (data.match(/age: (\d{1,2})/)) {
    suspect.age = parseInt(RegExp.$1)
  }

  if (data.match(/image: (.*)/)) {
    suspect.image = RegExp.$1;
  }

  if (data.match(/preview: (.*)/)) {
    suspect.preview = RegExp.$1;
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

  console.log({suspect})

  return suspect
}

export const updateSuspect = (suspect: Suspect) => {

}

const dasherizeName = (suspect:Suspect) => {
  return suspect.name.replace(/\s/g, "-").toLowerCase();
}

const getLinks = (data: string) => {
  const links = {}
  for (const link of data.split("- ")) {
    if (isEmpty(link.trim())) {
      continue;
    }
    const [,name, url] = link.match(/(\[.*])\((.*)\)/)
    links[name] = url
  }
  return links
}